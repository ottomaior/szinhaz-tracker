-- Likes and comments, with counters that are actually maintained.
--
-- `reviews.like_count` and `comment_count` have existed since 0001 and no code
-- path has ever incremented either. They were rendered on every feed card as a
-- permanent zero until a later commit took them off, on the grounds that a
-- control which has never done anything teaches people the app is a mockup.
--
-- This is the other way to resolve that: make them true.
--
-- Two tables, two triggers that keep the counters honest, and a third that puts
-- the result in the recipient's inbox — which exists now, so a like has
-- somewhere to arrive rather than being a number that changes silently.

begin;

-- ---------------------------------------------------------------------------
-- The rating trigger stops firing on things that are not ratings
-- ---------------------------------------------------------------------------
--
-- `reviews_recompute_rating` from 0001 fires on *any* update to a review, and
-- `recompute_play_rating()` is not cheap: it averages every rating on the
-- production per user and then across users. Maintaining `like_count` with an
-- update to `reviews` would therefore recompute a play's public rating on every
-- single like — a heart tap doing an aggregate over a hundred rows and writing
-- five columns nobody asked it to touch.
--
-- Split in two so the expensive path runs only when something it reads has
-- actually changed. `update of ...` narrows it to statements that mention those
-- columns; the `when` clause narrows it to statements that changed them, since
-- the former fires even for a column set to the value it already had.
drop trigger if exists reviews_recompute_rating on public.reviews;

create trigger reviews_recompute_rating_ins_del
  after insert or delete on public.reviews
  for each row execute function public.recompute_play_rating();

create trigger reviews_recompute_rating_upd
  after update of rating_overall, rating_acting, rating_directing, rating_set_design, play_id, user_id
  on public.reviews
  for each row
  when (
    old.rating_overall    is distinct from new.rating_overall
    or old.rating_acting    is distinct from new.rating_acting
    or old.rating_directing is distinct from new.rating_directing
    or old.rating_set_design is distinct from new.rating_set_design
    or old.play_id is distinct from new.play_id
    or old.user_id is distinct from new.user_id
  )
  execute function public.recompute_play_rating();

-- ---------------------------------------------------------------------------
-- Likes
-- ---------------------------------------------------------------------------

create table if not exists public.review_likes (
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One person, one like. The primary key is the whole constraint: a double tap
  -- is an accident, not a second opinion.
  primary key (review_id, user_id)
);

create index if not exists review_likes_user_idx on public.review_likes (user_id);

alter table public.review_likes enable row level security;

-- Public, like `follows`: a count nobody may read cannot be shown, and "have I
-- liked this" is a question the card has to answer for the person looking at it.
drop policy if exists "review likes are readable by everyone" on public.review_likes;
create policy "review likes are readable by everyone"
  on public.review_likes for select using (true);

drop policy if exists "users like as themselves" on public.review_likes;
create policy "users like as themselves"
  on public.review_likes for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users remove their own likes" on public.review_likes;
create policy "users remove their own likes"
  on public.review_likes for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Bounded in the database rather than only in the form, for the reason 0027
  -- gives about `bio`: the insert policy means the form is not the only way in.
  -- The lower bound is what stops an empty bubble appearing in a thread.
  body text not null check (char_length(btrim(body)) between 1 and 1000),

  created_at timestamptz not null default now(),
  -- Set by the update trigger below rather than by the client, so "edited"
  -- means the text changed and not that somebody sent the field.
  edited_at timestamptz
);

create index if not exists review_comments_review_idx
  on public.review_comments (review_id, created_at);

alter table public.review_comments enable row level security;

drop policy if exists "review comments are readable by everyone" on public.review_comments;
create policy "review comments are readable by everyone"
  on public.review_comments for select using (true);

drop policy if exists "users comment as themselves" on public.review_comments;
create policy "users comment as themselves"
  on public.review_comments for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users edit their own comments" on public.review_comments;
create policy "users edit their own comments"
  on public.review_comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Two people may delete a comment: whoever wrote it, and whoever owns the diary
-- entry it is sitting under. The second is not politeness — it is the only
-- moderation this app has, and an author who cannot remove something from their
-- own evening has no way out of it at all.
drop policy if exists "users delete comments they own or host" on public.review_comments;
create policy "users delete comments they own or host"
  on public.review_comments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.reviews r
      where r.id = review_comments.review_id and r.user_id = auth.uid()
    )
  );

create or replace function public.review_comments_touch_edited()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists review_comments_touch_edited on public.review_comments;
create trigger review_comments_touch_edited
  before update on public.review_comments
  for each row execute function public.review_comments_touch_edited();

