-- The weekly letter: what a person's week holds, gathered in one call (T-090).
--
-- Push reaches only the people who allowed it on a device that supports it.
-- E-mail reaches everyone from the first day, and a well-set weekly mail is
-- what most culture products are actually remembered by. So once a week the
-- app writes to each person about *their* week: the evenings on their
-- watchlist that play in the next seven days, what the theatres they follow
-- have on, and whatever the inbox told them since the last letter.
--
-- `weekly_digest(for_user, from_ts, to_ts)` assembles that as one jsonb per
-- person, so the sender makes one round trip per recipient rather than
-- three, and so the question "what goes in the letter" is answered here
-- beside the tables rather than in a Deno file. It is `security definer`
-- with `execute` revoked from the client roles: the sender runs as the
-- service role, and a person's week is not something another person may
-- ask for. Reading `reviews_readable` rather than `reviews` would be the
-- rule if it quoted anybody else's entry; it quotes nobody's, so it does not.
--
-- `digest_sent_at` is the sender's bookmark, per person, on the preferences
-- row the push work added (0062): the window of "since the last letter"
-- starts there, or seven days back for a first letter, so nobody is told
-- twice and nobody's first letter reaches back to the beginning of time.
-- `digest_enabled` is the switch. Default on, because the letter is the
-- reason a person who never opens the app comes back, and the first one
-- carries an unsubscribe link that flips it — see the function.
--
-- Additive: two nullable-or-defaulted columns and one function. Nothing a
-- person stored is touched.

begin;

alter table public.notification_preferences
  add column if not exists digest_enabled boolean not null default true,
  add column if not exists digest_sent_at timestamptz;

comment on column public.notification_preferences.digest_enabled is
  'Whether the weekly letter goes out. Flipped by the unsubscribe link or in Settings.';
comment on column public.notification_preferences.digest_sent_at is
  'When the last weekly letter was sent; the next one covers what happened since.';

-- ---------------------------------------------------------------------------
-- One person's week
-- ---------------------------------------------------------------------------

create or replace function public.weekly_digest(
  for_user uuid,
  from_ts timestamptz,
  to_ts timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
  -- Evenings on the watchlist that play inside the window.
  watchlist_week as (
    select
      pl.id as play_id,
      pl.title,
      v.name as venue,
      pf.starts_at,
      pf.room
    from public.watchlist_entries w
    join public.plays pl on pl.id = w.play_id
    join public.performances pf on pf.play_id = pl.id
    join public.venues v on v.id = pf.venue_id
    where w.user_id = for_user
      and pf.starts_at >= from_ts
      and pf.starts_at < to_ts
    order by pf.starts_at
    limit 12
  ),
  -- What the followed theatres have on inside the window, one row per
  -- production rather than per performance: the letter says "these are
  -- playing", and lists the first curtain.
  followed_week as (
    select distinct on (pl.id)
      pl.id as play_id,
      pl.title,
      v.name as venue,
      min(pf.starts_at) over (partition by pl.id) as first_starts_at,
      count(*) over (partition by pl.id) as nights
    from public.subject_follows sf
    join public.venues v on v.id::text = sf.subject_key
    join public.performances pf on pf.venue_id = v.id
    join public.plays pl on pl.id = pf.play_id
    where sf.user_id = for_user
      and sf.subject_type = 'venue'
      and pf.starts_at >= from_ts
      and pf.starts_at < to_ts
      and coalesce(pl.is_event, false) = false
      -- Not the ones already listed above.
      and pl.id not in (select play_id from watchlist_week)
    order by pl.id, pf.starts_at
  ),
  -- What the inbox said since the last letter, with the same facts the
  -- inbox row carries, for the same renderer.
  inbox_since as (
    select
      n.kind,
      n.play_id,
      n.review_id,
      pl.title,
      n.payload,
      n.created_at
    from public.notifications n
    join public.plays pl on pl.id = n.play_id
    where n.user_id = for_user
      and n.created_at >= from_ts
      and n.created_at < to_ts
    order by n.created_at desc
    limit 20
  )
  select jsonb_build_object(
    'name', (select p.name from public.profiles p where p.id = for_user),
    'city', (select p.city from public.profiles p where p.id = for_user),
    'watchlist', coalesce((select jsonb_agg(to_jsonb(w) order by w.starts_at) from watchlist_week w), '[]'::jsonb),
    'followed', coalesce((select jsonb_agg(to_jsonb(f) order by f.first_starts_at) from (select * from followed_week order by first_starts_at limit 12) f), '[]'::jsonb),
    'inbox', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from inbox_since i), '[]'::jsonb)
  );
$$;

revoke execute on function public.weekly_digest(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.weekly_digest(uuid, timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Who gets one this week
-- ---------------------------------------------------------------------------

-- Every account with an address, unless they switched it off or already had
-- one inside the last six days (a rerun the same day must not send twice).
create or replace function public.weekly_digest_recipients(as_of timestamptz default now())
returns table (user_id uuid, email text, last_sent_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text, np.digest_sent_at
  from auth.users u
  left join public.notification_preferences np on np.user_id = u.id
  where u.email is not null
    and u.email_confirmed_at is not null
    and coalesce(np.digest_enabled, true)
    and (np.digest_sent_at is null or np.digest_sent_at < as_of - interval '6 days')
  order by u.created_at;
$$;

revoke execute on function public.weekly_digest_recipients(timestamptz) from public, anon, authenticated;
grant execute on function public.weekly_digest_recipients(timestamptz) to service_role;

commit;

-- rollback:
--   drop function if exists public.weekly_digest_recipients(timestamptz);
--   drop function if exists public.weekly_digest(uuid, timestamptz, timestamptz);
--   alter table public.notification_preferences
--     drop column if exists digest_sent_at,
--     drop column if exists digest_enabled;
--   -- The two columns hold a switch and a bookmark, both recreated on demand.
