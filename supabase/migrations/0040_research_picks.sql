-- The questionnaire asks each feature at most twice, not nine screens of four.
--
-- 0039 built the textbook instrument: nine MaxDiff screens, four features on
-- each, best and worst. On a phone that reads as the same question nine times
-- over — the same twelve names keep coming round — and the first person to try
-- it said so. Version 2 asks the same trade-off in two screens: the three
-- features you value most out of twelve, then the three you would leave out of
-- the remaining nine. And the six Kano pairs ("if it had this / if it did not")
-- become one question each: if this were missing at launch, would it bother
-- you, not register, or be better left out. That is the dysfunctional half of
-- the pair, which is the half that separates "must have" from "nice to have".
--
-- No real answers had arrived under version 1, so the columns are renamed in
-- place rather than versioned side by side, and the function accepts version 2
-- only. `research_maxdiff_blocks()` has nothing left to describe and goes.

begin;

alter table public.research_responses rename column maxdiff to picks;
alter table public.research_responses rename column kano to missing;
alter table public.research_responses drop constraint if exists research_responses_version_check;
alter table public.research_responses add constraint research_responses_version_check check (version = 2);

comment on column public.research_responses.picks is
  '{"best": [3 feature ids], "worst": [3 feature ids]} — the top three of twelve, and the three to leave out of the remaining nine.';
comment on column public.research_responses.missing is
  '{feature id: "zavarna" | "mindegy" | "jobb_nelkule"} for the six features asked "if this were missing at launch".';

drop function if exists public.research_maxdiff_blocks();

create or replace function public.submit_research_response(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  feature_ids  text[] := array['musor_ma', 'naptar', 'kereses', 'idopontok_jegy', 'naplo', 'beugro',
                               'hely_ar_jegy', 'kivansaglista', 'listak', 'kovetes', 'baratok', 'evad_kartya'];
  miss_ids     text[] := array['ertesites', 'baratok', 'beugro', 'hely_ar_jegy', 'listak', 'evad'];
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
  if (payload->>'version')::int is distinct from 2 then
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
    2,
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
