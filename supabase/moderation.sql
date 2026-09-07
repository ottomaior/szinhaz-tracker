-- The moderation queue, as a page of queries rather than an admin app.
--
-- Not a screen, deliberately. Editorial lists are already curated by hand in
-- the Supabase SQL editor, there is one operator, and an admin interface built
-- before there are users is a second product to maintain that nobody has yet
-- asked to use. What is actually needed is that a report can be found, read,
-- acted on, and closed — which is five queries.
--
-- Run these in the Supabase SQL editor, signed in as the project owner. They
-- read and write `reports`, `reviews.is_hidden` and `review_comments.is_hidden`,
-- none of which the app's RLS policies allow an ordinary account to touch:
-- `reports` has no update or delete policy for anybody, and `is_hidden` can only
-- be set by a role that bypasses RLS.
--
-- Nothing in this file is applied by running it. It is a reference; copy the
-- one you want.

-- ---------------------------------------------------------------------------
-- 1. The queue
-- ---------------------------------------------------------------------------
--
-- Everything open, newest first, with the reported text inline so that most
-- reports can be judged without a second query. `target_id` points at one of
-- three tables depending on `target_type`, which is why this is three left
-- joins rather than one.

select
  r.id,
  r.created_at,
  r.reason,
  r.note,
  r.target_type,
  r.target_id,
  reporter.handle as reported_by,
  coalesce(review_author.handle, comment_author.handle, subject.handle) as about,
  case r.target_type
    when 'review'  then rev.text
    when 'comment' then com.body
    when 'profile' then coalesce(subject.name, '') || ' — ' || coalesce(subject.bio, '')
  end as content,
  case r.target_type
    when 'review'  then rev.is_hidden
    when 'comment' then com.is_hidden
    else null
  end as already_hidden
from public.reports r
left join public.profiles reporter on reporter.id = r.reporter_id
left join public.reviews rev on r.target_type = 'review' and rev.id = r.target_id
left join public.profiles review_author on review_author.id = rev.user_id
left join public.review_comments com on r.target_type = 'comment' and com.id = r.target_id
left join public.profiles comment_author on comment_author.id = com.user_id
left join public.profiles subject on r.target_type = 'profile' and subject.id = r.target_id
where r.status = 'open'
order by r.created_at desc;

-- ---------------------------------------------------------------------------
-- 2. Is this a pattern, or one complaint?
-- ---------------------------------------------------------------------------
--
-- The queue above lists reports; this lists *things*, so that five people
-- reporting one comment reads as one problem rather than five, and so that an
-- account generating reports across many targets is visible as such.

select
  target_type,
  target_id,
  count(*) as reports,
  count(distinct reporter_id) as reporters,
  min(created_at) as first_reported,
  array_agg(distinct reason) as reasons
from public.reports
where status = 'open'
group by target_type, target_id
order by reporters desc, reports desc;

-- ---------------------------------------------------------------------------
-- 3. Taking something down
-- ---------------------------------------------------------------------------
--
-- Hiding, not deleting. A report can be wrong, a deletion cannot be undone, and
-- a row that has been removed is also gone as the evidence of why it was
-- removed. `is_hidden` takes the content out of every public view — the select
-- policies in 0037 enforce it — while leaving it readable here and restorable
-- by setting the flag back.
--
-- The author still sees their own hidden review, by design: a diary entry is
-- somebody's record of an evening as well as a public post, and a takedown
-- should remove the public half without quietly deleting the private one.

-- A review:
--   update public.reviews set is_hidden = true where id = '00000000-0000-0000-0000-000000000000';
-- A comment:
--   update public.review_comments set is_hidden = true where id = '00000000-0000-0000-0000-000000000000';
-- Undo either by setting it back to false.

-- ---------------------------------------------------------------------------
-- 4. Closing a report
-- ---------------------------------------------------------------------------
--
-- Every open report about the same target closes together. Judging the content
-- once and then closing five identical reports one at a time is how a queue
-- gets abandoned.
--
--   update public.reports
--      set status = 'actioned', resolved_at = now()
--    where target_type = 'comment'
--      and target_id = '00000000-0000-0000-0000-000000000000'
--      and status = 'open';
--
-- 'dismissed' for a report that was checked and needed nothing. The distinction
-- is worth keeping: a reporter whose reports are all dismissed is a different
-- signal from one whose reports are all actioned, and query 5 reads it.

-- ---------------------------------------------------------------------------
-- 5. Who is reporting, and how well
-- ---------------------------------------------------------------------------
--
-- For the case the DSA expects an operator to be able to answer: somebody
-- filing reports in volume that are all dismissed is misusing the mechanism,
-- and there is no way to notice that from the queue itself.

select
  p.handle,
  count(*) as filed,
  count(*) filter (where r.status = 'actioned') as actioned,
  count(*) filter (where r.status = 'dismissed') as dismissed,
  count(*) filter (where r.status = 'open') as still_open,
  max(r.created_at) as most_recent
from public.reports r
left join public.profiles p on p.id = r.reporter_id
group by p.handle
order by filed desc;

-- ---------------------------------------------------------------------------
-- 6. What is currently hidden
-- ---------------------------------------------------------------------------
--
-- The list to re-read occasionally. Hiding is reversible and nothing expires on
-- its own, so without this the only record of a takedown is the memory of
-- having done it.

select 'review' as kind, id, user_id, created_at, left(text, 140) as content
from public.reviews where is_hidden
union all
select 'comment', id, user_id, created_at, left(body, 140)
from public.review_comments where is_hidden
order by created_at desc;
