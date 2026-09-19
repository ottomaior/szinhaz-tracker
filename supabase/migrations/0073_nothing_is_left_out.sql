-- The questionnaire, version 5: nothing is left out.
--
-- Versions 2 to 4 asked people to name three features to discard, and the
-- person who built the app could not answer it honestly: there are features
-- that matter less, not features that should go. Version 5 rates every one
-- of seventeen features on a four-point scale, then asks which three the
-- reader would open the app for; the missing-feature list grows from six to
-- ten; every multiple-choice question has an "Egyéb" option whose text
-- lands beside its question; the "about you" block gains who they go with,
-- the bérlet, and an optional age band; and a free-text field under the
-- missing list catches what the list forgot. `scripts/research-design.ts`
-- is the source of the ids below and says why each is there.
--
-- Two new columns, both nullable, both additive: `ratings` for the seventeen
-- answers and `missing_other` for the free text. The version check widens to
-- admit 5; the older values stay admitted so that the constraint never has
-- to be touched again. The three rows from versions 2 and 3 were deleted by
-- hand the same day at Ottó's word — all three were his own tests — which is
-- data, not schema, and is recorded under T-111 in ISSUES.md.
--
-- `submit_research_response()` is replaced whole, as 0059 and 0068 did:
-- the checks are the same shape (vocabulary, counts, honeypot, rate limit)
-- applied to the new payload, and it accepts version 5 only, because the
-- page only ever sends the current version. `research_stats()` learns the
-- two new fields.
--
-- rollback: the columns can be dropped (`alter table public.research_responses
-- drop column ratings, drop column missing_other`) once no version-5 row is
-- wanted; the two functions are restored by re-running their statements from
-- 0068 and 0072. Rows submitted under version 5 would lose their ratings.

begin;

alter table public.research_responses add column if not exists ratings jsonb;
alter table public.research_responses add column if not exists missing_other text;

alter table public.research_responses drop constraint if exists research_responses_version_check;
alter table public.research_responses add constraint research_responses_version_check check (version in (2, 3, 4, 5));

alter table public.research_responses drop constraint if exists research_responses_missing_other_check;
alter table public.research_responses add constraint research_responses_missing_other_check
  check (missing_other is null or char_length(missing_other) <= 300);

comment on column public.research_responses.ratings is
  '{feature id: "ezert" | "jo" | "mindegy" | "nem"} for every feature the app has (version 5 onwards). The ids are per version; see scripts/research-design.ts.';
comment on column public.research_responses.picks is
  '{"best": [3 feature ids]} — the three the respondent would open the app for. Versions 2–4 also carried "worst". The ids are per version; see scripts/research-design.ts.';
comment on column public.research_responses.missing is
  '{feature id: "zavarna" | "mindegy" | "jobb_nelkule"} for the not-yet-built features asked "would you miss this". The ids are per version.';
comment on column public.research_responses.missing_other is
  'What the respondent typed under the missing list: something the list forgot. At most 300 characters.';

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
                                 'ertesitesek', 'evad_kartya', 'appkent'];
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
  -- A honeypot field the form hides from people. A bot that fills it gets a
  -- cheerful `ok` and no row, which is the outcome least worth investigating.
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

  -- One rating per feature, from the vocabulary, and nothing that is not a feature.
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

  -- Exactly three distinct real features on the "which three" screen.
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

  -- One answer per listed missing feature, from the vocabulary.
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

create or replace function public.research_stats(v int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_operator() then
    raise insufficient_privilege using message = 'research_stats() is for the operator';
  end if;

  with cur as (
    select * from public.research_responses where version = v
  )
  select jsonb_build_object(
    'version', v,
    'total', (select count(*) from public.research_responses),
    'current', (select count(*) from cur),
    'older', (select count(*) from public.research_responses where version <> v),
    'first_at', (select min(submitted_at) from cur),
    'last_at', (select max(submitted_at) from cur),
    'with_email', (select count(*) from cur where email is not null),
    'sources', (
      select coalesce(jsonb_object_agg(coalesce(source, ''), n), '{}'::jsonb)
      from (select source, count(*) as n from cur group by 1) s
    ),
    'ratings', (
      select coalesce(jsonb_object_agg(id, answers), '{}'::jsonb)
      from (
        select key as id, jsonb_object_agg(answer, n) as answers
        from (
          select r.key, r.value #>> '{}' as answer, count(*) as n
          from cur cross join lateral jsonb_each(coalesce(cur.ratings, '{}'::jsonb)) r
          group by 1, 2
        ) q
        group by 1
      ) t
    ),
    'best', (
      select coalesce(jsonb_object_agg(id, n), '{}'::jsonb)
      from (
        select x as id, count(*) as n
        from cur cross join lateral jsonb_array_elements_text(coalesce(cur.picks -> 'best', '[]'::jsonb)) x
        group by 1
      ) t
    ),
    'worst', (
      select coalesce(jsonb_object_agg(id, n), '{}'::jsonb)
      from (
        select x as id, count(*) as n
        from cur cross join lateral jsonb_array_elements_text(coalesce(cur.picks -> 'worst', '[]'::jsonb)) x
        group by 1
      ) t
    ),
    'missing', (
      select coalesce(jsonb_object_agg(id, answers), '{}'::jsonb)
      from (
        select key as id, jsonb_object_agg(answer, n) as answers
        from (
          select m.key, m.value #>> '{}' as answer, count(*) as n
          from cur cross join lateral jsonb_each(cur.missing) m
          group by 1, 2
        ) q
        group by 1
      ) t
    ),
    'missing_other', (
      select coalesce(jsonb_agg(missing_other order by submitted_at), '[]'::jsonb)
      from cur
      where missing_other is not null
    ),
    'behaviour', (
      select coalesce(jsonb_object_agg(key, opts), '{}'::jsonb)
      from (
        select key, jsonb_object_agg(opt, n) as opts
        from (
          select b.key,
                 case when jsonb_typeof(b.value) = 'array' then e.val else b.value #>> '{}' end as opt,
                 count(*) as n
          from cur
          cross join lateral jsonb_each(cur.behaviour) b
          left join lateral jsonb_array_elements_text(
            case when jsonb_typeof(b.value) = 'array' then b.value else '[]'::jsonb end
          ) e(val) on true
          where b.key not like '%\_mas'
          group by 1, 2
        ) q
        where opt is not null
        group by 1
      ) t
    ),
    'behaviour_other', (
      select coalesce(jsonb_object_agg(key, texts), '{}'::jsonb)
      from (
        select b.key, jsonb_agg(b.value #>> '{}') as texts
        from cur cross join lateral jsonb_each(cur.behaviour) b
        where b.key like '%\_mas' and length(btrim(b.value #>> '{}')) > 0
        group by 1
      ) t
    ),
    'open_answers', (
      select coalesce(jsonb_agg(open_answer order by submitted_at), '[]'::jsonb)
      from cur
      where open_answer is not null and length(btrim(open_answer)) > 0
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.research_stats(int) from public;
grant execute on function public.research_stats(int) to authenticated;

commit;
