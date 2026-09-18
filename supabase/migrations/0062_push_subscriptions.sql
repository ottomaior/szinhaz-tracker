-- Where a notification can be delivered, and which ones a person wants (T-089).
--
-- 0030 built the inbox as an in-app table on purpose: no device tokens, no
-- APNs or FCM to configure before a first version could ship, and "email or
-- push can sit on the same rows later without changing any of it". This is
-- the later. Nothing about `notifications` changes except one column,
-- `pushed_at`, which is the sender's bookmark: null means "not delivered
-- anywhere yet", and the `send-push` Edge Function works through the rows
-- where it is null and stamps them whether or not anybody had a device to
-- deliver to — a row nobody could receive is done, not pending.
--
-- Every row that exists when this runs is stamped with its own `created_at`.
-- It is a bookmark on a new column, not a change to what anybody stored, and
-- without it the first run of the sender would push three weeks of inbox
-- history to every phone that subscribes in the first hour.
--
-- `push_subscriptions` holds one row per device or browser. `platform` says
-- which transport: `web` rows carry the Push API endpoint and its two keys,
-- `expo` rows carry an Expo push token in `endpoint` and no keys — the check
-- constraint says so, rather than leaving two nullable columns to be
-- interpreted. `endpoint` is unique because a browser hands out one
-- subscription at a time and re-registering must replace, not duplicate.
--
-- `notification_preferences` is per person, not per device: "tell me when a
-- theatre I follow announces something" is a preference about the person's
-- attention, and it would be strange to have to say it on each phone. No row
-- means every kind, which is what the default array says; the app writes a
-- row the first time somebody turns one off.
--
-- Both tables are owner-scoped under RLS in the 0045 shape. The sender runs
-- as the service role and reads across users; nothing signed in can see
-- another person's devices.

begin;

-- ---------------------------------------------------------------------------
-- The sender's bookmark
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column if not exists pushed_at timestamptz;

comment on column public.notifications.pushed_at is
  'When send-push handled this row (delivered, or nothing to deliver to). Null means pending.';

update public.notifications
   set pushed_at = created_at
 where pushed_at is null;

create index if not exists notifications_unpushed_idx
  on public.notifications (created_at)
  where pushed_at is null;

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('web', 'expo')),
  -- The Push API endpoint URL, or the ExponentPushToken[...] string.
  endpoint text not null unique,
  p256dh text,
  auth text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_subscriptions_web_has_keys
    check (platform <> 'web' or (p256dh is not null and auth is not null))
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- What to be told about
-- ---------------------------------------------------------------------------

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kinds text[] not null default array[
    'dates_published',
    'playing_tomorrow',
    'venue_new_play',
    'person_new_play',
    'review_liked',
    'review_commented'
  ],
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_select_own" on public.notification_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "notification_preferences_insert_own" on public.notification_preferences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "notification_preferences_update_own" on public.notification_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;

-- rollback:
--   drop table public.notification_preferences;
--   drop table public.push_subscriptions;
--   drop index if exists public.notifications_unpushed_idx;
--   alter table public.notifications drop column pushed_at;
--   -- The two tables hold only device registrations and toggles, both of
--   -- which the app recreates on demand; nothing a person wrote is in them.
