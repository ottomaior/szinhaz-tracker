-- The questionnaire, counted for the dashboard (T-099, day two).
--
-- `scripts/research-report.ts` reads every answer with the service role and
-- writes a Markdown report; that is the document for a decision. The
-- dashboard wants the same tallies live, on a phone, without a terminal.
-- This function does the counting in SQL and hands back raw tallies keyed by
-- the ids the page submits; the labels, the ranking and the verdicts stay in
-- `scripts/research-design.ts`, which the app imports, so the dashboard and
-- the report cannot disagree about what a card is called.
--
-- One version at a time, chosen by the caller: the feature ids changed in
-- version 3 and a card was dropped in version 4, so a pick under an old id
-- would count for nothing or for the wrong card. Older rows are counted
-- aloud rather than mixed in, as the report does.
--
-- Behaviour answers come in two shapes — a scalar for the one radio question
-- and an array for the checkbox ones — and the `_mas` keys carry free text
-- that goes beside its question rather than into a tally. Open answers and
-- the free-text "other" fields are returned verbatim: this is the operator
-- reading what respondents wrote, which is what the questionnaire is for.
-- E-mail addresses are counted, never returned; the report's `--emails`
-- flag remains the only way to list them.
--
-- Operator-only, through the same gate as usage_stats(). Additive, reads
-- only. rollback: drop function public.research_stats(int).

begin;

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
    'best', (
      select coalesce(jsonb_object_agg(id, n), '{}'::jsonb)
      from (
        select x as id, count(*) as n
        from cur cross join lateral jsonb_array_elements_text(cur.picks -> 'best') x
        group by 1
      ) t
    ),
    'worst', (
      select coalesce(jsonb_object_agg(id, n), '{}'::jsonb)
      from (
        select x as id, count(*) as n
        from cur cross join lateral jsonb_array_elements_text(cur.picks -> 'worst') x
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

comment on function public.research_stats(int) is
  'The questionnaire tallied for one version: picks, missing-feature answers, behaviour, open answers. Raises for anyone but the operator.';

commit;
