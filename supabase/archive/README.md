# Archive

Migrations that were written but are not part of the schema's history. They are
kept out of `supabase/migrations/` so that nothing runs them and so that the
directory holds one file per number, and kept at all because the reasoning in
them is worth more than the SQL.

Nothing here is applied by the CLI. The filenames carry the date they were
written, not a migration number.

## 2026-09-09 — the first draft of the follow-gate

`2026-09-09_0041_a_diary_with_a_door.sql` and
`2026-09-09_0042_close_the_direct_read.sql` are an earlier, differently-written
draft of the change that put an entry's opinion behind a follow. They were
superseded the same day by `0041_opinions_behind_a_follow.sql` and
`0042_close_the_door_on_reviews.sql`, which are the ones that shipped and the
ones the app reads.

The first of the two was applied to production before it was abandoned, which
left `public.entries` and `private.can_read_entry()` in the live database for a
day, alongside the `reviews_readable` view and `can_see_entry()` that replaced
them. `0047_remove_the_other_door.sql` dropped both. The second file was never
applied anywhere.

They are kept for the header comments rather than the statements: the argument
for masking columns instead of hiding rows, the note on why a table-wide
`revoke select on public.reviews` would take the database down by disarming the
policies that read `reviews.user_id`, and the reasoning about which columns
belong on which side of the line. That reasoning survived into the shipped pair
and is why the shipped pair looks the way it does. See T-003 in `ISSUES.md`.
