-- The public handle was the e-mail address, minus the `@` (T-045).
--
-- `handle_new_user()` in 0001 minted every profile's handle from the local part
-- of the sign-up address plus six characters of the uuid — `ottomaior94e2e`
-- for `ottomaior94+e2e@gmail.com` — and the handle is rendered under the name
-- on the profile, on other people's view of it and in the Színházbarátok list,
-- to signed-out visitors included. So every account published most of its
-- e-mail address to the world, and nothing in the app let the person change
-- it.
--
-- Three things here. A function that turns a display name into a handle the
-- same way `person_slug` turns a credit into a slug — lower-cased, unaccented,
-- nothing but `[a-z0-9_]` — with a numeric suffix when the result is taken.
-- The sign-up trigger now uses it, so the address never reaches the profile.
-- And a check constraint pinning the shape, so the edit form the app grows
-- for this cannot write a handle with a space or an `@` in it. The constraint
-- is added `not valid` and then validated: every existing handle already
-- matches (they are `[a-z0-9]+_[0-9a-f]{6}`, checked before writing this), so
-- the validation is a no-op that leaves the table with a real constraint.
--
-- Existing handles are not rewritten. They are stored user data, and the
-- accounts that hold them are real people's; re-minting them is a decision
-- to take with Ottó, not a side effect of this file. The edit form is how a
-- person replaces theirs.

begin;

-- ---------------------------------------------------------------------------
-- The shape a handle may have
-- ---------------------------------------------------------------------------

-- Three to thirty characters of [a-z0-9_]. Long enough for "kovacsbence",
-- short enough to sit under a name on a phone; the same alphabet the old
-- generator produced, so nothing already stored is affected.
alter table public.profiles
  drop constraint if exists profiles_handle_shape;
alter table public.profiles
  add constraint profiles_handle_shape
  check (handle ~ '^[a-z0-9_]{3,30}$') not valid;
alter table public.profiles validate constraint profiles_handle_shape;

-- ---------------------------------------------------------------------------
-- A handle from a name
-- ---------------------------------------------------------------------------

-- "Kovács Bence" → kovacsbence; "Nagy Zsófia" → nagyzsofia. Immutable because
-- both pieces it leans on are: unaccent through the wrapper 0019 made for the
-- search index, and a regexp. Falls back to `nezo` ("viewer") when nothing
-- survives the cleaning — a name of emoji, say — and pads anything shorter
-- than three characters the same way, so the constraint above always holds.
create or replace function public.handle_from_name(full_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(cleaned) >= 3 then left(cleaned, 30)
    when length(cleaned) > 0 then rpad(cleaned, 3, '_')
    else 'nezo'
  end
  from (
    select regexp_replace(lower(public.immutable_unaccent(coalesce(full_name, ''))), '[^a-z0-9_]', '', 'g') as cleaned
  ) c;
$$;

-- The same, made unique: `kovacsbence`, then `kovacsbence2`, `kovacsbence3`…
-- Counts up rather than appending random characters, because a number is what
-- people expect on a taken name and is what they will type when telling a
-- friend. Stable, not immutable — it reads the table.
create or replace function public.free_handle_from_name(full_name text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  base text := public.handle_from_name(full_name);
  candidate text := public.handle_from_name(full_name);
  n int := 1;
begin
  while exists (select 1 from public.profiles where handle = candidate) loop
    n := n + 1;
    -- Keep the suffix inside the thirty-character limit.
    candidate := left(base, 30 - length(n::text)) || n::text;
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-up
-- ---------------------------------------------------------------------------

-- As 0001 wrote it, with the handle line replaced. The name still falls back
-- to the address's local part when the sign-up form sent none (the form
-- always does; the admin API might not), and that fallback then feeds the
-- handle too — which is the old behaviour, reached only by a path the app
-- never takes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  display_name text := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, name, handle, initials)
  values (
    new.id,
    display_name,
    public.free_handle_from_name(display_name),
    upper(left(display_name, 2))
  );
  return new;
end;
$$;

commit;

-- rollback:
--   drop function if exists public.free_handle_from_name(text);
--   drop function if exists public.handle_from_name(text);
--   alter table public.profiles drop constraint if exists profiles_handle_shape;
--   -- and re-run the `create or replace function public.handle_new_user`
--   -- block from 0001_init.sql, which restores the old generator verbatim.
