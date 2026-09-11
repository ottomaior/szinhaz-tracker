# Working on Vastaps

Conventions for changing this repository. `README.md` explains what the product
is and why it is built the way it is; this file is only about how a change gets
from an idea to `main` without becoming something that cannot be taken back.

## Branches and merging

- **Anything beyond a one-line fix goes on a branch.** Name it the way the
  existing ones are named: a short phrase in kebab-case that says what the
  branch is for (`faces-for-the-people`, `subtitle-under-the-title`), or
  `feat/…` for a feature that will take several sessions.
- **Push the branch, open a pull request, merge it on GitHub with "Create a
  merge commit".** `main` carries a ruleset (`protect main`) that rejects a
  direct push, so the PR is the only way in. Nobody has to approve it — the
  PR exists so that CI runs on the exact commits about to land, and so that a
  merge commit is created: that commit is the undo handle, `git revert -m 1
  <merge-sha>` removes the whole feature in one step, which a squash or a
  fast-forward would make impossible without picking through the individual
  commits. Title the merge commit `Merge <branch>: <what it did>`, not the
  GitHub default.
- **CI must be green before merging.** `.github/workflows/ci.yml` typechecks,
  lints and runs the fixture tests on every push, and the ruleset requires the
  `check` job to pass before the PR can be merged. A green check on the branch,
  not on `main` after the fact, is the gate.
- **Pushing `main` deploys.** Railway builds from every push to `main`, so a
  merge is a release. Validate on the production URL, signed out and on a
  phone, once the deploy has finished.
- **Undo with `git revert`, never `git reset --hard` on anything pushed, and
  never force-push `main`.** A revert is itself a commit, so the history keeps
  both the mistake and the correction, and the deploy that follows is just
  another push.
- **Tag a deploy worth going back to** with an annotated `vX.Y.Z` tag on
  `main`, so "the state before the redesign" has a name rather than a SHA
  somebody has to hunt for. Not every merge needs one; one per milestone does.

## Migrations

`supabase/migrations/` is applied in order, by number. Git can revert the file;
it cannot revert what the file did to the database. So:

- **Never edit a migration that has been applied.** Write the next number.
- **Additive by default.** A column, view or function that the code stops
  needing is *not* removed in the same release that stops using it. Ship the
  code first, confirm nothing else read it, and drop it in a later migration.
  `0041` / `0042` and `0047` are the pattern: the additive half goes out under
  the running app, the destructive half only once a client reading the new
  shape is live.
- **A destructive migration argues its own safety** at the top of the file —
  what was checked, where, and why the drop is safe — and it says how to undo
  it: a `-- rollback:` block at the bottom giving the statements that would put
  the thing back. If it cannot be put back (data is gone), say so explicitly.
- **No `cascade` on a drop.** If the argument above is wrong, the migration
  should fail rather than quietly take a dependent with it.
- **Ask Ottó before any migration or backfill that changes or nulls data users
  have already stored**, even when the data is known to be wrong.

## Where things are written down

- `ISSUES.md` — bugs, rough edges and feature ideas, in English. Anything Ottó
  mentions in passing goes here, even while working on something else.
- `BACKLOG.md` / `BACKLOG.hu.md` — the launch plan. An idea that is accepted
  graduates out of `ISSUES.md` and becomes a backlog phase.
- `README.md` / `README.hu.md` — the product and its reasons. The English file
  is the original; when it changes, the Hungarian one is updated to match.
