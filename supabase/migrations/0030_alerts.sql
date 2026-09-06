-- Closing the loop: the sync produces news, and nobody hears it.
--
-- Ten adapters run every night and the database learns things — a production
-- you saved just published its spring dates, something you saved plays
-- tomorrow, a theatre you follow announced a new production. All of it landed
-- in `plays` and `performances` and stopped there. This is the app's highest-
-- frequency reason to reopen and it did not exist.
--
-- Deliberately an in-app inbox rather than push: no device tokens, no APNs or
-- FCM setup, nothing to configure before the first version ships. Email can sit
-- on top of the same rows later without changing any of this.

begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  kind text not null check (kind in (
    -- A production on your watchlist has dates it did not have before.
    'dates_published',
    -- Something on your watchlist plays tomorrow.
    'playing_tomorrow',
    -- A theatre you follow announced a production.
    'venue_new_play',
    -- A performer you follow is in one.
    'person_new_play'
  )),

  play_id uuid not null references public.plays (id) on delete cascade,

  -- What the copy needs and the join cannot give: a date, a venue name, a
  -- performer's name. Structured rather than a rendered sentence, so every
  -- Hungarian string in the app stays in `i18n/hu.ts` — a notifications table
  -- full of prose is a second, invisible place where the app's voice lives.
  payload jsonb not null default '{}'::jsonb,

  -- What makes the generator safe to run again. The nightly job has no memory
  -- of its last run and must not be able to send the same thing twice, so every
  -- row it could produce is named by a key that is stable for that fact and
  -- changes when the fact does — see `generate_notifications()` below.
  dedupe_key text not null,

  created_at timestamptz not null default now(),
  read_at timestamptz,

  unique (user_id, dedupe_key)
);

-- The inbox's own query: mine, newest first.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- The badge's query, which runs on every visit to the feed.
create index if not exists notifications_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

-- Unlike `follows` and `subject_follows`, these are **not** public. A follow is
-- a statement about a performer; a notification is a statement about what one
-- person is being told, and reading somebody's inbox reveals their whole
-- watchlist in order of interest.
drop policy if exists "users read their own notifications" on public.notifications;
create policy "users read their own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

-- Marking one read is the only write the app makes. There is deliberately no
-- insert policy: rows come from the nightly job, which runs as the service role
-- and bypasses RLS, so nothing signed in can post itself — or anyone else — a
-- notification.
drop policy if exists "users update their own notifications" on public.notifications;
create policy "users update their own notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users delete their own notifications" on public.notifications;
create policy "users delete their own notifications"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- The job
-- ---------------------------------------------------------------------------
--
-- Called at the end of `sync/run.ts`, which is the moment the database has just
-- finished learning things. Written in SQL rather than in the adapter because
-- what is worth telling somebody is a question about the whole database, not
-- about what one adapter happened to return: a theatre can publish a date
-- through any of ten adapters, and the answer to "does anybody care" is the
-- same either way.
--
-- Idempotent by construction. Every statement ends in `on conflict do nothing`
-- against `(user_id, dedupe_key)`, so running it twice in a night, or catching
-- up after three days down, produces each notification exactly once.
--
-- Returns how many rows it created, which the sync logs.
create or replace function public.generate_notifications()
returns int
language plpgsql
set search_path = public
as $function$
declare
  made int := 0;
  n int;
  today date := (now() at time zone 'Europe/Budapest')::date;
