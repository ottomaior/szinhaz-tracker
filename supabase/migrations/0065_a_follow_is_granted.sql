-- A follow is granted by the person followed, not taken (T-095).
--
-- 0041 drew the line: everyone sees that you went, only the people who follow
-- you see what you thought. But anybody could follow anybody with one press,
-- so "the people who follow you" was "anybody who pressed", and the line was
-- a formality. From here a follow starts as a request. The person followed is
-- told, and accepts or declines; until they accept, the follower is nobody
-- special — not to `can_see_entry`, not to the follower counts, not to the
-- Követettek feed.
--
-- Additive, then narrowing, in one file, because the two halves are only
-- correct together:
--
--   * `follows.status` is `pending` or `accepted`. Every follow that exists
--     when this runs becomes `accepted`, with `accepted_at = created_at` —
--     those people followed each other when following was a click, and
--     turning them into requests would silently unfollow everybody from
--     everybody. New rows default to `pending`, and the insert policy makes
--     that the only value a client can write.
--   * The person followed may flip their own row to `accepted` (update) or
--     delete it (decline, or later remove a follower). The follower may still
--     delete their own row (withdraw, or unfollow). Nobody else touches it.
--   * A pending row is visible only to its two parties; an accepted one is
--     public as before, which is what the counts and the follower lists read.
--   * `private.can_see_entry`, `friends_ratings` and `friends_recent_plays`
--     count accepted rows only. `reviews_readable` calls the first and needs
--     no change of its own.
--   * Two notification kinds, written by triggers the way 0032 writes the
--     engagement ones: `follow_requested` to the person followed when a row is
--     inserted, `follow_accepted` to the follower when it is accepted. Both
--     are about a person, not a production, so `notifications.play_id` becomes
--     nullable and the payload carries `userId`. When a request is withdrawn,
--     declined or accepted, the `follow_requested` row is removed: an inbox
--     item asking a question that has been answered is a stale button.
--   * `notification_preferences.kinds` gains the two kinds in its default and
--     in the four existing rows. Those rows belong to Ottó's account and the
--     three demo accounts he owns; adding a kind that did not exist when they
--     were written is not overriding a choice anybody made.
--
-- Following a theatre or a performer (`subject_follows`) is a subscription to
-- a catalogue, not to a person, and is untouched.

begin;

-- ---------------------------------------------------------------------------
-- 1. The status
-- ---------------------------------------------------------------------------

alter table public.follows
  add column if not exists status text not null default 'accepted'
    check (status in ('pending', 'accepted')),
  add column if not exists accepted_at timestamptz;

update public.follows set accepted_at = created_at where accepted_at is null;

alter table public.follows alter column status set default 'pending';

comment on column public.follows.status is
  'pending until the person followed accepts; only accepted rows count anywhere.';

create index if not exists follows_followee_pending_idx
  on public.follows (followee_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. Who may do what to a follow row
-- ---------------------------------------------------------------------------

drop policy if exists "follows are readable by everyone" on public.follows;
create policy "follows are readable when accepted, or by their two parties"
  on public.follows for select
  using (
    status = 'accepted'
    or follower_id = (select auth.uid())
    or followee_id = (select auth.uid())
  );

drop policy if exists "users follow accounts open to them" on public.follows;
create policy "users request to follow accounts open to them"
  on public.follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and status = 'pending'
    and not private.blocked_between(followee_id)
  );

drop policy if exists "the person followed accepts" on public.follows;
create policy "the person followed accepts"
  on public.follows for update to authenticated
  using (followee_id = (select auth.uid()))
  with check (followee_id = (select auth.uid()) and status = 'accepted');

drop policy if exists "users remove their own follows" on public.follows;
create policy "either party may end a follow"
  on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Only an accepted follow opens the door
-- ---------------------------------------------------------------------------

create or replace function private.can_see_entry(author uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select author is not null
     and auth.uid() is not null
     and (
       author = auth.uid()
       or exists (
         select 1 from public.follows f
         where f.follower_id = auth.uid()
           and f.followee_id = author
           and f.status = 'accepted'
       )
     );
$$;

create or replace function public.friends_ratings(viewer uuid, play uuid)
returns table (
  review_id uuid,
  user_id uuid,
  name text,
  handle text,
  initials text,
  avatar_path text,
  rating_overall numeric,
  seen_at date
)
language sql
stable
set search_path = public
as $$
  select distinct on (r.user_id)
    r.id,
    r.user_id,
    p.name,
    p.handle,
    p.initials,
    p.avatar_path,
    r.rating_overall,
    r.seen_at
  from public.follows f
  join public.reviews_readable r on r.user_id = f.followee_id
  join public.profiles p on p.id = r.user_id
  where f.follower_id = viewer
    and f.status = 'accepted'
    and r.play_id = play
  order by r.user_id, r.seen_at desc nulls last, r.created_at desc;
$$;

create or replace function public.friends_recent_plays(viewer uuid, limit_count integer default 10)
returns table (play_id uuid, friends integer, avg_rating numeric, last_seen date)
language sql
stable
set search_path = public
as $$
  select
    r.play_id,
    count(distinct r.user_id)::int as friends,
    round(avg(per_user.rating), 1) as avg_rating,
    max(r.seen_at) as last_seen
  from public.follows f
  join public.reviews_readable r on r.user_id = f.followee_id
  join public.plays pl on pl.id = r.play_id
  join lateral (
    select avg(r2.rating_overall) as rating
    from public.reviews_readable r2
    where r2.user_id = r.user_id and r2.play_id = r.play_id
  ) per_user on true
  where f.follower_id = viewer
    and f.status = 'accepted'
    and pl.is_archived = false
  group by r.play_id
  order by max(r.seen_at) desc nulls last, count(distinct r.user_id) desc
  limit greatest(limit_count, 0);
$$;

-- ---------------------------------------------------------------------------
-- 4. The two notifications
-- ---------------------------------------------------------------------------

alter table public.notifications alter column play_id drop not null;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'dates_published',
    'playing_tomorrow',
    'venue_new_play',
    'person_new_play',
    'review_liked',
    'review_commented',
    'follow_requested',
    'follow_accepted'
  ));

