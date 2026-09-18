-- A display name from whatever the sign-in provider sent.
--
-- `handle_new_user()` reads `raw_user_meta_data->>'name'`, which is the key
-- the app's own sign-up form writes (`options.data.name` in
-- services/authService.ts). Sign in with Google is the first path into
-- auth.users that does not go through that form. Supabase copies the
-- provider's claims into the same jsonb, but under the provider's names —
-- Google sends `name` *and* `full_name`, and Apple sends a name only on the
-- very first authorisation and none at all after that. So the fallback order
-- becomes: the form's key, the provider's key, and only then the local part
-- of the address — which for an Apple relay address would have been a random
-- string, and for anybody is most of their e-mail published as a name (the
-- same thing 0052 took out of the handle).
--
-- `nullif(trim(…), '')` on each, because a key that is present and empty is
-- what a provider sends for a person who left the field blank, and `coalesce`
-- would otherwise stop there and mint the handle from nothing (0052's
-- `handle_from_name('')` says `nezo`, which is right for the handle and wrong
-- for a name on screen).
--
-- Additive: the function is replaced, the trigger is untouched, and every
-- account created through the form behaves exactly as before because its
-- `name` key is still read first. `create or replace` keeps the grants, so
-- 0036's `revoke execute … from public, anon, authenticated` still holds.
-- Existing rows are not touched.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  display_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1)
  );
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
--   re-run the `create or replace function public.handle_new_user` block
--   from 0052_a_handle_from_the_name.sql, which restores the single-key read.
--   Profiles created meanwhile keep the name they were given; nothing to undo
--   in the data.
