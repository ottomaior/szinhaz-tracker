-- When did this account see the first-run flow (T-083)?
--
-- Sign-up used to close its modal and leave the person wherever they were.
-- The app now opens a short first run once — name if the provider sent none,
-- city, the theatres to follow, the "which of these have you seen" grid — and
-- it needs one fact to know whether it already has: `onboarded_at`.
--
-- Nullable, no default, so a row created by `handle_new_user()` starts null
-- and the app fills it in the moment the flow opens (not when it finishes: a
-- flow that reappears because somebody closed it half-way is a nag, and the
-- profile keeps offering the grid to an empty diary anyway).
--
-- Every row that exists at the time this runs is stamped with its own
-- `created_at`. That is not a rewrite of anything a person typed — the
-- column did not exist a second ago — it is the statement that nobody who
-- already has an account is a first-time visitor, which is the truth. Without
-- it every existing account would be walked through a welcome to an app it
-- has been using for weeks.
--
-- Written by the owner only: `profiles_update_own` already lets a person
-- update their own row, and this is one more column under it. Nothing reads
-- it but the app.

begin;

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'When the first-run flow was shown. Null means never; the app sets it on opening the flow.';

update public.profiles
   set onboarded_at = created_at
 where onboarded_at is null;

commit;

-- rollback:
--   alter table public.profiles drop column onboarded_at;
--   -- The column is the only thing this file created; nothing else depends on it.