-- Every row about a production still has one; the two new kinds are the only
-- ones allowed without.
alter table public.notifications drop constraint if exists notifications_play_or_person;
alter table public.notifications
  add constraint notifications_play_or_person check (
    play_id is not null or kind in ('follow_requested', 'follow_accepted')
  );

create or replace function public.notify_follow_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  follower_name text;
  followee_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select name into follower_name from public.profiles where id = new.follower_id;
    insert into public.notifications (user_id, kind, play_id, payload, dedupe_key)
    values (
      new.followee_id,
      'follow_requested',
      null,
      jsonb_build_object('person', coalesce(follower_name, ''), 'userId', new.follower_id),
      'follow-req:' || new.follower_id || ':' || new.followee_id
    )
    on conflict (user_id, dedupe_key) do nothing;
    return null;
  end if;

  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    -- The question is answered; the row asking it goes.
    delete from public.notifications
     where user_id = new.followee_id
       and dedupe_key = 'follow-req:' || new.follower_id || ':' || new.followee_id;
    select name into followee_name from public.profiles where id = new.followee_id;
    insert into public.notifications (user_id, kind, play_id, payload, dedupe_key)
    values (
      new.follower_id,
      'follow_accepted',
      null,
      jsonb_build_object('person', coalesce(followee_name, ''), 'userId', new.followee_id),
      'follow-acc:' || new.follower_id || ':' || new.followee_id
    )
    on conflict (user_id, dedupe_key) do nothing;
    return null;
  end if;

  if tg_op = 'DELETE' then
    -- Withdrawn or declined while pending, or an old follow ended: either
    -- way the request row, if it is still there, has nothing left to ask.
    delete from public.notifications
     where user_id = old.followee_id
       and dedupe_key = 'follow-req:' || old.follower_id || ':' || old.followee_id;
    return null;
  end if;

  return null;
end;
$$;

revoke execute on function public.notify_follow_change() from public, anon, authenticated;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert or update of status or delete on public.follows
  for each row execute function public.notify_follow_change();

-- `accepted_at` follows the status, whoever wrote it.
create or replace function public.follows_stamp_accepted()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    new.accepted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists follows_stamp_accepted on public.follows;
create trigger follows_stamp_accepted
  before update of status on public.follows
  for each row execute function public.follows_stamp_accepted();

-- ---------------------------------------------------------------------------
-- 5. Preferences know the two kinds
-- ---------------------------------------------------------------------------

alter table public.notification_preferences
  alter column kinds set default array[
    'dates_published',
    'playing_tomorrow',
    'venue_new_play',
    'person_new_play',
    'review_liked',
    'review_commented',
    'follow_requested',
    'follow_accepted'
  ];

update public.notification_preferences
   set kinds = kinds || array['follow_requested', 'follow_accepted']
 where not (kinds @> array['follow_requested', 'follow_accepted']);

commit;

-- rollback:
--   drop trigger if exists follows_stamp_accepted on public.follows;
--   drop function if exists public.follows_stamp_accepted();
--   drop trigger if exists follows_notify on public.follows;
--   drop function if exists public.notify_follow_change();
--   delete from public.notifications where kind in ('follow_requested', 'follow_accepted');
--   alter table public.notifications drop constraint if exists notifications_play_or_person;
--   -- restore the six-kind check from 0032 and `alter column play_id set not null`;
--   -- restore the 0041 body of private.can_see_entry and the 0042 bodies of
--   -- friends_ratings / friends_recent_plays (identical minus the status test);
--   -- restore the three 0037/0045 policies on follows and drop the update policy;
--   -- then `delete from public.follows where status = 'pending'` (the requests
--   -- nobody had answered are the one thing that does not survive going back)
--   -- and `alter table public.follows drop column accepted_at, drop column status`.
--   -- notification_preferences.kinds keeps the two extra words harmlessly.
