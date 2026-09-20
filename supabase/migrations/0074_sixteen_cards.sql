-- The questionnaire drops the "Appként a telefonon" card: sixteen features.
--
-- Version 5 (0073) rated seventeen features, and one of them was packaging
-- rather than a feature: that the app can be installed with an icon and has
-- five themes. Nobody opens the app because it has an icon, and nobody would
-- say "nem használnám" about a theme, so the card could only ever land in
-- the middle of the ranking and say nothing. Ottó asked for it to go on
-- 20 September, before any version-5 answer existed.
--
-- The submit function insists on exactly the listed feature ids, so this
-- replaces it with the sixteen. The body is 0073's verbatim except for the
-- id list; the version stays 5, because the instrument is the same
-- questionnaire minus a card and no answer has to be told apart. Deploy the
-- page and apply this together: a page with seventeen cards against this
-- function is refused with "ratings name an unknown feature", and a page
-- with sixteen against 0073's function with "ratings must answer every
-- feature".
--
-- Additive: no column changes. rollback: re-run the
-- `create or replace function public.submit_research_response(jsonb)`
-- statement from 0073.

begin;

create or replace function public.submit_research_response(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  feature_ids    text[] := array['musor_ma', 'naptar', 'kereses', 'szurok', 'idopontok_jegy',
                                 'naplo', 'szempontok', 'beugro', 'archivum', 'kivansaglista',
                                 'velemeny_kovetoknek', 'ismerosok', 'kovetes', 'listak',
                                 'ertesitesek', 'evad_kartya'];
  rating_answers text[] := array['ezert', 'jo', 'mindegy', 'nem'];
  miss_ids       text[] := array['tobb_varos', 'fuggetlen', 'regi_estek', 'tervezes', 'valtozas',
                                 'ki_mikor_megy', 'szinhaz_oldal', 'jegytarca', 'widget', 'angol'];
  miss_answers   text[] := array['zavarna', 'mindegy', 'jobb_nelkule'];
  best_ids       text[];
  k              text;
  v              jsonb;
  recent         int;
  new_id         uuid;
begin
  if coalesce(payload->>'website', '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  if jsonb_typeof(payload) <> 'object' then
    raise exception 'payload must be an object' using errcode = 'check_violation';
  end if;
  if pg_column_size(payload) > 16000 then
    raise exception 'payload too large' using errcode = 'check_violation';
  end if;
  if (payload->>'version')::int is distinct from 5 then
    raise exception 'unknown questionnaire version' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(payload->'behaviour') <> 'object' then
    raise exception 'behaviour must be an object' using errcode = 'check_violation';
  end if;

  if jsonb_typeof(payload->'ratings') <> 'object' then
    raise exception 'ratings must be an object' using errcode = 'check_violation';
  end if;
  for k, v in select * from jsonb_each(payload->'ratings') loop
    if not (k = any(feature_ids)) then
      raise exception 'ratings name an unknown feature' using errcode = 'check_violation';
    end if;
    if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(rating_answers)) then
      raise exception 'rating outside the vocabulary' using errcode = 'check_violation';
    end if;
  end loop;
  if (select count(*) from jsonb_object_keys(payload->'ratings')) <> array_length(feature_ids, 1) then
    raise exception 'ratings must answer every feature' using errcode = 'check_violation';
  end if;

  if jsonb_typeof(payload->'picks') <> 'object' or jsonb_typeof(payload->'picks'->'best') <> 'array' then
    raise exception 'picks must hold a best list' using errcode = 'check_violation';
  end if;
  select array_agg(x) into best_ids from jsonb_array_elements_text(payload->'picks'->'best') as x;
  if coalesce(array_length(best_ids, 1), 0) <> 3 then
    raise exception 'pick exactly three' using errcode = 'check_violation';
  end if;
  if (select count(distinct x) from unnest(best_ids) x) <> 3 then
    raise exception 'a feature is picked twice' using errcode = 'check_violation';
  end if;
  if not (best_ids <@ feature_ids) then
    raise exception 'picks name a feature that does not exist' using errcode = 'check_violation';
  end if;

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

  select count(*) into recent
    from public.research_responses
   where submitted_at > now() - interval '1 minute';
  if recent >= 30 then
    raise exception 'too many submissions right now, try again in a minute' using errcode = 'too_many_connections';
  end if;

  insert into public.research_responses
    (client_id, version, source, behaviour, ratings, picks, missing, missing_other, open_answer, email)
  values (
    payload->>'client_id',
    5,
    nullif(left(payload->>'source', 40), ''),
    payload->'behaviour',
    payload->'ratings',
    jsonb_build_object('best', to_jsonb(best_ids)),
    payload->'missing',
    nullif(left(btrim(payload->>'missing_other'), 300), ''),
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
