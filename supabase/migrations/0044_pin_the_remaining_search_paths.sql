-- Pin `search_path` on the twenty-five functions that were still without one.
--
-- A function with no `search_path` of its own resolves unqualified names against
-- whatever the caller's happens to be, so anyone able to create an object in a
-- schema earlier on that path decides which `unaccent`, or which `=` operator,
-- the function actually calls. Supabase's database linter reports this as
-- `function_search_path_mutable`; it reported it against 25 functions here.
-- See T-026 in ISSUES.md.
--
-- This is a half-finished job being finished, not a new idea. `0027` pinned
-- `profiles_guard_avatar_path` with the comment "cheap on a new function; the
-- older ones in this schema still carry the warning", and `0039` did the same
-- for the research-response pair. Every function written since has carried
-- `set search_path = public` in its own definition. These twenty-five are the
-- ones that predate the habit, and they are done here in one pass rather than
-- one at a time as each is next edited, which is how the count reached 25.
--
-- `= public` rather than `= ''`, matching every pinned function already in this
-- schema. It has to be `public` regardless: `unaccent` and `pg_trgm` are
-- installed in `public` on this project, so an empty path would break
-- `immutable_unaccent`, `search_norm` and everything built on them.
--
-- ALTER rather than CREATE OR REPLACE, so not a line of any function body is
-- touched. The bodies are spread across a dozen migrations and re-stating them
-- here would mean maintaining a second copy of each.
--
-- **What this deliberately leaves alone.** `pg_trgm` and `unaccent` also live in
-- `public`, so their own functions — `gtrgm_*`, `similarity*`, `word_similarity*`,
-- `unaccent(text)` and the rest — appear beside ours in `pg_proc` without a
-- pinned path. They belong to the extensions, an extension upgrade would replace
-- them anyway, and altering another owner's objects is not this schema's
-- business. The filter below is on `pg_depend`, not on a hand-written list.
--
-- **Why this is safe for the four expression indexes.** `search_norm()` and
-- `person_slug()` are indexed expressions on `plays` and `play_cast`. Setting a
-- function's configuration changes neither its body nor its declared
-- volatility, so the indexes stay valid and no reindex is needed — and because
-- the effective path was already `public`, the values they contain are
-- unchanged. Checked before and after against the same inputs: `Für Anikó m.v.`
-- still slugs to `fur-aniko`, `Örkény István Színház` still normalises to
-- `orkeny istvan szinhaz`.

do $$
declare
  fn record;
  pinned int := 0;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      -- Not already pinned, so this is re-runnable and says nothing about
      -- functions that were done properly when they were written.
      and (p.proconfig is null or not exists (
            select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
      -- Not owned by an extension.
      and not exists (
            select 1 from pg_depend d
            where d.objid = p.oid
              and d.classid = 'pg_proc'::regclass
              and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public', fn.signature);
    pinned := pinned + 1;
  end loop;

  raise notice 'pinned search_path on % function(s)', pinned;
end
$$;
