-- szinhaz-tracker: initial schema, RLS, triggers, and RPCs.
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- against a fresh project. Idempotent-ish: safe to re-run only up to the
-- `create table` statements, which will error if already applied — this is
-- a first-run migration, not a repeatable one.

-- ============================================================
-- Tables
-- ============================================================

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('kőszínház','független','befogadó tér','szabadtéri')),
  city text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  handle text not null unique,
  city text,
  initials text not null,
  created_at timestamptz not null default now()
);

create table public.plays (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  director text not null,
  venue_id uuid not null references public.venues(id),
  genre text not null,
  runtime_minutes int,
  intermissions int not null default 0,
  premiere_date date,
  synopsis text,
  poster_url text,
  rating_overall numeric(2,1) not null default 0,
  rating_acting numeric(2,1) not null default 0,
  rating_directing numeric(2,1) not null default 0,
  rating_set_design numeric(2,1) not null default 0,
  rating_count int not null default 0,
  source text not null default 'user' check (source in ('seed','user','sync')),
  source_key text,
  last_synced_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source, source_key)
);

create table public.play_cast (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays(id) on delete cascade,
  name text not null,
  role text not null,
  sort_order int not null default 0,
  unique (play_id, name, role)
);

create table public.performances (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays(id) on delete cascade,
  venue_id uuid not null references public.venues(id),
  room text,
  starts_at timestamptz not null,
  source text not null default 'user' check (source in ('seed','user','sync')),
  source_key text,
  created_at timestamptz not null default now(),
  unique (source, source_key)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  rating_overall numeric(2,1) not null check (rating_overall between 0.5 and 5),
  rating_acting numeric(2,1) check (rating_acting between 0.5 and 5),
  rating_directing numeric(2,1) check (rating_directing between 0.5 and 5),
  rating_set_design numeric(2,1) check (rating_set_design between 0.5 and 5),
  text text not null default '',
  tags text[] not null default '{}',
  like_count int not null default 0,
  comment_count int not null default 0
);

create table public.watchlist_entries (
  play_id uuid not null references public.plays(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (play_id, user_id)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  plays_upserted int not null default 0,
  performances_upserted int not null default 0,
  error text
);

create index on public.plays (venue_id);
create index on public.play_cast (play_id);
create index on public.performances (play_id);
create index on public.performances (venue_id, starts_at);
create index on public.reviews (play_id);
create index on public.reviews (user_id);
create index on public.watchlist_entries (user_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.venues enable row level security;
create policy "venues_select_all" on public.venues for select using (true);
create policy "venues_insert_auth" on public.venues for insert to authenticated
  with check (created_by = auth.uid());

alter table public.profiles enable row level security;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert
  with check (auth.uid() = id);

alter table public.plays enable row level security;
create policy "plays_select_all" on public.plays for select using (true);
create policy "plays_insert_auth" on public.plays for insert to authenticated
  with check (created_by = auth.uid());
create policy "plays_update_own" on public.plays for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "plays_delete_own" on public.plays for delete
  using (created_by = auth.uid());

alter table public.performances enable row level security;
create policy "performances_select_all" on public.performances for select using (true);
create policy "performances_write_own_play" on public.performances for all
  using (exists (select 1 from public.plays p where p.id = play_id and p.created_by = auth.uid()))
  with check (exists (select 1 from public.plays p where p.id = play_id and p.created_by = auth.uid()));

alter table public.play_cast enable row level security;
create policy "play_cast_select_all" on public.play_cast for select using (true);
create policy "play_cast_write_own_play" on public.play_cast for all
  using (exists (select 1 from public.plays p where p.id = play_id and p.created_by = auth.uid()))
  with check (exists (select 1 from public.plays p where p.id = play_id and p.created_by = auth.uid()));

alter table public.reviews enable row level security;
create policy "reviews_select_all" on public.reviews for select using (true);
create policy "reviews_insert_own" on public.reviews for insert to authenticated
  with check (user_id = auth.uid());
create policy "reviews_update_own" on public.reviews for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews_delete_own" on public.reviews for delete
  using (user_id = auth.uid());

alter table public.watchlist_entries enable row level security;
create policy "watchlist_select_all" on public.watchlist_entries for select using (true);
create policy "watchlist_insert_own" on public.watchlist_entries for insert to authenticated
  with check (user_id = auth.uid());
create policy "watchlist_delete_own" on public.watchlist_entries for delete
  using (user_id = auth.uid());

-- internal ops table: RLS enabled, no policies -> no client access at all.
-- Only the service-role key (which bypasses RLS) can read/write it.
alter table public.sync_runs enable row level security;

-- ============================================================
-- Auth -> profile linkage
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, handle, initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'gi')) || '_' || substr(new.id::text, 1, 6),
    upper(left(coalesce(new.raw_user_meta_data->>'name', new.email), 2))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Ratings: keep plays.rating_* in sync with reviews
