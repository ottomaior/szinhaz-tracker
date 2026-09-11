-- Re-mint the handles the old generator made (T-045, second half).
--
-- 0052 stopped new accounts getting a handle cut from their e-mail address,
-- and left the three already minted that way alone, because they are stored
-- user data. Ottó then asked for them to be re-minted from the name, on the
-- condition that nothing else of those users' is touched. Nothing is:
-- `profiles.handle` is the only column in the schema that holds a handle
-- (checked in information_schema on 11 September 2026), no foreign key
-- points at it, and every follow, review, like, comment and profile URL
-- refers to the account by uuid. Changing the handle changes the string
-- under the name and nothing behind it.
--
-- Only the auto-minted ones. The old generator's mark is unmistakable — the
-- e-mail's local part, an underscore, the first six characters of the uuid —
-- and that suffix is checked against the row's own id, so a handle somebody
-- chose for themselves that happens to look similar is left alone. The three
-- that match, and what they become:
--
--     ottomaior_30ef9b            →  maiorotto
--     dtdangulytunde_d7d118       →  dangulytunde
--     ottomaiorplayreview_de7f62  →  playreview
--
-- Through `free_handle_from_name`, so a collision would be numbered rather
-- than fail the whole statement. The old values are in this header, which
-- is the rollback.

begin;

update public.profiles p
set handle = public.free_handle_from_name(p.name)
where p.handle ~ '^[a-z0-9]+_[0-9a-f]{6}$'
  and right(p.handle, 6) = left(p.id::text, 6);

commit;

-- rollback:
--   update public.profiles set handle = 'ottomaior_30ef9b'           where id = '30ef9b77-1fc1-4c82-b634-c61098efd677';
--   update public.profiles set handle = 'dtdangulytunde_d7d118'      where id = 'd7d118c5-40ae-4adb-b510-20fac5a73245';
--   update public.profiles set handle = 'ottomaiorplayreview_de7f62' where id = 'de7f6291-d5c9-455c-90c8-de9a8d79788d';
