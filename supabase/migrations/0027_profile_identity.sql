-- Something on a profile worth arranging.
--
-- `profiles` has carried name, handle, city and initials since 0001, and every
-- screen that renders a person draws the same monogram in the same circle.
-- That is the one screen in a logging app people actually visit to look at
-- somebody rather than to look something up, and there is nothing on it.
--
-- Two columns fix that: a picture and a sentence. Both are optional, so an
-- account that never touches them keeps rendering exactly as it does today.
--
-- The avatar reuses the shape 0011 established for posters — a path inside a
-- public bucket, not a URL — so the CDN origin stays out of the rows and a
-- signed-in user can only ever write inside their own folder.

begin;

alter table public.profiles
  -- Path inside the `avatars` bucket, always `<uid>/<file>`. Enforced twice:
  -- by storage RLS on the upload, and by the trigger below on the row, so a
  -- crafted update cannot point one profile at another's photograph.
  add column if not exists avatar_path text,

  -- A short self-description, shown under the handle on both profile screens.
  add column if not exists bio text;

-- Capped in the database rather than only in the form. The update policy lets
-- a signed-in user write their own row directly, so the form is not the only
-- way in, and an unbounded `text` on a public table is an invitation.
alter table public.profiles
  drop constraint if exists profiles_bio_length;
alter table public.profiles
  add constraint profiles_bio_length
  check (bio is null or char_length(bio) <= 280);

comment on column public.profiles.avatar_path is
  'Path inside the public `avatars` bucket, always <uid>/<file>. Null means '
  'fall back to the initials monogram.';
comment on column public.profiles.bio is
  'Short self-description, at most 280 characters.';

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Public read: a feed card's byline is visible to signed-out visitors, so the
-- avatar on it has to be too.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Its own bucket rather than a folder in `posters`, because the two have
-- different lifetimes and different sizes: a poster is mirrored once and kept
-- forever, an avatar is replaced whenever somebody changes their mind.
drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users upload their own avatar" on storage.objects;
create policy "users upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users replace their own avatar" on storage.objects;
create policy "users replace their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Deletable, unlike posters: replacing your photograph five times should not
-- leave five files behind, and nothing else ever points at the old one.
drop policy if exists "users delete their own avatar" on storage.objects;
create policy "users delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- The row can only point at its own folder
-- ---------------------------------------------------------------------------

create or replace function public.profiles_guard_avatar_path()
returns trigger
language plpgsql
-- Pinned rather than left to the caller's search_path, which is what the
-- database linter's `function_search_path_mutable` asks for. Cheap on a new
-- function; the older ones in this schema still carry the warning.
set search_path = public
as $function$
begin
  if new.avatar_path is not null
     and new.avatar_path not like new.id::text || '/%' then
    raise exception 'avatar_path must live under the profile owner''s own folder'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_guard_avatar_path on public.profiles;
create trigger profiles_guard_avatar_path
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_avatar_path();

-- ---------------------------------------------------------------------------
-- Initials follow the name
-- ---------------------------------------------------------------------------

-- Editing your name is part of the same screen as the avatar, and initials are
-- the fallback that shows when there is no photograph — so leaving them at
-- whatever signup derived would mean renaming yourself and keeping somebody
-- else's monogram.
--
-- First letter of each of the first two words, so "Máthé Zsolt" is MZ rather
-- than the MÁ the signup trigger produced by taking the first two characters.
create or replace function public.profile_initials(full_name text)
returns text
language sql
immutable
set search_path = public
as $function$
  select coalesce(
    nullif(
      upper(
        coalesce(
          (
            select string_agg(w.word_initial, '' order by w.ord)
            from (
              select left(word, 1) as word_initial, ord
              from unnest(regexp_split_to_array(btrim(coalesce(full_name, '')), '\s+'))
                with ordinality as t(word, ord)
              where word <> ''
              order by ord
              limit 2
            ) w
          ),
          left(btrim(coalesce(full_name, '')), 2)
        )
      ),
      ''
    ),
    '?'
  );
$function$;

create or replace function public.profiles_sync_initials()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    new.initials := public.profile_initials(new.name);
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_initials_from_name on public.profiles;
create trigger profiles_initials_from_name
  before insert or update on public.profiles
  for each row execute function public.profiles_sync_initials();

-- Bring the four existing rows onto the same rule. The trigger leaves this
-- alone because `name` is not changing, so the explicit value stands.
update public.profiles
set initials = public.profile_initials(name)
where initials is distinct from public.profile_initials(name);

commit;
