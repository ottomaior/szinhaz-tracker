-- The weekly letter's inbox section learns the two follow kinds (T-095).
--
-- 0063's `inbox_since` joined `plays` on `notifications.play_id`, which was
-- `not null` at the time. 0065 made it nullable for `follow_requested` and
-- `follow_accepted`, whose subject is a person, so an inner join would drop
-- exactly those rows from the letter. Left join, and the title falls back
-- to the person's name from the payload, which is what the app's inbox
-- prints for the same rows. Everything else in the function is 0063 verbatim.

begin;

create or replace function public.weekly_digest(
  for_user uuid,
  from_ts timestamptz,
  to_ts timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
  watchlist_week as (
    select
      pl.id as play_id,
      pl.title,
      v.name as venue,
      pf.starts_at,
      pf.room
    from public.watchlist_entries w
    join public.plays pl on pl.id = w.play_id
    join public.performances pf on pf.play_id = pl.id
    join public.venues v on v.id = pf.venue_id
    where w.user_id = for_user
      and pf.starts_at >= from_ts
      and pf.starts_at < to_ts
    order by pf.starts_at
    limit 12
  ),
  followed_week as (
    select distinct on (pl.id)
      pl.id as play_id,
      pl.title,
      v.name as venue,
      min(pf.starts_at) over (partition by pl.id) as first_starts_at,
      count(*) over (partition by pl.id) as nights
    from public.subject_follows sf
    join public.venues v on v.id::text = sf.subject_key
    join public.performances pf on pf.venue_id = v.id
    join public.plays pl on pl.id = pf.play_id
    where sf.user_id = for_user
      and sf.subject_type = 'venue'
      and pf.starts_at >= from_ts
      and pf.starts_at < to_ts
      and coalesce(pl.is_event, false) = false
      and pl.id not in (select play_id from watchlist_week)
    order by pl.id, pf.starts_at
  ),
  inbox_since as (
    select
      n.kind,
      n.play_id,
      n.review_id,
      coalesce(pl.title, n.payload->>'person', '') as title,
      n.payload,
      n.created_at
    from public.notifications n
    left join public.plays pl on pl.id = n.play_id
    where n.user_id = for_user
      and n.created_at >= from_ts
      and n.created_at < to_ts
    order by n.created_at desc
    limit 20
  )
  select jsonb_build_object(
    'name', (select p.name from public.profiles p where p.id = for_user),
    'city', (select p.city from public.profiles p where p.id = for_user),
    'watchlist', coalesce((select jsonb_agg(to_jsonb(w) order by w.starts_at) from watchlist_week w), '[]'::jsonb),
    'followed', coalesce((select jsonb_agg(to_jsonb(f) order by f.first_starts_at) from (select * from followed_week order by first_starts_at limit 12) f), '[]'::jsonb),
    'inbox', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from inbox_since i), '[]'::jsonb)
  );
$$;

commit;

-- rollback:
--   re-run the `create or replace function public.weekly_digest` block from
--   0063_the_weekly_letter.sql (inner join, `pl.title` alone).
