-- Following, so the feed can be the people you care about rather than everyone.
--
-- The feed has shown every review and watchlist entry in the database since it
-- was built. That is fine with three accounts and stops being fine well before
-- it stops being small, and it is not what people mean by a feed: they mean
-- their friends. `profiles.stats.followers` and `.following` were already
-- rendered on the profile screen, reading 0 for everyone because nothing had
-- ever written a follow.

begin;

create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  -- Following yourself would double every one of your own actions in your feed,
  -- since the feed unions "people I follow" with "me".
  constraint follows_no_self check (follower_id <> followee_id)
);

-- "Whose posts do I see" is the feed's hot path; "who follows this person" is
-- the profile counter. Both directions get an index; the primary key already
-- covers the first, so only the reverse needs one.
create index if not exists follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;

-- Follows are public, the same way they are on every app people already use:
-- a profile has to be able to say how many followers it has, and a follower
-- list nobody may read cannot be shown.
drop policy if exists "follows are readable by everyone" on public.follows;
create policy "follows are readable by everyone"
  on public.follows for select
  using (true);

-- You may only create and destroy your own follows. Without the check, any
-- signed-in user could make anyone follow anyone.
drop policy if exists "users manage their own follows" on public.follows;
create policy "users manage their own follows"
  on public.follows for insert
  to authenticated
  with check (follower_id = auth.uid());

drop policy if exists "users remove their own follows" on public.follows;
create policy "users remove their own follows"
  on public.follows for delete
  to authenticated
  using (follower_id = auth.uid());

-- Finding the friend you came to follow.
--
-- Name and handle only, matched literally: `escape_like` is the same helper
-- 0010 added for the play search, so a '%' typed here is a percent sign rather
-- than a request for the entire user table.
create or replace function public.search_profiles(search_term text)
returns setof public.profiles
language sql
stable
set search_path = public
as $$
  with pattern as (
    select '%' || public.escape_like(coalesce(search_term, '')) || '%' as p
  )
  select pr.*
  from public.profiles pr
  cross join pattern
  where pr.name ilike pattern.p escape '\'
     or pr.handle ilike pattern.p escape '\'
  order by pr.name
  limit 20;
$$;

grant execute on function public.search_profiles(text) to anon, authenticated;

commit;