-- ============================================================

create or replace function public.recompute_play_rating()
returns trigger
language plpgsql
as $$
declare
  target_play_id uuid;
begin
  target_play_id := coalesce(new.play_id, old.play_id);

  update public.plays p set
    rating_overall = coalesce((select round(avg(rating_overall)::numeric, 1) from public.reviews where play_id = target_play_id), 0),
    rating_acting = coalesce((select round(avg(rating_acting)::numeric, 1) from public.reviews where play_id = target_play_id and rating_acting is not null), 0),
    rating_directing = coalesce((select round(avg(rating_directing)::numeric, 1) from public.reviews where play_id = target_play_id and rating_directing is not null), 0),
    rating_set_design = coalesce((select round(avg(rating_set_design)::numeric, 1) from public.reviews where play_id = target_play_id and rating_set_design is not null), 0),
    rating_count = coalesce((select count(*) from public.reviews where play_id = target_play_id), 0)
  where p.id = target_play_id;

  return null;
end;
$$;

create trigger reviews_recompute_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recompute_play_rating();

-- ============================================================
-- Search
-- ============================================================

create or replace function public.search_plays(search_term text, venue_type_filter text default null)
returns setof public.plays
language sql stable
as $$
  select distinct p.*
  from public.plays p
  left join public.venues v on v.id = p.venue_id
  left join public.play_cast c on c.play_id = p.id
  where (
    p.title ilike '%' || search_term || '%'
    or p.author ilike '%' || search_term || '%'
    or p.genre ilike '%' || search_term || '%'
    or v.name ilike '%' || search_term || '%'
    or c.name ilike '%' || search_term || '%'
  )
  and (venue_type_filter is null or v.type = venue_type_filter)
  order by p.title;
$$;

grant execute on function public.search_plays(text, text) to anon, authenticated;

-- ============================================================
-- Atomic "add a play" (play + cast rows in one round trip)
-- ============================================================

create or replace function public.create_play_with_cast(
  play jsonb,
  cast_members jsonb default '[]'::jsonb
)
returns public.plays
language plpgsql
security invoker
as $$
declare
  new_play public.plays;
  member jsonb;
  idx int := 0;
begin
  insert into public.plays (
    title, author, director, venue_id, genre, runtime_minutes,
    intermissions, premiere_date, synopsis, poster_url, created_by, source
  ) values (
    play->>'title',
    play->>'author',
    play->>'director',
    (play->>'venueId')::uuid,
    play->>'genre',
    nullif(play->>'runtimeMinutes', '')::int,
    coalesce((play->>'intermissions')::int, 0),
    nullif(play->>'premiereDate', '')::date,
    play->>'synopsis',
    play->>'posterUrl',
    auth.uid(),
    'user'
  )
  returning * into new_play;

  for member in select * from jsonb_array_elements(cast_members)
  loop
    insert into public.play_cast (play_id, name, role, sort_order)
    values (new_play.id, member->>'name', member->>'role', idx);
    idx := idx + 1;
  end loop;

  return new_play;
end;
$$;

grant execute on function public.create_play_with_cast(jsonb, jsonb) to authenticated;
