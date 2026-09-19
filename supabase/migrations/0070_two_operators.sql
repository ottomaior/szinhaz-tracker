-- A second operator (T-099, day two).
--
-- 0069 named the operator by one address, in two places: the gate in
-- `is_operator()` and the exclusion list inside `usage_stats()`. Ottó has a
-- second account, ottomaior@protonmail.com, and wants it to see the
-- dashboard too. Rather than write the address into both places again, the
-- list moves into one function and both read it; the next address is a
-- one-line change here, not a copy of a 150-line body.
--
-- 0069 is applied and stays as it is. This replaces both functions with the
-- same behaviour for the same callers plus the new one. `usage_stats()` is
-- 0069's body verbatim except for the two lines that name the operator: the
-- exclusion, and the "operator" count in `excluded`, which now says how many
-- accounts the list actually matches rather than assuming one.
--
-- Additive, reads only. rollback: re-run the two `create or replace`
-- statements from 0069 and `drop function public.operator_emails()`.

begin;

create or replace function public.operator_emails()
returns text[]
language sql
immutable
as $$
  select array['ottomaior94@gmail.com', 'ottomaior@protonmail.com'];
$$;

revoke all on function public.operator_emails() from public;

comment on function public.operator_emails() is
  'The accounts that run Vastaps: what is_operator() admits and usage_stats() leaves out of the counts.';

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.email = any(public.operator_emails()) from auth.users u where u.id = auth.uid()),
    false
  );
$$;

create or replace function public.usage_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  demo_handles constant text[] := array['totheszter', 'kovacsbence', 'nagyzsofia'];
  result jsonb;
