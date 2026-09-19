-- Usage numbers straight from the database (T-099), for the operator alone.
--
-- Cloudflare's beacon says how many people came to the two hosts; the Play
-- Console says how many installed. Neither says whether anybody signed up,
-- wrote an entry, or came back — and those rows are already here, read by
-- nobody. This is one function that counts them, and a screen in the app
-- (`/stats`) that shows the result to the one account allowed to ask.
--
-- Why a function and not a view: a view would need row-level policies to keep
-- it private, and a policy on an aggregate is a lie waiting to be told. A
-- `security definer` function that checks the caller first and raises for
-- anyone else is the same gate the row-level policies use everywhere else
-- (`auth.uid()`), just applied once at the door.
--
-- Who counts as "the operator": the account signed in with the address that
-- runs the project. Hard-coding an address rather than a uuid, because the
-- uuid is a generated id and this file has to say who it means.
--
-- Who is *not* counted: the three demo accounts (Tóth Eszter, Kovács Bence,
-- Nagy Zsófia, kept since September for screenshots) and the operator's own
-- account. A dashboard that counted them as users would be reading its own
-- reflection. Their number is reported separately so the exclusion is visible.
--
-- "Active" is a proxy. `auth.users.last_sign_in_at` moves only on a fresh
-- sign-in, not on a session that simply refreshes, so on its own it undercounts
-- a person who installed once and opens the app daily. It is therefore taken
-- together with the newest thing the account did — an entry, a like, a
-- comment, a follow, a wishlist add — and with `push_subscriptions.last_seen_at`,
-- which the app touches on every launch where push is on. The greatest of
-- those is "last seen".
--
-- Additive: two functions, no table touched. Reads only.

begin;

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.email = 'ottomaior94@gmail.com' from auth.users u where u.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_operator() from public;
grant execute on function public.is_operator() to authenticated;

comment on function public.is_operator() is
  'True for the one account that runs Vastaps. What /stats and usage_stats() check.';

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
    select u.id from auth.users u where u.email = 'ottomaior94@gmail.com'
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
      'operator', 1
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
