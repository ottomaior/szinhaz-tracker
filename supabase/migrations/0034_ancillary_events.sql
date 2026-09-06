-- Things a theatre puts on that are not productions.
--
-- Theatres publish more than plays: talks, building tours, workshops, book
-- launches, exhibitions, teachers' evenings. They sit in the same repertoire
-- lists the adapters read, so they arrive as `plays` rows and then appear in
-- Discover, in search and in onboarding as though you could go and watch them.
--
-- Csokonai's adapter already solves this at the source and solves it properly:
-- the theatre tags real productions with a genre taxonomy term and tags none of
-- its ancillary events, so "Csokonai Társalgó", "Színházbejárás", "Csokonai
-- közTér" and "PEDAGÓGUSTÉR" never become plays at all. Nothing equivalent
-- exists for the other sources — at Örkény a workshop and a real production are
-- indistinguishable in the data: both have no cast, no runtime, no showtimes
-- and a genre this project supplied from `venue_default` rather than the source.
--
-- So the remaining cases are caught by their titles, which is a heuristic, and
-- this migration is written to keep an inevitable mistake cheap:
--
--   * the classification is *stored*, not applied inside every query, so it can
--     be inspected, corrected by hand, and recomputed;
--   * the rows are kept, not deleted, so a diary entry pointing at one survives
--     and nothing is lost if the call was wrong;
--   * the vocabulary is deliberately narrow. The README's onboarding note
--     already argued that a title heuristic which quietly hides real work costs
--     more than a stray tile, and that still holds — so words that could plausibly
--     title a production are left out, even where a particular row looks like an
--     event. `felolvasószínház` is the clearest example: a staged reading is a
--     real thing to attend and log, and Örkény publishes it as a genre.

begin;

alter table public.plays
  -- Not a production: a talk, a tour, a workshop, a launch, an exhibition.
  -- Orthogonal to `is_archived` and to `status`, both of which describe a
  -- production's life rather than whether it is one.
  add column if not exists is_event boolean not null default false;

comment on column public.plays.is_event is
  'True for venue events that are not productions — talks, tours, workshops. '
  'Set by recompute_play_events(); excluded from browse, programme, search and '
  'onboarding, but kept so existing diary entries survive.';

-- ---------------------------------------------------------------------------
-- The vocabulary
-- ---------------------------------------------------------------------------
--
-- Matched against the unaccented, lower-cased title, so "PEDAGÓGUSTÉR" and
-- "Pedagógustér" are one pattern. Each entry is a phrase no production in this
-- catalogue is titled with — checked against all 1,205 rows before being added.
create or replace function public.is_ancillary_event(title text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(public.immutable_unaccent(coalesce(title, ''))) ~ (
    -- Workshops, at the start or after a separator: "Workshop: Országkórus",
    -- "Workshop a Megmenteni bárkit előadáshoz".
    '(^|[-–—:•|] *)workshop\M'
    -- Csokonai's own ancillary series. Their adapter already filters these on
    -- the genre taxonomy; the patterns are here so the same events cannot slip
    -- in from a source that publishes no taxonomy.
    || '|\mtarsalgo\M'
    || '|\mszinhazbejaras\M'
    || '|\mkozter\M'
    || '|\mpedagoguster\M'
    -- Visits and tours.
    || '|\mmuhelylatogatas\M'
    || '|\mtarlatvezetes\M'
    || '|\mnyilt nap\M'
    -- Launches, exhibitions, press.
    || '|\mkonyvbemutato\M'
    || '|kiallitas\M'
    || '|\msajtotajekoztato\M'
    || '|\mkozonsegtalalkozo\M'
  );
$$;

grant execute on function public.is_ancillary_event(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The pass
-- ---------------------------------------------------------------------------
--
-- Recomputed wholesale rather than incremented, like every other derived flag
-- in this schema: a row that stops matching — because the vocabulary was
-- narrowed, or a title was corrected upstream — comes back on its own.
--
-- Deliberately does **not** reclassify anything somebody has already logged.
-- If a person recorded attending a talk, that is a real evening they had, and
-- hiding the production it points at would take their diary entry with it.
create or replace function public.recompute_play_events()
returns int
language plpgsql
set search_path = public
as $function$
declare
  changed int;
begin
  update public.plays p
  set is_event = should_be
  from (
    select
      pl.id,
      public.is_ancillary_event(pl.title)
        and not exists (select 1 from public.reviews r where r.play_id = pl.id) as should_be
    from public.plays pl
  ) calc
  where p.id = calc.id and p.is_event is distinct from calc.should_be;
  get diagnostics changed = row_count;
  return changed;
end;
$function$;

revoke execute on function public.recompute_play_events() from public, anon, authenticated;
grant execute on function public.recompute_play_events() to service_role;

-- Browse, programme and onboarding all filter on this, so it is worth an index
-- — the flag is true for a handful of rows out of 1,205, which is exactly the
-- shape a partial index serves.
create index if not exists plays_not_event_idx on public.plays (id) where is_event = false;

select public.recompute_play_events();

commit;