begin
  if not public.is_operator() then
    raise insufficient_privilege using message = 'usage_stats() is for the operator';
  end if;

  with excluded as (
    -- Demo accounts and the operator: present in the tables, not users.
    select p.id from public.profiles p where p.handle = any(demo_handles)
    union
    select u.id from auth.users u where u.email = any(public.operator_emails())
  ),
  people as (
    select
      u.id,
      u.created_at,
      u.email_confirmed_at,
      u.last_sign_in_at,
      p.handle,
      p.name,
      p.city,
      p.onboarded_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id not in (select id from excluded)
  ),
  last_seen as (
    select
      pe.id,
      greatest(
        pe.last_sign_in_at,
        (select max(r.created_at) from public.reviews r where r.user_id = pe.id),
        (select max(l.created_at) from public.review_likes l where l.user_id = pe.id),
        (select max(c.created_at) from public.review_comments c where c.user_id = pe.id),
        (select max(f.created_at) from public.follows f where f.follower_id = pe.id),
        (select max(w.added_at) from public.watchlist_entries w where w.user_id = pe.id),
        (select max(s.last_seen_at) from public.push_subscriptions s where s.user_id = pe.id)
      ) as at
    from people pe
  ),
  entries as (
    select r.* from public.reviews r
    where r.user_id not in (select id from excluded)
  ),
  days as (
    select d::date as day
    from generate_series(
      (now() at time zone 'Europe/Budapest')::date - 13,
      (now() at time zone 'Europe/Budapest')::date,
      interval '1 day'
    ) d
  )
  select jsonb_build_object(
    'generated_at', now(),
    'excluded', jsonb_build_object(
      'demo', (select count(*) from public.profiles p where p.handle = any(demo_handles)),
      'operator', (select count(*) from auth.users u where u.email = any(public.operator_emails()))
    ),
    'accounts', jsonb_build_object(
      'total', (select count(*) from people),
      'confirmed', (select count(*) from people where email_confirmed_at is not null),
      'onboarded', (select count(*) from people where onboarded_at is not null),
      'new_7d', (select count(*) from people where created_at >= now() - interval '7 days'),
      'new_30d', (select count(*) from people where created_at >= now() - interval '30 days'),
      'active_1d', (select count(*) from last_seen where at >= now() - interval '1 day'),
      'active_7d', (select count(*) from last_seen where at >= now() - interval '7 days'),
      'active_30d', (select count(*) from last_seen where at >= now() - interval '30 days')
    ),
    'signups_by_day', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(c.n, 0)) order by d.day)
      from days d
      left join (
        select (created_at at time zone 'Europe/Budapest')::date as day, count(*) as n
        from people group by 1
      ) c on c.day = d.day
    ),
    'entries', jsonb_build_object(
      'total', (select count(*) from entries),
      'rated', (select count(*) from entries where rating_overall is not null),
      'with_text', (select count(*) from entries where length(btrim(text)) > 0),
      'last_7d', (select count(*) from entries where created_at >= now() - interval '7 days'),
      'last_30d', (select count(*) from entries where created_at >= now() - interval '30 days'),
      'authors_30d', (select count(distinct user_id) from entries where created_at >= now() - interval '30 days'),
      'by_day', (
        select jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(c.n, 0)) order by d.day)
        from days d
        left join (
          select (created_at at time zone 'Europe/Budapest')::date as day, count(*) as n
          from entries group by 1
        ) c on c.day = d.day
      )
    ),
    'social', jsonb_build_object(
      'follows_accepted', (
        select count(*) from public.follows f
        where f.status = 'accepted'
          and f.follower_id not in (select id from excluded)
          and f.followee_id not in (select id from excluded)
      ),
      'follows_pending', (
        select count(*) from public.follows f
        where f.status = 'pending' and f.follower_id not in (select id from excluded)
      ),
      'likes', (select count(*) from public.review_likes l where l.user_id not in (select id from excluded)),
      'comments', (select count(*) from public.review_comments c where c.user_id not in (select id from excluded)),
      'watchlist', (select count(*) from public.watchlist_entries w where w.user_id not in (select id from excluded)),
      'lists', (select count(*) from public.lists l where l.owner_id not in (select id from excluded)),
      'subject_follows', (select count(*) from public.subject_follows s where s.user_id not in (select id from excluded))
    ),
    'devices', jsonb_build_object(
      'push_expo', (
        select count(distinct s.user_id) from public.push_subscriptions s
        where s.platform = 'expo' and s.user_id not in (select id from excluded)
      ),
      'push_web', (
        select count(distinct s.user_id) from public.push_subscriptions s
        where s.platform = 'web' and s.user_id not in (select id from excluded)
      ),
      'digest_enabled', (
        select count(*) from public.notification_preferences n
        where n.digest_enabled and n.user_id not in (select id from excluded)
      )
    ),
    'research', jsonb_build_object(
      'responses', (select count(*) from public.research_responses),
      'with_email', (select count(*) from public.research_responses where email is not null)
    ),
    'recent_accounts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'handle', pe.handle,
        'name', pe.name,
        'city', pe.city,
        'joined', pe.created_at,
        'last_seen', ls.at,
        'entries', (select count(*) from entries e where e.user_id = pe.id),
        'confirmed', pe.email_confirmed_at is not null
      ) order by pe.created_at desc), '[]'::jsonb)
      from (select * from people order by created_at desc limit 12) pe
      join last_seen ls on ls.id = pe.id
    ),
    'catalogue', jsonb_build_object(
      'plays', (select count(*) from public.plays where not is_archived and not is_event),
      'venues', (select count(*) from public.venues),
      'upcoming_performances', (select count(*) from public.performances where starts_at >= now()),
      'last_sync_finished_at', (select max(finished_at) from public.sync_runs),
      'sync_errors_24h', (
        select count(*) from public.sync_runs
        where error is not null and started_at >= now() - interval '1 day'
      )
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.usage_stats() from public;
grant execute on function public.usage_stats() to authenticated;

comment on function public.usage_stats() is
  'Sign-ups, entries, activity and devices as one JSON document, excluding the demo accounts and the operator. Raises for anyone but the operator.';

commit;
