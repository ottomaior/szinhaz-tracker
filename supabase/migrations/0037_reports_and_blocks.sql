-- Reporting, blocking, and a way to take something down.
--
-- Reviews and comments are public writing by strangers. Until this migration
-- the only moderation rule in the entire system was `users delete comments they
-- own or host` from 0032 — a diary owner could remove a comment from under
-- their own evening, and that was the whole of it. There was no way to report
-- anything, no way to avoid somebody, and no way for the operator to remove a
-- row short of deleting it outright from the SQL editor.
--
-- That is a real safety gap on the live web product today, and it is also App
-- Store Guideline 1.2, which is the most likely reason this app would be
-- rejected at review.
--
-- Three things, in the order they depend on each other:
--
--   1. `is_hidden` on reviews and comments — the operator's takedown, and the
--      only new way a row can leave public view.
--   2. `user_blocks` — one reader deciding not to see another, which has to
--      cut both ways or it does not protect anybody.
--   3. `reports` — how anything reaches the operator's attention at all.
--
-- The filtering is done in RLS rather than in the app's queries. A `.neq()` in
-- a service file is a suggestion: PostgREST will happily answer a request that
-- does not include it, and every new screen would have to remember. A policy is
-- the answer to every query that will ever be written, including the ones in
-- screens that do not exist yet.

begin;

-- ---------------------------------------------------------------------------
-- 1. Hiding a row without destroying it
-- ---------------------------------------------------------------------------
--
-- Deleting reported content is the wrong default for an operator: a report can
-- be wrong, a deletion cannot be undone, and a row that has been removed is
-- also gone as evidence of why it was removed. `is_hidden` is reversible and
-- leaves the row to look at.

alter table public.reviews
  add column if not exists is_hidden boolean not null default false;

alter table public.review_comments
  add column if not exists is_hidden boolean not null default false;

-- Partial, because the interesting rows are vanishingly rare and the index
-- exists to make the policies below cheap rather than to answer a query.
create index if not exists reviews_hidden_idx
  on public.reviews (id) where is_hidden;

create index if not exists review_comments_hidden_idx
  on public.review_comments (id) where is_hidden;

-- ---------------------------------------------------------------------------
-- 2. Blocks
-- ---------------------------------------------------------------------------

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  -- Blocking yourself would make your own diary unreadable to you, which is a
  -- support ticket rather than a feature.
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

-- The primary key covers lookups by blocker. This is the other direction: the
-- policies below ask "is there a block in either direction between these two",
-- and without this the second half of that `or` is a sequential scan.
create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id, blocker_id);

alter table public.user_blocks enable row level security;

-- A block list is private. Nobody is told they have been blocked — being told
-- is itself a form of contact, and it is the one thing a person who has just
-- blocked somebody is trying to avoid.
create policy "users read their own blocks"
  on public.user_blocks for select
  using (blocker_id = auth.uid());

create policy "users create their own blocks"
  on public.user_blocks for insert
  with check (blocker_id = auth.uid());