-- ---------------------------------------------------------------------------
-- The counters
-- ---------------------------------------------------------------------------
--
-- Recomputed from the rows rather than incremented and decremented. A `+1/-1`
-- counter is one missed rollback away from being permanently wrong and nothing
-- ever notices, because there is no second source to disagree with it. A count
-- is one index scan over a handful of rows and cannot drift.
--
-- `security definer`, and this one is not optional: the trigger fires as the
-- person who pressed the heart, and the row it has to update belongs to
-- somebody else. `reviews_update_own` refuses that — silently, because an
-- UPDATE that RLS filters to zero rows is not an error, it is an update that
-- matched nothing. The first version of this migration looked like it worked:
-- the like was stored, the notification arrived, and the counter stayed at
-- zero with nothing anywhere reporting a failure.
--
-- Nothing about the write comes from the caller. The row updated is the one the
-- like points at, and the value written is a count of rows in this table.
create or replace function public.reviews_recount_likes()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  target uuid := coalesce(new.review_id, old.review_id);
begin
  update public.reviews r
  set like_count = (select count(*) from public.review_likes l where l.review_id = r.id)
  where r.id = target;
  return null;
end;
$function$;

drop trigger if exists review_likes_recount on public.review_likes;
create trigger review_likes_recount
  after insert or delete on public.review_likes
  for each row execute function public.reviews_recount_likes();

-- `security definer` for the same reason as the like counter above.
create or replace function public.reviews_recount_comments()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  target uuid := coalesce(new.review_id, old.review_id);
begin
  update public.reviews r
  set comment_count = (select count(*) from public.review_comments c where c.review_id = r.id)
  where r.id = target;
  return null;
end;
$function$;

drop trigger if exists review_comments_recount on public.review_comments;
create trigger review_comments_recount
  after insert or delete on public.review_comments
  for each row execute function public.reviews_recount_comments();

revoke execute on function public.reviews_recount_likes() from public, anon, authenticated;
revoke execute on function public.reviews_recount_comments() from public, anon, authenticated;

-- Whatever the columns held before, they were never written by anything.
update public.reviews r
set like_count = (select count(*) from public.review_likes l where l.review_id = r.id),
    comment_count = (select count(*) from public.review_comments c where c.review_id = r.id)
where r.like_count <> (select count(*) from public.review_likes l where l.review_id = r.id)
   or r.comment_count <> (select count(*) from public.review_comments c where c.review_id = r.id);

-- ---------------------------------------------------------------------------
-- ...and it lands in the inbox
-- ---------------------------------------------------------------------------

alter table public.notifications
  -- Which entry it was about. Null for the four sync-generated kinds, which are
  -- about a production rather than about something somebody wrote.
  add column if not exists review_id uuid references public.reviews (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'dates_published',
    'playing_tomorrow',
    'venue_new_play',
    'person_new_play',
    'review_liked',
    'review_commented'
  ));

-- `security definer`, deliberately and narrowly.
--
-- 0030 gave `notifications` no insert policy at all, on purpose: rows come from
-- the service role and nothing signed in may post one. A trigger firing on a
-- like runs as the liker, so it needs to be lifted over that — and the danger
-- of lifting it is that the elevated code becomes a way to write arbitrary rows.
--
-- What keeps that from happening is that nothing here comes from the caller.
-- The recipient is read from the review, the play is read from the review, and
-- the actor is `auth.uid()`. There is no path from a request body to a column.
create or replace function public.notify_review_engagement()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  owner_id uuid;
  target_play uuid;
  actor uuid := auth.uid();
  actor_name text;
  notice_kind text;
  key text;
begin
  select r.user_id, r.play_id into owner_id, target_play
  from public.reviews r where r.id = new.review_id;

  -- Liking your own entry is allowed; being told about it is not.
  if owner_id is null or actor is null or owner_id = actor then
    return null;
  end if;

  select p.name into actor_name from public.profiles p where p.id = actor;

  -- Branched with `if` rather than resolved inside a `case` expression in the
  -- insert. `review_likes` has no `id` column, and PL/pgSQL resolves every
  -- field reference in an expression whether or not that branch is taken — so
  -- the `case` form raised `record "new" has no field "id"` on every like,
  -- including the branch that never touches it.
  if tg_table_name = 'review_likes' then
    notice_kind := 'review_liked';
    -- One notice per person per entry, however many times they unlike and like
    -- it again.
    key := 'like:' || new.review_id::text || ':' || actor::text;
  else
    notice_kind := 'review_commented';
    -- A comment is a new thing to read every time, so it keys on the comment.
    key := 'comment:' || new.id::text;
  end if;

  insert into public.notifications (user_id, kind, play_id, review_id, payload, dedupe_key)
  values (
    owner_id,
    notice_kind,
    target_play,
    new.review_id,
    jsonb_build_object('person', coalesce(actor_name, '')),
    key
  )
  on conflict (user_id, dedupe_key) do nothing;

  return null;
end;
$function$;

revoke execute on function public.notify_review_engagement() from public, anon, authenticated;

drop trigger if exists review_likes_notify on public.review_likes;
create trigger review_likes_notify
  after insert on public.review_likes
  for each row execute function public.notify_review_engagement();

drop trigger if exists review_comments_notify on public.review_comments;
create trigger review_comments_notify
  after insert on public.review_comments
  for each row execute function public.notify_review_engagement();

commit;