begin
  -- 1. Dates published for something on your watchlist.
  --
  -- The key carries the furthest-out date currently announced, so it advances
  -- only when a theatre genuinely extends the run — not every time the earliest
  -- date rolls into the past, which is what keying on `min` would have done.
  --
  -- `performances.created_at > w.added_at` is what keeps the first run quiet:
  -- without it, everybody is told about the showtimes they could already see
  -- when they saved the production.
  insert into public.notifications (user_id, kind, play_id, payload, dedupe_key)
  select
    w.user_id,
    'dates_published',
    p.id,
    jsonb_build_object(
      'through', to_char(max(perf.starts_at at time zone 'Europe/Budapest'), 'YYYY-MM-DD'),
      'count', count(*)
    ),
    'dates:' || p.id::text || ':' ||
      to_char(max(perf.starts_at at time zone 'Europe/Budapest'), 'YYYY-MM-DD')
  from public.watchlist_entries w
  join public.plays p on p.id = w.play_id
  join public.performances perf on perf.play_id = p.id
  where perf.starts_at >= now()
    and perf.created_at > w.added_at
  group by w.user_id, p.id
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics n = row_count;
  made := made + n;

  -- 2. Something on your watchlist plays tomorrow.
  --
  -- Keyed on the performance rather than the day, so a matinee and an evening
  -- show are two notices — they are two decisions.
  insert into public.notifications (user_id, kind, play_id, payload, dedupe_key)
  select
    w.user_id,
    'playing_tomorrow',
    p.id,
    jsonb_build_object('startsAt', perf.starts_at, 'room', perf.room),
    'tomorrow:' || perf.id::text
  from public.watchlist_entries w
  join public.plays p on p.id = w.play_id
  join public.performances perf on perf.play_id = p.id
  where (perf.starts_at at time zone 'Europe/Budapest')::date = today + 1
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics n = row_count;
  made := made + n;

  -- 3. A theatre you follow announced a production.
  --
  -- `p.created_at > f.created_at` is the definition of "new": new since you
  -- asked. It is what stops a first run mailing somebody all 76 of Örkény's
  -- productions the moment they follow the house.
  --
  -- The 30-day floor is a second, blunter guard against the same failure seen
  -- from the other side: `plays.created_at` means "when the catalogue learned
  -- about this", which stops being true the moment a source change makes the
  -- sync recreate rows rather than update them. Then every play looks new, and
  -- one follower of one theatre gets 76 notices in a night — not news, a
  -- symptom.
  --
  -- Worth being precise about what it buys today: **nothing**. The whole
  -- catalogue was imported within the last month, so the floor is currently
  -- above every row and the only thing keeping a new follower quiet is
  -- `p.created_at > f.created_at`. It starts working once the import ages out,
  -- which is exactly when a re-import would otherwise become indistinguishable
  -- from a season announcement. The cost is a missed announcement if the job
  -- has not run for a month, and it runs nightly.
  insert into public.notifications (user_id, kind, play_id, payload, dedupe_key)
  select
    f.user_id,
    'venue_new_play',
    p.id,
    jsonb_build_object('venue', v.name),
    'venue:' || f.subject_key || ':' || p.id::text
  from public.subject_follows f
  join public.venues v on v.id = f.subject_key::uuid
  join public.plays p on p.venue_id = v.id
  where f.subject_type = 'venue'
    and p.is_archived = false
    and p.created_at > greatest(f.created_at, now() - interval '30 days')
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics n = row_count;
  made := made + n;

  -- 4. A performer you follow is in a new production.
  --
  -- Through `person_credits()`, so this counts a directing credit in
  -- `plays.director` as well as a cast row — the same union the person page
  -- shows, rather than a second opinion about what a credit is.
  insert into public.notifications (user_id, kind, play_id, payload, dedupe_key)
  select distinct
    f.user_id,
    'person_new_play',
    p.id,
    jsonb_build_object('person', coalesce(prof.display_name, f.subject_key)),
    'person:' || f.subject_key || ':' || p.id::text
  from public.subject_follows f
  cross join lateral public.person_credits(f.subject_key) c
  join public.plays p on p.id = c.play_id
  cross join lateral public.person_profile(f.subject_key) prof
  where f.subject_type = 'person'
    and p.is_archived = false
    and p.created_at > greatest(f.created_at, now() - interval '30 days')
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics n = row_count;
  made := made + n;

  return made;
end;
$function$;

-- Only the nightly job may run this. A signed-in caller would achieve nothing
-- useful — RLS would narrow the reads to their own rows and the insert would be
-- refused — but a function that writes to other people's inboxes should not be
-- reachable from the public API at all.
revoke execute on function public.generate_notifications() from public, anon, authenticated;
grant execute on function public.generate_notifications() to service_role;

commit;
