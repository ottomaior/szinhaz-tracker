-- The questionnaire drops the seat-and-price card: version 4.
--
-- Version 3 (0059) asked people to rank twelve things the app does. One of
-- them, "Ülőhely és jegyár" (`hely_ar_jegy`), stopped being true in September:
-- the check-in no longer asks for a seat or a price, and the ticket photo that
-- used to share the card is retired outright (0064, T-094). A questionnaire
-- that keeps asking people to rank it is re-proposing what the product has
-- decided against. Version 4 is version 3 with that card removed: three of
-- eleven, then three of the remaining eight, and the same six open items. The
-- lists live in scripts/research-design.ts; this is their copy. The function
-- body is 0059's verbatim; only the feature list and the version differ.
--
-- Additive. The version-2 and version-3 rows stay as they are — the check
-- constraint widens to admit 4, nothing is rewritten — and the function
-- accepts 4 only, because the page only ever sends the current version. The
-- report (scripts/research-report.ts) reads version 4 and counts the older
-- rows aloud rather than mixing vocabularies.

begin;

alter table public.research_responses drop constraint if exists research_responses_version_check;
alter table public.research_responses add constraint research_responses_version_check check (version in (2, 3, 4));

comment on column public.research_responses.picks is
  '{"best": [3 feature ids], "worst": [3 feature ids]} — the top three of eleven, and the three to leave out of the remaining eight. The ids are per version; see scripts/research-design.ts.';

create or replace function public.submit_research_response(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  feature_ids  text[] := array['musor_ma', 'naptar', 'kereses', 'idopontok_jegy', 'naplo', 'beugro',
                               'kivansaglista', 'listak', 'kovetes', 'velemeny_kovetoknek', 'evad_kartya'];
  miss_ids     text[] := array['tobb_varos', 'push', 'fuggetlen', 'regi_estek', 'ki_mikor_megy', 'angol'];
  miss_answers text[] := array['zavarna', 'mindegy', 'jobb_nelkule'];
  best_ids     text[];
  worst_ids    text[];
  k            text;
  v            jsonb;
  recent       int;
  new_id       uuid;
begin
  -- A honeypot field the form hides from people. A bot that fills it gets a
  -- cheerful `ok` and no row, which is the outcome least worth investigating.
  if coalesce(payload->>'website', '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  if jsonb_typeof(payload) <> 'object' then
    raise exception 'payload must be an object' using errcode = 'check_violation';
  end if;
  if pg_column_size(payload) > 12000 then
    raise exception 'payload too large' using errcode = 'check_violation';
  end if;
  if (payload->>'version')::int is distinct from 4 then
    raise exception 'unknown questionnaire version' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(payload->'behaviour') <> 'object' then
    raise exception 'behaviour must be an object' using errcode = 'check_violation';
  end if;

  -- Two lists of exactly three distinct real features, with nothing in both.
  if jsonb_typeof(payload->'picks') <> 'object'
     or jsonb_typeof(payload->'picks'->'best') <> 'array'
     or jsonb_typeof(payload->'picks'->'worst') <> 'array' then
    raise exception 'picks must hold a best and a worst list' using errcode = 'check_violation';
  end if;
  select array_agg(x) into best_ids  from jsonb_array_elements_text(payload->'picks'->'best') as x;
  select array_agg(x) into worst_ids from jsonb_array_elements_text(payload->'picks'->'worst') as x;
  if coalesce(array_length(best_ids, 1), 0) <> 3 or coalesce(array_length(worst_ids, 1), 0) <> 3 then
    raise exception 'pick exactly three on each screen' using errcode = 'check_violation';
  end if;
  if (select count(distinct x) from unnest(best_ids) x) <> 3 or (select count(distinct x) from unnest(worst_ids) x) <> 3 then
    raise exception 'a feature is picked twice' using errcode = 'check_violation';
  end if;
  if not (best_ids <@ feature_ids) or not (worst_ids <@ feature_ids) then
    raise exception 'picks name a feature that does not exist' using errcode = 'check_violation';
  end if;
  if best_ids && worst_ids then
    raise exception 'a feature cannot be both most valued and left out' using errcode = 'check_violation';
  end if;

  -- One answer per listed feature, from the vocabulary.
  if jsonb_typeof(payload->'missing') <> 'object' then
    raise exception 'missing must be an object' using errcode = 'check_violation';
  end if;
  for k, v in select * from jsonb_each(payload->'missing') loop
    if not (k = any(miss_ids)) then
      raise exception 'missing names an unknown feature' using errcode = 'check_violation';
    end if;
    if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(miss_answers)) then
      raise exception 'missing answer outside the vocabulary' using errcode = 'check_violation';
    end if;
  end loop;
  if (select count(*) from jsonb_object_keys(payload->'missing')) <> array_length(miss_ids, 1) then
    raise exception 'missing must answer every feature' using errcode = 'check_violation';
  end if;

  -- Thirty a minute is far above friends sharing a link and far below a loop.
  select count(*) into recent
    from public.research_responses
   where submitted_at > now() - interval '1 minute';
  if recent >= 30 then
    raise exception 'too many submissions right now, try again in a minute' using errcode = 'too_many_connections';
  end if;

  insert into public.research_responses
    (client_id, version, source, behaviour, picks, missing, open_answer, email)
  values (
    payload->>'client_id',
    4,
    nullif(left(payload->>'source', 40), ''),
    payload->'behaviour',
    jsonb_build_object('best', to_jsonb(best_ids), 'worst', to_jsonb(worst_ids)),
    payload->'missing',
    nullif(btrim(payload->>'open_answer'), ''),
    nullif(lower(btrim(payload->>'email')), '')
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

revoke all on function public.submit_research_response(jsonb) from public;
grant execute on function public.submit_research_response(jsonb) to anon, authenticated;

commit;

-- rollback: re-run the function from 0059 (twelve ids, `is distinct from 3`, inserts 3), then
--   alter table public.research_responses drop constraint research_responses_version_check;
--   alter table public.research_responses add constraint research_responses_version_check check (version in (2, 3));
-- The second statement fails while any version-4 row exists; those rows are
-- real answers, so that failure is the right outcome rather than something
-- to cascade past.
