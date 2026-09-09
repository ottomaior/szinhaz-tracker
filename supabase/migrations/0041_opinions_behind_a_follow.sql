-- Opinions move behind a follow, part one: the read surface.
--
-- Until now a diary entry has been public in full. `reviews_select_all` was
-- `using (true)` from 0001 and 0037 only narrowed it to exclude hidden and
-- blocked rows — so anybody, signed out, in an incognito window, could read a
-- stranger's rating, their review, what they paid and where they sat.
--
-- The rule from here: **everyone sees that you went; only you and the people
-- who follow you see what you thought.**
--
-- Public, on every entry, to everybody:
--   who, which production, when, and whether it was a rewatch.
-- Behind the follow:
--   the four ratings, the review text, the experience tags, the seat, the
--   price, the ticket photo, the cast recorded that night, the like and
--   comment counts, and the comment thread.
--
-- That split keeps the feed working as the place you find people. A card still
-- says "Nagy Zsófia megnézte" over a poster, which is what makes somebody worth
-- following; it just no longer hands over the opinion that following is for.
--
-- ---------------------------------------------------------------------------
-- Why a view, and not a policy
-- ---------------------------------------------------------------------------
--
-- The fact and the opinion are columns on the same row. RLS filters rows, not
-- columns, so no policy can express "you may see this row, but eleven of its
-- columns are not for you". Postgres has column privileges, but they are
-- per-role and static — they cannot depend on who wrote the row.
--
-- Doing it in the client is not an option worth discussing: `reviews` is
-- exposed through PostgREST, and a mask applied in a screen leaves the data one
-- request away from anybody who opens the network tab. 0037 made the same
-- argument about `.neq()` in a service file and it applies twice as hard here.
--
-- So: a view that returns every readable row with the private columns nulled
-- unless the viewer is entitled to them, and — in 0042, once the app is reading
-- the view — a base table narrowed to own rows only.
--
-- Split in two deliberately. Narrowing `reviews` in the same breath as adding
-- the view would break the *currently deployed* app the instant it applied,
-- because that build still selects from `reviews` directly for the feed. This
-- migration is additive and safe to apply under the running app; 0042 is the
-- one that closes the door, and it goes out after the new client is live.

begin;

-- ---------------------------------------------------------------------------
-- Two helpers, in `private` for the reason 0037 set out
-- ---------------------------------------------------------------------------
--
-- Both are `security definer`, and both are granted to `anon` and
-- `authenticated`. That grant is not optional and is not a loosening: a policy
-- expression is evaluated with the privileges of the role running the query,
-- not the table owner, so a policy that calls a function the caller cannot
-- execute does not silently skip it — it fails the whole query. 0037 records
-- what that looked like in production: revoking execute on
-- `private.blocked_between` turned `select * from reviews` into "permission
-- denied for function" for every reader on the site, signed in or not.
--
-- The endpoint is removed by placement instead. PostgREST exposes only the
-- schemas it is configured for — `public`, `graphql_public`, `storage` — so a
-- function in `private` is reachable from a policy and unreachable over HTTP.
-- Without that, `can_see_entry` would be an oracle answering "does A follow B?"
-- for any pair, and `entry_author` would answer "who wrote entry X?" for rows
-- the caller is not allowed to read.

/**
 * Whether the current viewer may see what somebody thought.
 *
 * True for your own entries, and for the entries of anybody you follow. False
 * for everybody else, and false for a signed-out reader, who follows nobody.
 *
 * Note the direction: `follower_id = auth.uid()` and `followee_id = author`.
 * Following somebody grants *you* sight of *their* opinions; it does not grant
 * them anything of yours. Two people who both want to read each other have to
 * follow each other, which is the same shape the feed's "Követettek" scope
 * already has.
 */
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
       )
     );
$$;

/**
 * Who wrote an entry.
 *
 * Exists because the insert policies on likes and comments have to ask a
 * question about a review row the caller may no longer select — see 0042, which
 * rewrites them. Reading `reviews` directly from those policies works today only
 * because the table is world-readable, which is precisely what is ending.
 */
create or replace function private.entry_author(entry uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.user_id from public.reviews r where r.id = entry;
$$;

grant execute on function private.can_see_entry(uuid) to anon, authenticated;
grant execute on function private.entry_author(uuid) to anon, authenticated;

-- The follow lookup now runs once per row of every feed page, so it gets the
-- index it has been doing without. `follows` is keyed (follower_id, followee_id)
-- as its primary key, which already serves this exact probe — this is here as a
-- note that the access path was checked, not as a new index.
--   \d public.follows  ->  follows_pkey PRIMARY KEY (follower_id, followee_id)

-- ---------------------------------------------------------------------------
-- The masked read surface
-- ---------------------------------------------------------------------------
--
-- Deliberately **not** `security_invoker`. The view runs as its owner and
-- applies the visibility rules itself, which is the whole point: it is the one
-- object allowed to read everybody's rows, and it hands back only what the
-- caller is entitled to. The Supabase linter flags owner-run views
-- (`security_definer_view`) and it is right to — the justification is that this
-- view exists to be exactly that, and every column it does not mask is a column
-- 0001 already published to the world.
--
-- The row rule is copied from `reviews_select_all` as 0037 left it rather than
-- inherited, because an owner-run view does not consult the base table's
-- policies. Getting this wrong would republish hidden and blocked entries
-- through the side door, so it is spelled out here and tested.
-- `can_see_entry` is called once per row through a lateral rather than once per
-- masked column. It is `stable`, so the planner is permitted to fold repeated
-- calls with the same argument, but permitted is not obliged — and this is a
-- follow lookup running on every row of every feed page, so the single
-- evaluation is written down rather than hoped for.
create or replace view public.reviews_readable as
select
  r.id,
  r.play_id,
  r.user_id,
  r.created_at,
  -- The attendance facts. Public, and the reason the feed still works as a way
  -- to find people worth following.
  r.seen_at,
  r.performance_id,
  r.is_rewatch,
  -- Everything below is the opinion, and answers only to `can_see_entry`.
  case when v.ok then r.rating_overall    end as rating_overall,
  case when v.ok then r.rating_acting     end as rating_acting,
  case when v.ok then r.rating_directing  end as rating_directing,
  case when v.ok then r.rating_set_design end as rating_set_design,
  case when v.ok then r.text else ''            end as text,
  case when v.ok then r.tags else '{}'::text[]  end as tags,
  case when v.ok then r.seat      end as seat,
  case when v.ok then r.price_huf end as price_huf,
  case when v.ok then r.stub_path end as stub_path,
  -- Counts are masked to 0 rather than null: `like_count` and `comment_count`
  -- are `not null` on the base table and the client treats them as numbers. A
  -- gated card shows no social row at all, so the value is never read — but it
  -- must not be the real one, or the size of a conversation you cannot see is
  -- still a fact about it.
  case when v.ok then r.like_count    else 0 end as like_count,
  case when v.ok then r.comment_count else 0 end as comment_count,
  -- So a screen can tell "not yours to see" from "they did not rate it". The
  -- two want different words, and without this the client would have to guess
  -- from a null, which is also what an unrated entry looks like since 0026.
  v.ok as can_see_opinion
from public.reviews r
cross join lateral (select private.can_see_entry(r.user_id) as ok) v
where r.user_id = auth.uid()
   or (not r.is_hidden and not private.blocked_between(r.user_id));

comment on view public.reviews_readable is
  'Diary entries as the current viewer may read them: attendance facts for '
  'everyone, opinion columns only for the author and the people who follow '
  'them. Owner-run on purpose — see 0041.';

grant select on public.reviews_readable to anon, authenticated;

commit;
