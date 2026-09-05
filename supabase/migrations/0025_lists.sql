-- ============================================================
-- Lists
--
-- The most-copied idea in film logging, and here it does a second job the film
-- apps do not need it for: it is the only way to put something worth reading in
-- front of a brand-new account.
--
-- Discover's browse rails currently rank by `plays.rating_overall`, an average
-- computed from four reviews across a catalogue of 1,214 productions. That is
-- not a popularity signal, it is noise with a decimal point. Ten hand-made
-- lists over the same catalogue is a far better first screen, and it needs no
-- users to exist first.
--
-- So the same two tables serve both: a list somebody makes for themselves, and
-- a list written here and marked `is_featured`.
-- ============================================================

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null default '',
  /*
   * Whether the order means anything.
   *
   * "A 2025/26-os évad legjobbjai" is a ranking and "Shakespeare Budapesten" is
   * not, and the difference has to be recorded rather than inferred, because it
   * changes what the screen may show: numbering an unranked list asserts a
   * judgement its author never made.
   */
  is_ranked boolean not null default false,
  is_public boolean not null default true,
  /*
   * Editorial. Set from the SQL editor, never by the app — see the trigger
   * below, which is what keeps "featured" meaning "we chose this" rather than
   * "somebody set a flag on their own row".
   */
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.list_items (
  list_id uuid not null references public.lists(id) on delete cascade,
  play_id uuid not null references public.plays(id) on delete cascade,
  /** Only meaningful when the list `is_ranked`; ties break on `added_at`. */
  position int not null default 0,
  /** Why this one is here. The sentence is most of what makes a list worth reading. */
  note text not null default '',
  added_at timestamptz not null default now(),
  -- A production cannot appear twice in one list. Ranked or not, the second
  -- entry would be a mistake rather than an opinion.
  primary key (list_id, play_id)
);

create index if not exists lists_owner_idx on public.lists (owner_id, updated_at desc);
create index if not exists lists_featured_idx on public.lists (updated_at desc) where is_featured;
create index if not exists list_items_list_idx on public.list_items (list_id, position, added_at);
create index if not exists list_items_play_idx on public.list_items (play_id);

-- ------------------------------------------------------------
-- "Featured" has to mean something
--
-- Without this, `is_featured` is just a column on a row its owner can update,
-- so anyone could put their own list on the front of Discover. The trigger
-- pins the flag to whatever it already was, unless the statement is running as
-- `postgres` or `service_role` — which is the SQL editor and the sync job's key,
-- and nothing the app can reach.
--
-- **Not `security definer`**, and that is the whole point. The first version of
-- this was, and it silently did nothing: inside a `security definer` function
-- `current_user` is the function's *owner*, so the guard saw `postgres` on
-- every call and took the allow branch every time. Impersonating a real signed-in
-- user — `set local role authenticated` plus a `request.jwt.claims` setting,
-- which is what PostgREST does for an app request — inserted a list with
-- `is_featured = true` and it stayed true. This function needs no elevated
-- rights; it only rewrites NEW.
-- ------------------------------------------------------------
create or replace function public.lists_guard_featured()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_featured := false;
  else
    new.is_featured := old.is_featured;
  end if;
  return new;
end;
$$;

drop trigger if exists lists_guard_featured on public.lists;
create trigger lists_guard_featured
  before insert or update on public.lists
  for each row execute function public.lists_guard_featured();

create or replace function public.lists_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lists_touch_updated_at on public.lists;
create trigger lists_touch_updated_at
  before update on public.lists
  for each row execute function public.lists_touch_updated_at();

/*
 * Adding or removing an entry is a change to the list.
 *
 * Without this the index would order by a timestamp that only moves when
 * somebody renames the list, so a list actively being built would sink below
 * one whose title was edited months ago.
 */
create or replace function public.list_items_touch_list()
returns trigger
language plpgsql
as $$
begin
  update public.lists set updated_at = now()
  where id = coalesce(new.list_id, old.list_id);
  return null;
end;
$$;

drop trigger if exists list_items_touch_list on public.list_items;
create trigger list_items_touch_list
  after insert or update or delete on public.list_items
  for each row execute function public.list_items_touch_list();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

-- A private list is invisible to everyone but its owner, including in the
-- counts on the index — which is why every read path goes through this policy
-- rather than filtering `is_public` in the app.
drop policy if exists "lists are readable when public or owned" on public.lists;
create policy "lists are readable when public or owned"
  on public.lists for select
  using (is_public or owner_id = (select auth.uid()));

drop policy if exists "users create their own lists" on public.lists;
create policy "users create their own lists"
  on public.lists for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "users update their own lists" on public.lists;
create policy "users update their own lists"
  on public.lists for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "users delete their own lists" on public.lists;
create policy "users delete their own lists"
  on public.lists for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Entries inherit their list's visibility, so a private list's contents cannot
-- be read row by row around the policy above.
drop policy if exists "list items follow their list" on public.list_items;
create policy "list items follow their list"
  on public.list_items for select
  using (exists (
    select 1 from public.lists l
    where l.id = list_id and (l.is_public or l.owner_id = (select auth.uid()))
  ));

drop policy if exists "users write entries in their own lists" on public.list_items;
create policy "users write entries in their own lists"
  on public.list_items for all to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = (select auth.uid())));

-- ============================================================
-- The index query
-- ============================================================

/*
 * Lists with their size and enough cover art to draw a card.
 *
 * One call rather than one per list: the index screen shows a stack of covers
 * per row, and fetching those per list is the request-per-item pattern
 * `getVenuesByIds` exists to avoid elsewhere.
 *
 * `owner` and `featured_only` are both optional so the same function answers
 * "my lists", "somebody else's public lists" and "the editorial ones". RLS
 * still decides what is visible; these only narrow it.
 */
create or replace function public.list_summaries(
  owner uuid default null,
  featured_only boolean default false
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  description text,
  is_ranked boolean,
  is_public boolean,
  is_featured boolean,
  updated_at timestamptz,
  item_count int,
  cover_play_ids uuid[]
)
language sql
stable
as $$
  select
    l.id,
    l.owner_id,
    l.title,
    l.description,
    l.is_ranked,
    l.is_public,
    l.is_featured,
    l.updated_at,
    (select count(*)::int from public.list_items li where li.list_id = l.id),
    coalesce((
      select array_agg(x.play_id)
      from (
        select li.play_id
        from public.list_items li
        where li.list_id = l.id
        order by
          -- Ranked lists lead with their top entries; unranked ones with what
          -- was added first, which is the order their author was thinking in.
          case when l.is_ranked then li.position end nulls last,
          li.added_at
        limit 4
      ) x
    ), '{}'::uuid[])
  from public.lists l
  where (owner is null or l.owner_id = owner)
    and (not featured_only or l.is_featured)
  order by l.updated_at desc;
$$;

grant execute on function public.list_summaries(uuid, boolean) to anon, authenticated;
