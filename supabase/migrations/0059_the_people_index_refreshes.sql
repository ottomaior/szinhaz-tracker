-- The nightly people-index refresh has never run (T-072).
--
-- 0056 introduced `refresh_people_index()` and had `sync/run.ts` call it after
-- every sync, so a newly ingested performer becomes searchable overnight. The
-- first night it ran — 12 September, the morning after T-034 brought the
-- Nemzeti's guest companies in — it failed:
--
--     [people] index refresh failed: DELETE requires a WHERE clause
--
-- That is pg-safeupdate speaking. The `authenticator` role, which every
-- request through PostgREST runs as, has `session_preload_libraries =
-- supautils, safeupdate`, and safeupdate rejects any DELETE or UPDATE whose
-- parse tree has no WHERE clause — inside a SECURITY DEFINER function as
-- much as at top level, since it hooks the executor, not the role. The two
-- bare deletes in the function are exactly that. It had worked when the
-- migration itself called it, because the migration ran over a direct
-- connection as `postgres`, where nothing is preloaded.
--
-- The deletes gain `where true`. safeupdate's test is the *presence* of a
-- clause, not its selectivity, and the intent here really is the whole
-- table: the index is rebuilt from scratch every time, which 0056 argues is
-- the right shape at this size. The rest of the function is unchanged; so
-- is the reason it deletes rather than truncates.
--
-- Nothing user-stored changes. Applied to the project when written.

begin;

create or replace function public.refresh_people_index()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n int;
begin
  -- `where true`: see the header. A whole-table delete is the intent.
  delete from public.play_people where true;
  insert into public.play_people (play_id, slug, name, directed)
    select pc.play_id, pc.slug, public.person_canonical_name(pc.name), false
    from public.play_cast pc
    where pc.slug is not null
    union all
    select p.id, public.person_slug(dn.name), dn.name, true
    from public.plays p
    cross join lateral public.director_names(p.director) as dn(name)
    where public.person_slug(dn.name) is not null;

  delete from public.people_index where true;
  insert into public.people_index
    select * from public.people_index_rows(null);
  get diagnostics n = row_count;
  return n;
end;
$fn$;

commit;

-- rollback: re-create from 0056 lines 250-275 — and it fails again through
-- PostgREST, which is the point of this file.
