-- Following a performer, or a theatre.
--
-- The watchlist saves one production, which answers "am I going to this". The
-- subscription people actually want is standing, and open-ended: tell me when
-- Örkény announces something new, tell me when Für Anikó opens a production.
-- Nothing in the app could express that, so the nightly sync — which is the
-- only part of this project that produces news — reached nobody.
--
-- 0014 built exactly this for accounts. This is the same idea with a different
-- kind of subject, and it deliberately does not extend `follows`: that table's
-- `followee_id` is a foreign key into `auth.users`, and a theatre is not a user.

begin;

create table if not exists public.subject_follows (
  user_id uuid not null references auth.users (id) on delete cascade,

  subject_type text not null check (subject_type in ('person', 'venue')),

  -- Polymorphic on purpose, so "everything I am waiting on" is one query and
  -- the alerts job that will read this has one table to walk rather than one
  -- per kind of thing.
  --
  --   person  the slug from `person_slug()`, which 0024 already established as
  --           this catalogue's identity for a performer. There is no `people`
  --           table to key against and the slug is stable across the honorific
  --           noise in `play_cast`.
  --   venue   the venue's uuid, as text. A real row exists for these, but a
  --           foreign key would have to be per-type, which is the thing this
  --           shape exists to avoid — so the check constraint below carries it.
  subject_key text not null,

  created_at timestamptz not null default now(),

  primary key (user_id, subject_type, subject_key)
);

alter table public.subject_follows
  drop constraint if exists subject_follows_key_shape;
alter table public.subject_follows
  add constraint subject_follows_key_shape check (
    case subject_type
      -- Idempotence is the test: `person_slug()` of a slug is that slug, so a
      -- raw name — "Máthé Zsolt m.v." — fails here instead of quietly becoming
      -- a second, unreachable identity for somebody already followed.
      when 'person' then subject_key = public.person_slug(subject_key)
      when 'venue' then subject_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      else false
    end
  );

-- "Who follows this theatre" is what the alerts job will ask, once per new
-- production, so it is the direction that needs its own index — the primary key
-- already covers "what do I follow".
create index if not exists subject_follows_subject_idx
  on public.subject_follows (subject_type, subject_key);

alter table public.subject_follows enable row level security;

-- Readable by everyone, like `follows` in 0014 and for the same reason: a
-- performer's page should be able to say how many people are waiting on them,
-- and a count nobody may read cannot be shown.
drop policy if exists "subject follows are readable by everyone" on public.subject_follows;
create policy "subject follows are readable by everyone"
  on public.subject_follows for select
  using (true);

drop policy if exists "users manage their own subject follows" on public.subject_follows;
create policy "users manage their own subject follows"
  on public.subject_follows for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users remove their own subject follows" on public.subject_follows;
create policy "users remove their own subject follows"
  on public.subject_follows for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Everything one account is waiting on, resolved
-- ---------------------------------------------------------------------------
--
-- The rows hold keys, not names: a slug and a uuid. Every screen that lists
-- them wants a label, a subtitle and something to say how much work is behind
-- the name — and doing that from the client would be a query per row against
-- two different tables.
--
-- `security invoker` (the default), so RLS still decides what comes back. This
-- reads nothing the select policy above does not already allow.
create or replace function public.followed_subjects(follower uuid)
returns table (
  subject_type text,
  subject_key text,
  label text,
  -- The city, for a theatre. Null for a performer, whose disambiguator is the
  -- work rather than a place.
  detail text,
  -- Credits for a performer; currently-running productions for a theatre.
  -- Both answer the same question on the row: how much is behind this name.
  item_count int,
  followed_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    f.subject_type,
    f.subject_key,
    -- A slug nobody matches keeps its slug as a label rather than rendering as
    -- a blank row: a follow that has stopped resolving should look wrong, not
    -- look empty.
    coalesce(p.display_name, f.subject_key) as label,
    null::text as detail,
    coalesce(p.credit_count, 0) as item_count,
    f.created_at
  from public.subject_follows f
  cross join lateral public.person_profile(f.subject_key) p
  where f.user_id = follower and f.subject_type = 'person'

  union all

  select
    f.subject_type,
    f.subject_key,
    v.name as label,
    v.city as detail,
    (select count(*)::int from public.plays pl
     where pl.venue_id = v.id and pl.is_archived = false) as item_count,
    f.created_at
  from public.subject_follows f
  join public.venues v on v.id = f.subject_key::uuid
  where f.user_id = follower and f.subject_type = 'venue'

  order by 1, 3;
$$;

grant execute on function public.followed_subjects(uuid) to anon, authenticated;

commit;
