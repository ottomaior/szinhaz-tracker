-- Two derived-value triggers that could never write, and the account deletion
-- that could not get past them.
--
-- Written while building the `delete-account` Edge Function. Deleting an auth
-- user cascades into `reviews` and `lists`, and GoTrue performs that delete as
-- `supabase_auth_admin` — a role with no grants at all in `public`. Any trigger
-- the cascade fires therefore runs as that role, and both of the ones that fire
-- on DELETE tried to update a table it cannot touch. The whole delete rolled
-- back, and the API reported "Database error deleting user", which names the
-- layer and nothing else. Deleting the same row by hand as `postgres` worked
-- perfectly, which is what made it look like a permissions problem in the
-- function rather than in the schema.
--
-- Fixing that turned up the larger bug underneath it.
--
--
-- ## recompute_play_rating() has never once updated a rating
--
-- This is the exact fault `0032_likes_and_comments.sql` documented for the like
-- and comment counters, in the one place nobody went back and checked. The
-- trigger fires as whoever wrote the review, and the row it has to update is a
-- `plays` row that person does not own. `plays_update_own` from 0001 restricts
-- UPDATE to `created_by = auth.uid()`, so PostgREST narrowed the statement to
-- zero rows — and, as 0032 put it, an UPDATE that RLS filters to nothing is not
-- an error. The insert succeeded, the screen showed the new review, and the
-- production's public score never moved.
--
-- Measured on this database before the fix: of the 14 reviews carrying a
-- rating, 13 sat on productions still reading `rating_overall = 0.0` and
-- `rating_count = 0`. So the number on Play Detail, the histogram above the
-- log button, and the "Népszerű" rail that sorts by `rating_overall` were all
-- reading a column that ordinary use has never written. The one row that did
-- have a rating is the case that hid it: a play whose rater also created it,
-- which is precisely when the policy lets the update through.
--
-- `security definer` is not an optimisation here. It is the only way a trigger
-- can maintain a derived value on a row its actor may not write, which is what
-- a public average is by definition.
create or replace function public.recompute_play_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_play_id uuid;
begin
  target_play_id := coalesce(new.play_id, old.play_id);

  -- Unchanged from 0001 apart from the security context: average per person
  -- first and then across people, so somebody who saw a production three times
  -- carries one vote rather than three, and count people rather than rows.
  with per_user as (
    select
      user_id,
      avg(rating_overall)    as overall,
      avg(rating_acting)     as acting,
      avg(rating_directing)  as directing,
      avg(rating_set_design) as set_design
    from public.reviews
    where play_id = target_play_id
    group by user_id
  )
  update public.plays p set
    rating_overall    = coalesce((select round(avg(overall)::numeric, 1)    from per_user), 0),
    rating_acting     = coalesce((select round(avg(acting)::numeric, 1)     from per_user), 0),
    rating_directing  = coalesce((select round(avg(directing)::numeric, 1)  from per_user), 0),
    rating_set_design = coalesce((select round(avg(set_design)::numeric, 1) from per_user), 0),
    rating_count      = (select count(*) from per_user where overall is not null)
  where p.id = target_play_id;

  return null;
end;
$function$;


-- ## list_items_touch_list() has the same shape and the same fault
--
-- It stamps `updated_at` on the parent list, and `lists_update_own` restricts
-- UPDATE to the owner. On the ordinary path — you adding a production to your
-- own list — the owner and the actor are the same person, so it worked and
-- nothing looked wrong. It is only the cascade that exposed it, where the actor
-- is `supabase_auth_admin` and the statement fails outright rather than
-- quietly matching nothing.
--
-- Made definer for the same reason as above: a timestamp maintained by the
-- database is not the actor's write.
create or replace function public.list_items_touch_list()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.lists set updated_at = now()
  where id = coalesce(new.list_id, old.list_id);
  return null;
end;
$function$;


-- ## Neither of them is an RPC
--
-- Making a function `security definer` also makes it worth asking who may call
-- it. PostgREST exposes everything in `public`, so without this both would sit
-- at /rest/v1/rpc/ as functions that run with the owner's rights — which is
-- what the database linter's `anon_security_definer_function_executable` is
-- for, and it flagged both the moment they changed. They are trigger
-- functions; there is no caller other than the trigger.
--
-- Same line 0032 wrote for the like and comment recounts, for the same reason.
revoke execute on function public.recompute_play_rating() from public, anon, authenticated;
revoke execute on function public.list_items_touch_list() from public, anon, authenticated;

-- `handle_new_user()` from 0001 has been exposed the same way since the
-- beginning — it is `security definer` and inserts the `profiles` row — and the
-- linter reports it beside the two above. Closed here rather than left for a
-- migration of its own, since it is the same one-line fix and finding it again
-- later would mean re-deriving why it matters.
revoke execute on function public.handle_new_user() from public, anon, authenticated;


-- ## Correcting the rows the broken trigger left behind
--
-- Every production that has a review recomputed from the reviews themselves.
-- Written as one statement over the whole table rather than by re-firing the
-- trigger: the triggers are per-row, and this has to reach rows whose last
-- write predates the fix by months.
--
-- Productions with no reviews are deliberately not touched. Their zeros are
-- correct, and rewriting 1,200 rows to the values they already hold would put
-- a pointless bump in `plays` for no gain.
with per_user as (
  select
    play_id,
    user_id,
    avg(rating_overall)    as overall,
    avg(rating_acting)     as acting,
    avg(rating_directing)  as directing,
    avg(rating_set_design) as set_design
  from public.reviews
  group by play_id, user_id
),
per_play as (
  select
    play_id,
    coalesce(round(avg(overall)::numeric, 1), 0)    as overall,
    coalesce(round(avg(acting)::numeric, 1), 0)     as acting,
    coalesce(round(avg(directing)::numeric, 1), 0)  as directing,
    coalesce(round(avg(set_design)::numeric, 1), 0) as set_design,
    count(*) filter (where overall is not null)     as rater_count
  from per_user
  group by play_id
)
update public.plays p set
  rating_overall    = pp.overall,
  rating_acting     = pp.acting,
  rating_directing  = pp.directing,
  rating_set_design = pp.set_design,
  rating_count      = pp.rater_count
from per_play pp
where pp.play_id = p.id
  and (p.rating_overall    is distinct from pp.overall
    or p.rating_acting     is distinct from pp.acting
    or p.rating_directing  is distinct from pp.directing
    or p.rating_set_design is distinct from pp.set_design
    or p.rating_count      is distinct from pp.rater_count);


-- What the correction moved, printed rather than assumed. A plain SELECT
-- rather than a DO block, for the reason the other migrations give: the SQL
-- editor shows a result set and buries a RAISE NOTICE.
select
  count(*) filter (where rating_count > 0) as plays_with_a_rating,
  sum(rating_count)                        as ratings_counted
from public.plays;
