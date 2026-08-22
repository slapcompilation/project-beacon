---
verify: strict
---

# The Compass Activity log

The coherent surface the provenance columns have been waiting for — named as a
phase in DELIVERABLE-MAP when 636/637 gave the who-columns their writers, and
read now because a phase starts with a reading.

**What I read, counted rather than asserted.** `compass/use-project-details-panel`
(39 lines, whole page) and `compass/use-project-navigation-panel` (whole page,
its Trash section already cited by 620/636). `projects/use-project-details-panel`
is **byte-identical to the compass copy** — the fourth double-mirrored slug
found (`manage-roles-`, `ontology-best-practices-and-anti-patterns`, the
`projects/` panel pair), confirmed by diffing past the source comments.
`security/audit-log-categories` was read for its framing and its category
grammar, not in full: it is 41KB of enrollment-audit vocabulary and a different
mechanism (§4).

**Images: one of six parsed.** `project-details.png` is read in full below; the
nav panel's five (`project-navigation.png`, `autosaved.png`, `references.png`,
`move-to-trash.png`, `restore-trash.png`,
`project-navigation-with-project-usage-link.png`) are **not parsed** — named so
the debt is recorded. None of the six captures the Activity feed itself, which
is the observation §2 turns on.

## 1. The entire prose specification is one paragraph

> "The Activity log provides a running view of changes made throughout the Project and is only visible at the Project level. For teams building out a new Project or maintaining a long-term Project, the Activity log makes it easier to understand recent activity and collaboration. Note that the Activity log only stores the last month of activity."

— `compass/use-project-details-panel.md`

Four facts: a running view of **changes**; **Project-level only** (not folders,
not files); the audience is teams understanding recent collaboration; and a
**one-month retention**, stated as what the log *stores* rather than what it
shows — so longer storage would diverge from the page, not merely display
differently.

And one consuming instruction elsewhere, which is what makes the log
load-bearing rather than decorative — it is Compass's own answer to "did my
action land?" while search indexing catches up:

> "To confirm the item's state while the listing catches up, review the Activity log for the Project, or open the item or folder directly and verify that it shows as In trash."

— `compass/use-project-navigation-panel.md`

## 2. What the image adds, and the thing nothing shows

`project-details.png` draws the details panel as a right-hand rail of five icon
tabs — an info tab (Overview, selected in the capture), a lock (Access), an
**activity-feed icon**, a chart, and a wrench. So Activity is a *tab of the
details panel*, a sibling of Access, not a page of its own.

The Overview tab itself displays provenance: a **Last modified** line with a
date *and a user*, and a **Views** counter. That is the fourteen
self-populating columns' display gap, one tab over from where the Activity log
lives.

**No capture anywhere shows the Activity feed's rows.** Not this page, not the
nav panel's five images. The row grammar — what a change line says, whether
entries group, what an actor renders as — is unpublished in both prose and
pixels.

## 3. What already exists here

The who/when pairs are populated on every Compass write path after 636/637:
trash and restore on four tables, markings, tags, collections, group members,
datasource attachment, curators, and the transaction lifecycle (638). The
automation event log (622) is the in-repo precedent for the shape: an event
table, writers on the real paths, and a vocabulary admitting only what a
writer produces.

## 4. This is not the audit log

> "Audit log categories simplify security monitoring by allowing you to identify events of interest based on **what happened** rather than needing to enumerate every possible event name across all Foundry services."

— `security/audit-log-categories.md`

The enrollment audit log is a security-monitoring mechanism with a published
category vocabulary (`audit.3`), org-wide scope, and analysts for an audience.
The Activity log is a Project-scoped collaboration view with a one-month
retention. Same raw material, different products — building one as the other
would borrow a vocabulary across mechanisms, which is the two-vocabularies trap.

## Decisions

1. **One table, `project_activity`, written by triggers on the paths that
   change project resources** — the same shape as 622's metadata trigger,
   because "any user" can reach a change by more than one route and a call-site
   writer is how `trashed_by` went unwritten for months. One row per change:
   project, actor, action, resource kind and id, a display-name snapshot (the
   resource may be deleted later; a log that dangles is unreadable), occurred
   at `clock_timestamp()` (624's lesson).
2. **The action vocabulary admits only what a writer here produces.** This is
   the event-log kind from 639's distinction — a log records *history*, so a
   token nothing emits is a false past. The starting set is the write paths
   that exist: created, renamed, moved, trashed, restored, marking applied and
   removed, tag applied and removed, added to collection, transaction
   committed and aborted. Each arrives with its trigger in the same migration
   or not at all.
3. **The row grammar is ours and marked as such.** Nothing publishes it (§2).
   Actor + action + resource + time is the least structure that serves the
   quoted purpose; anything richer (grouping, diffs, icons per action) would be
   invented pixels.
4. **Retention is enforced by a deletion the platform runs, because "only
   stores" is a fact about storage.** A daily arm on the existing pg_cron
   heartbeat deletes rows older than the month. **This is the repository's
   first unattended destructive job**, which is why this Decisions block exists
   to be read: the deletion is scoped to one table by name, proved by a probe
   that plants an old row and a young one and shows exactly one survives, and
   the arm runs through the same scheduler the builds already trust.
5. **The surface is a tab on the Project page, Project-level only.** "Only
   visible at the Project level" is a refusal shape: folders and files do not
   get the tab. Read access follows project membership — the log is a view of
   the project, so project viewers see it.
6. **The Views counter and the enrollment audit log are not this phase.**
   Views is read-tracking ("changes made" excludes reads); the audit log is
   §4's different product.

## Questions

1. **Is "the last month" thirty days or a calendar month?** The page does not
   say. Thirty-one days keeps every reading of "a month" and is the choice
   that deletes *less*; marked as ours. `blocks: nothing` — the probe pins
   whatever constant is chosen.
2. **Does a rename record the old name, the new, or both?** No row grammar is
   published, so nothing answers it. The name snapshot in Decision 1 stores
   the name *after* the change; the old name is in the previous row for the
   same resource. `blocks: nothing`.
3. **Should ontology saves appear?** `save_working_state` changes project
   resources in the broad sense, but the Ontology Manager has its own history
   surfaces and the page scopes the log to the *Project* workspace. Left out
   until a page connects them. `blocks:` nothing today; revisit if a Compass
   page names ontology resources in an activity context.