create policy "users remove their own blocks"
  on public.user_blocks for delete
  using (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Is there a block between the viewer and this author, either way round?
-- ---------------------------------------------------------------------------
--
-- Symmetric on purpose. If a block only hid the blocked person's writing from
-- the blocker, the blocked person could still read, quote and reply to
-- everything the blocker wrote — so the block would remove the evidence of
-- being harassed without removing the harassment. Both directions is what
-- every product that has learned this the hard way ended up doing.
--
-- `security definer` because the caller cannot read rows of `user_blocks`
-- belonging to somebody else — the select policy above is `blocker_id =
-- auth.uid()` — and this deliberately asks about exactly those. `search_path`
-- pinned for the reason 0027 sets out: it is what the database linter's
-- `function_search_path_mutable` rule asks for, and cheap to do now.
--
-- ### Why this lives in `private` rather than `public`
--
-- Because the function reads a table the caller cannot, it must not also be
-- callable as an RPC with an argument of the caller's choosing: `POST
-- /rest/v1/rpc/blocked_between` would answer "has this person blocked me?" for
-- any id, which is the one thing a block is not supposed to announce. Nobody is
-- told they have been blocked — being told is itself a form of contact.
--
-- The obvious way to close that is `revoke execute ... from anon, authenticated`,
-- and it is wrong. **An RLS policy expression is evaluated with the privileges
-- of the role running the query, not the table's owner.** Revoking execute
-- therefore does not merely remove the endpoint; it breaks every policy that
-- calls the function. Applying it that way took the live database down
-- instantly: `select * from reviews` became "permission denied for function
-- blocked_between" for every reader, signed in or not, since the revoke named
-- `public` as well as the two API roles. Reproduced afterwards on a throwaway
-- table to check that claim rather than assume it — the first write-up of this
-- said anonymous visitors were unaffected, and they were not.
--
-- So the grant has to exist, and the endpoint must not. PostgREST only exposes
-- functions in its configured schemas (`public`, `graphql_public`, `storage`).
-- A schema outside that list is reachable from a policy and unreachable over
-- HTTP, which is exactly the split this needs.
create schema if not exists private;

-- Usage on the schema so a policy running as `authenticated` can resolve the
-- name. Nothing else is granted in here, so this opens nothing else.
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.blocked_between(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and other is not null
     and exists (
       select 1 from public.user_blocks b
       where (b.blocker_id = auth.uid() and b.blocked_id = other)
          or (b.blocker_id = other       and b.blocked_id = auth.uid())
     );
$$;

grant execute on function private.blocked_between(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reports
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('review', 'comment', 'profile')),
  target_id uuid not null,
  reason text not null check (
    reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'misinformation', 'other')
  ),
  -- Optional, and the only free text in the row. Everything else is a closed
  -- vocabulary so the queue can be read at a glance.
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- One report per person per thing. A second press is somebody checking the
  -- first one worked, not new information — and without this a single reporter
  -- could bury the queue.
  unique (reporter_id, target_type, target_id)
);

-- No foreign key on `target_id`: it points at one of three different tables
-- depending on `target_type`, which is a shape Postgres has no constraint for.
-- The consequence is that a report can outlive the thing it is about — which is
-- the right way round, since a deleted row is exactly what somebody reviewing
-- the queue needs to know about.
create index if not exists reports_open_idx
  on public.reports (created_at desc) where status = 'open';

create index if not exists reports_target_idx
  on public.reports (target_type, target_id);

alter table public.reports enable row level security;

-- A reporter may file, and may see what they filed — so the app can say "you
-- have already reported this" instead of failing on the unique constraint with
-- nothing to show for it.
create policy "users file their own reports"
  on public.reports for insert
  with check (reporter_id = auth.uid());

create policy "users read their own reports"
  on public.reports for select
  using (reporter_id = auth.uid());

-- Deliberately no update or delete policy for anyone. A report is a record of
-- something somebody said happened; the reporter does not get to retract it and
-- the reported person must never learn it exists. Triage happens through the
-- service role, in `supabase/moderation.sql`.

-- ---------------------------------------------------------------------------
-- The policies that make any of this visible
-- ---------------------------------------------------------------------------
--
-- `reviews_select_all` and `review comments are readable by everyone` were both
-- literally `using (true)` since 0001 and 0032. They are replaced rather than
-- added to, because RLS combines permissive policies with `or` — leaving the
-- old ones in place would mean every row still matched `true` and nothing below
-- would filter anything.

drop policy if exists reviews_select_all on public.reviews;

create policy reviews_select_all
  on public.reviews for select
  using (
    -- The author always sees their own, hidden or not. A diary entry is the
    -- writer's own record of an evening as well as a public post, and a
    -- takedown should remove it from the public half without quietly deleting
    -- somebody's memory of a night at the theatre.
    user_id = auth.uid()
    or (not is_hidden and not private.blocked_between(user_id))
  );

drop policy if exists "review comments are readable by everyone" on public.review_comments;

create policy "review comments are readable unless hidden or blocked"
  on public.review_comments for select
  using (
    user_id = auth.uid()
    or (not is_hidden and not private.blocked_between(user_id))
  );

-- Profiles stay readable when hidden content is not: a blocked person's profile
-- still has to load, or the block list in Settings would be a column of blanks
-- with no way to tell who you had blocked. What goes is their writing, above,
-- and their appearance in the people search, which is rewritten below.
--
-- Likes are left readable for the same reason the count is a count: a like
-- carries no text, reveals nothing beyond a number, and filtering them would
-- make two viewers disagree about a total for no protection gained.

-- ---------------------------------------------------------------------------
-- A block has to stop writing too, not only reading
-- ---------------------------------------------------------------------------
--
-- The read policies above are most of what a person means by "block", and on
-- their own they are half a feature. Hiding somebody's writing from you does
-- not stop them writing: the select policy makes your entry invisible to them
-- in the app, but PostgREST will still accept an insert naming its id, because
-- nothing about `user_id = auth.uid()` asks whose evening is being commented
-- on. The person you blocked keeps commenting under your reviews and you simply
-- stop being able to see it happen.
--
-- So the three ways one account can attach itself to another all check.

drop policy if exists "users comment as themselves" on public.review_comments;

create policy "users comment as themselves, on entries open to them"
  on public.review_comments for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.reviews r
      where r.id = review_id and not private.blocked_between(r.user_id)
    )
  );

drop policy if exists "users like as themselves" on public.review_likes;

create policy "users like as themselves, on entries open to them"
  on public.review_likes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.reviews r
      where r.id = review_id and not private.blocked_between(r.user_id)
    )
  );

drop policy if exists "users manage their own follows" on public.follows;

create policy "users follow accounts open to them"
  on public.follows for insert
  with check (follower_id = auth.uid() and not private.blocked_between(followee_id));

-- ---------------------------------------------------------------------------
-- Blocking undoes the following that already existed
-- ---------------------------------------------------------------------------
--
-- Otherwise the block leaves the relationship standing and only stops it being
-- visible: the blocked account keeps its place in the blocker's follower count,
-- and — the part that actually matters — keeps receiving a notification every
-- time the blocker records an evening, because `generate_notifications()` reads
-- `follows` and knows nothing about any of this.
--
-- Both directions, since the block is symmetric everywhere else.
create or replace function public.drop_follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end;
$$;

revoke execute on function public.drop_follows_on_block() from public, anon, authenticated;

drop trigger if exists user_blocks_drop_follows on public.user_blocks;

create trigger user_blocks_drop_follows
  after insert on public.user_blocks
  for each row execute function public.drop_follows_on_block();

-- ---------------------------------------------------------------------------
-- People search stops returning people you have blocked
-- ---------------------------------------------------------------------------
--
-- `search_profiles` is from 0014 and unchanged apart from the last line of the
-- where clause.
--
-- It stays `security invoker`. There was a version of this that made it a
-- definer so that it could reach a `blocked_between` nobody else was allowed to
-- call, and putting that function in `private` instead removed the need: the
-- grant is back, so an ordinary invoker function calls it fine. Which is worth
-- keeping, because the database linter flags every definer function reachable
-- at /rest/v1/rpc (lints 0028 and 0029) and is right to — a definer bypasses
-- RLS on everything it touches, and this needs to bypass nothing. `profiles` is
-- readable by everyone anyway.
create or replace function public.search_profiles(search_term text)
returns setof public.profiles
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with pattern as (
    select '%' || public.escape_like(coalesce(search_term, '')) || '%' as p
  )
  select pr.*
  from public.profiles pr
  cross join pattern
  where (pr.name ilike pattern.p escape '\' or pr.handle ilike pattern.p escape '\')
    and not private.blocked_between(pr.id)
  order by pr.name
  limit 20;
$$;

grant execute on function public.search_profiles(text) to anon, authenticated;

commit;
