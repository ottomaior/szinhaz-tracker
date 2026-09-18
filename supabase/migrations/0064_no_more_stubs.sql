-- The ticket photo's remains come out of the database (T-094).
--
-- Ottó took the feature out of the app on 18 September 2026, on privacy
-- grounds: a ticket carries the person's name and a booking code, and the
-- `stubs` bucket was public. The app half shipped the same day (PR #38): no
-- screen reads, writes or shows `stub_path` any more. This is the destructive
-- half, in the additive-then-destructive order the migration rules ask for,
-- and it argues its own safety:
--
--   * `select count(*) from public.reviews where stub_path is not null` was
--     0 before this file was written, and had been 0 for the feature's whole
--     life — the check-in form stopped asking before anybody used it. No
--     stored answer is lost by dropping the column.
--   * `storage.objects` under `stubs` held one file, `e595572b-…/s.png` from
--     6 September 2026, uploaded during development and referenced by no
--     row. Ottó said to delete it. Both the object and the bucket are removed
--     through the Storage API before this runs, not in SQL: Storage's
--     `protect_delete` trigger refuses a `delete from storage.buckets` or
--     `storage.objects` outright (found when the first attempt at this file
--     rolled back), because a row deleted in SQL leaves its bytes orphaned in
--     the store. So this file drops the policies, which are ordinary Postgres
--     objects, and asserts the bucket is already gone rather than removing it.
--   * `public.reviews_readable` (0041) exposes `stub_path` as a masked
--     column, so the column cannot be dropped underneath it — and there is no
--     `cascade` here on purpose. The view is dropped and recreated without
--     that one column, otherwise identical to 0041, including the grant and
--     the comment. `friends_ratings` and `friends_recent_plays` read the view
--     by name and never select `stub_path`, so they are untouched; the client
--     reads `select("*")` and no longer types the column.
--   * `reviews_guard_stub_path` (trigger and function) guarded a column that
--     will not exist. Nothing else calls the function; checked by reading
--     every function body in `public` and `private` for the word.
--   * The four storage policies on `stubs` are dropped by name, the same four
--     0028 created. `supabase/functions/delete-account` had a `stubs` branch
--     in its bucket sweep; it is removed in the same PR, and would in any case
--     only have listed an absent bucket and moved on.
--
-- What this cannot undo: the one deleted object. Everything else below is
-- structure, and the rollback block puts it back.

begin;

-- ---------------------------------------------------------------------------
-- 1. The view, without the column
-- ---------------------------------------------------------------------------

drop view public.reviews_readable;

create view public.reviews_readable as
select
  r.id,
  r.play_id,
  r.user_id,
  r.created_at,
  r.seen_at,
  r.performance_id,
  r.is_rewatch,
  case when v.ok then r.rating_overall    end as rating_overall,
  case when v.ok then r.rating_acting     end as rating_acting,
  case when v.ok then r.rating_directing  end as rating_directing,
  case when v.ok then r.rating_set_design end as rating_set_design,
  case when v.ok then r.text else ''            end as text,
  case when v.ok then r.tags else '{}'::text[]  end as tags,
  case when v.ok then r.seat      end as seat,
  case when v.ok then r.price_huf end as price_huf,
  case when v.ok then r.like_count    else 0 end as like_count,
  case when v.ok then r.comment_count else 0 end as comment_count,
  v.ok as can_see_opinion
from public.reviews r
cross join lateral (select private.can_see_entry(r.user_id) as ok) v
where r.user_id = auth.uid()
   or (not r.is_hidden and not private.blocked_between(r.user_id));

comment on view public.reviews_readable is
  'Diary entries as the current viewer may read them: attendance facts for '
  'everyone, opinion columns only for the author and the people who follow '
  'them. Owner-run on purpose — see 0041. stub_path came off in 0064.';

grant select on public.reviews_readable to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The trigger, its function, the column
-- ---------------------------------------------------------------------------

drop trigger if exists reviews_guard_stub_path on public.reviews;
drop function if exists public.reviews_guard_stub_path();
alter table public.reviews drop column stub_path;

-- ---------------------------------------------------------------------------
-- 3. The bucket and its policies
-- ---------------------------------------------------------------------------

drop policy if exists "stubs are publicly readable" on storage.objects;
drop policy if exists "users upload their own stubs" on storage.objects;
drop policy if exists "users replace their own stubs" on storage.objects;
drop policy if exists "users delete their own stubs" on storage.objects;

-- The bucket itself is deleted through the Storage API (see the note at the
-- top); this only refuses to finish if that has not happened, so the policies
-- cannot come off a bucket that still exists.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'stubs') then
    raise exception 'stubs bucket still exists; delete it through the Storage API first (DELETE /storage/v1/bucket/stubs)';
  end if;
end $$;

commit;

-- rollback:
--   -- The structure. The one object is gone for good.
--   -- Recreate the bucket through the Storage API (POST /storage/v1/bucket
--   -- {"id":"stubs","name":"stubs","public":true}); SQL inserts are refused too.
--   -- then re-run the four `create policy … on storage.objects` blocks, the
--   -- `reviews_guard_stub_path` function and trigger, from 0028_the_evening_itself.sql;
--   alter table public.reviews add column stub_path text;
--   -- and re-run the `create or replace view public.reviews_readable` block,
--   -- its comment and grant, from 0041 (which includes the stub_path case).
