-- What a screening does not have.
--
-- Every showing of a film is the same file. A performance is not: the cast
-- changes, the seat is yours, the ticket had a price, and there is a stub in
-- your coat pocket afterwards. The diary has known *which night* since 0022 and
-- nothing at all about the night itself.
--
-- Four things here, in the order they matter:
--
--   review_cast   who was actually on — the one thing understudies.org exists
--                 to answer, and which no theatre publishes retroactively
--   seat          where you sat
--   price_huf     what it cost
--   stub_path     the ticket, the műsorfüzet, the curtain call
--
-- The cast table is the only one that needs a table; the rest are columns on
-- `reviews`, all nullable, so every entry written before today stays valid and
-- an entry that answers none of them is still a perfectly good entry.

begin;

-- ---------------------------------------------------------------------------
-- Seat and price
-- ---------------------------------------------------------------------------

alter table public.reviews
  -- Free text rather than section/row/number columns. Hungarian theatres label
  -- seats a dozen different ways — "Erkély bal 2. sor 14.", "Földszint jobb
  -- oldalpáholy", "Stúdió, szabad ülőhely" — and three columns would force
  -- every one of them into a shape it does not have. What this is for is
  -- remembering where you sat and, later, noticing that it is always the
  -- balcony; neither needs the string parsed.
  add column if not exists seat text,

  -- Forints, and named so. An unlabelled `price` on a Hungarian app is a
  -- column somebody will one day put euros in.
  add column if not exists price_huf integer,

  -- Path inside the `stubs` bucket, always `<uid>/<file>`.
  add column if not exists stub_path text;

alter table public.reviews
  drop constraint if exists reviews_price_huf_sane;
alter table public.reviews
  -- Zero is a real answer — a press ticket, a school performance, a friend's
  -- spare. The upper bound is not a judgement about ticket prices; it is there
  -- so a mistyped "12000" with a stray digit does not quietly become the
  -- season total.
  add constraint reviews_price_huf_sane
  check (price_huf is null or (price_huf >= 0 and price_huf <= 1000000));

alter table public.reviews
  drop constraint if exists reviews_seat_length;
alter table public.reviews
  add constraint reviews_seat_length
  check (seat is null or char_length(seat) <= 120);

comment on column public.reviews.seat is
  'Where they sat, as they would say it. Free text on purpose — see 0028.';
comment on column public.reviews.price_huf is
  'Ticket price in forints. Zero is a real answer; null means not recorded.';
comment on column public.reviews.stub_path is
  'Path inside the public `stubs` bucket, always <uid>/<file>.';

-- ---------------------------------------------------------------------------
-- The stub photo
-- ---------------------------------------------------------------------------

-- Public, like `posters` and `avatars`, because a diary entry is public: the
-- feed shows it and `reviews_select_all` has always let anyone read the text.
-- A photo attached to one is no more private than the entry it belongs to —
-- which is exactly why the check-in form says so in as many words before
-- anybody points a camera at a ticket with their name printed on it.
insert into storage.buckets (id, name, public)
values ('stubs', 'stubs', true)
on conflict (id) do update set public = true;

drop policy if exists "stubs are publicly readable" on storage.objects;
create policy "stubs are publicly readable"
  on storage.objects for select
  using (bucket_id = 'stubs');

drop policy if exists "users upload their own stubs" on storage.objects;
create policy "users upload their own stubs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'stubs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users replace their own stubs" on storage.objects;
create policy "users replace their own stubs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'stubs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete their own stubs" on storage.objects;
create policy "users delete their own stubs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'stubs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The row half of the same rule, for the reason 0027 gives about `avatar_path`:
-- storage RLS governs the upload, but `reviews_update_own` lets somebody write
-- their own row directly, and a path is just a string until something checks it.
create or replace function public.reviews_guard_stub_path()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.stub_path is not null
     and new.stub_path not like new.user_id::text || '/%' then
    raise exception 'stub_path must live under the diary entry owner''s own folder'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

drop trigger if exists reviews_guard_stub_path on public.reviews;
create trigger reviews_guard_stub_path
  before insert or update on public.reviews
  for each row execute function public.reviews_guard_stub_path();

-- ---------------------------------------------------------------------------
-- Who was on that night
-- ---------------------------------------------------------------------------
--
-- Kept as its own table rather than a `text[]` on `reviews` because the whole
-- point is to be able to ask it backwards: who did *this performer* go on for,
-- how many of their nights has this person seen. An array answers neither
-- without unnesting it on every read.
--
-- Names are free text, matching `play_cast`. 0024 already decided this is
-- workable at this size and why a `people` table can wait: the slug is the
-- identity, and `person_slug()` produces the same one from "Máthé Zsolt" and
-- "Máthé Zsolt m.v.".
create table if not exists public.review_cast (
  review_id uuid not null references public.reviews(id) on delete cascade,

  -- As it was ticked, or as it was typed for somebody the catalogue does not
  -- list. Displayed verbatim; matched on the slug.
  name text not null,

  -- The part, when the catalogue knew it. Null for a name typed in by hand —
  -- an audience member knows an understudy went on, rarely what the programme
  -- would have called the role.
  role text,

  -- True when this person was not in the production's published cast: an
  -- understudy, a replacement, a guest for one night. This is the column the
  -- feature exists for, since it is precisely what no theatre records
  -- retroactively.
  is_alternate boolean not null default false,

  name_slug text generated always as (public.person_slug(name)) stored,

  added_at timestamptz not null default now(),

  primary key (review_id, name)
);

-- Two spellings of one person on one night is a mistake, not two people. The
-- partial predicate covers the case `person_slug` returns null for — a "name"
-- of nothing but punctuation, which the primary key above still keeps unique.
create unique index if not exists review_cast_one_person_per_night_idx
  on public.review_cast (review_id, name_slug)
  where name_slug is not null;

-- The question this table was built to answer backwards.
create index if not exists review_cast_name_slug_idx
  on public.review_cast (name_slug);

alter table public.review_cast enable row level security;

-- Readable by everyone, like the reviews themselves — an audience record of who
-- went on is worth nothing if only its author can see it.
drop policy if exists "review_cast_select_all" on public.review_cast;
create policy "review_cast_select_all" on public.review_cast
  for select using (true);

-- Writable only through your own diary entry. `for all` rather than three
-- policies because the condition is identical for insert, update and delete:
-- the row belongs to whoever owns the review it hangs off.
drop policy if exists "review_cast_write_own" on public.review_cast;
create policy "review_cast_write_own" on public.review_cast
  for all to authenticated
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_cast.review_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_cast.review_id and r.user_id = auth.uid()
    )
  );

commit;
