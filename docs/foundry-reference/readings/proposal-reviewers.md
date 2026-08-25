---
verify: strict
---

# Inviting reviewers: the list that tracks who should review

The queue's entry was a table nothing reaches — `proposal_reviewers`, built
in 420 and never written. 628 kept it rather than dropping it, on the
grounds that an unreached member of a live feature is a question rather
than an answer. This is the answer: it is the invite list, and its own
page says exactly what it does and does not do.

**What I read, counted rather than asserted.**
`ontologies/branching-ontology` whole (the Merge requirements section is
where reviewers live), and `ontologies/test-changes-in-ontology`, whose
Review-the-proposal section is byte-identical to the other's. **Images: two
parsed** — `ontologies/images/ontology-proposal-review-tab.png` and
`ontologies/images/review-protected-object.png`. Unparsed from these pages,
named, all belonging to the rebase and merge flows this arc does not touch:
`review-rebase-changes.png`, `review-object-type-rebase-changes.png`,
`current-employee-example.png`, `current-employee-example-conflicts.png`,
`finish-rebase-and-save.png`, `branch-is-up-to-date.png`,
`create-proposal-taskbar.png`, `create-proposal-dialog.png`,
`branch-taskbar-review-button.png`,
`test-changes-foundry-branching-merge-branch.png`.

## 1. The list tracks, it does not gate

> "Users with approval rights can approve proposals even if not added as reviewers. Use the reviewers list to track who should review changes, not to restrict approvals."

— `ontologies/branching-ontology.md`

This is not a divergence from 651's computed eligibility — it is the other
half of the same design. Eligibility is derived from the permission to make
the change (651); the reviewers list is advisory, and the page says so in a
warning callout. 420's table comment already carried this sentence; nothing
ever wrote the table.

Where the invite happens:

> "You can add reviewers to your proposal through the branch taskbar, the Global Branching proposal page, or the ontology proposal page."

— `ontologies/branching-ontology.md`

> "On the ontology proposal page, go to **Review changes** and select **Invite reviewers** to add reviewers to your proposal. For ontology resources that have migrated to projects, select **View policies** to see which reviewers are required to review a resource based on the associated project policies."

— `ontologies/branching-ontology.md`

And the scope, which 420 already built to:

> "While ontology entities are treated as separate resources in Global Branching, they are grouped under a single local ontology proposal. This means adding a reviewer to one ontology resource effectively adds that reviewer across all ontology resources."

— `ontologies/branching-ontology.md`

## 2. Anyone may review; only some reviews count

> "In the **Review changes** tab, reviewers may approve or reject individual tasks. Users without permissions may still review the task, for example, to convey their opinions on the change, but this will not affect the approved status of the task."

— `ontologies/branching-ontology.md`

Our `task_approval_status` already implements the second half exactly —
it counts only approvals whose author passes `user_can_edit_resource` or
sits in the project's `policy_reviewer_ids`. What no function exposes is
the *first* half as a question the surface can ask: **may this caller's
review count?** The capture needs it, because it labels a section with it.

## 3. What the captures add that the prose does not

`ontologies/images/ontology-proposal-review-tab.png`: the Review changes
card's header row is `View policies ▾ | + Invite reviewers ▾ | ✕ Reject ▾ |
✓ Approve`, and beneath it a section label reading **"Tasks eligible for
your approval"** — so the page separates the tasks the viewer's approval
would count for from the rest. Each task row draws a status chip, the
resource's **icon and display name** (`Current employee`, `Workers`,
`Office`), then `Your review: + Review`, a comment count, and an expand
chevron. Expanded, a task shows `GENERAL INFORMATION` with an edit count
chip (`2 edits`) and per-field before/after — the old value struck through
in grey, the new one in green (`Employee` → `Current employee`) — then
`PROPERTIES` with `1 edit` and `Office ID` tagged `Deleted`. The left rail
runs Overview, Preview status, Review changes, Changelog under the proposal
name with a task count and status chip.

`ontologies/images/review-protected-object.png` draws the **View policies**
popover whole: a title `Branch approval policy`, the project as a link
(`Frequent Flyer Ontology Project`), then `Approval required from at least
2 users in the following:` over a redacted principal list, then a literal
`AND` separator, then `Reviewers cannot approve changes to files they have
contributed to in the proposed branch.` Those are precisely the three
columns 462 stored: `policy_approvals_required`, `policy_reviewer_ids`,
`policy_contributor_approval`.

**A vocabulary catch.** That capture's task chip reads `In progress` and
its proposal chip `Pending approval`, and the prose confirms the transition:

> "Once the policy requirements are met, approved resources change from `In Progress` to `Approved`."

— `ontologies/branching-ontology.md`

Our surface labels the same state "Awaiting approval" — an invented
spelling for a state the page names. The stored token
(`awaiting_approval`, a function return rather than a column) is internal
and stays; the label is what a reader compares against Foundry.

## 4. What our substrate holds, probed

`proposal_reviewers` (proposal_id, user_id, added_at) with both policies
already correct — read for anyone who can see the proposal, write for
anyone who can manage the branch. Zero rows, no reader, no writer.
`task_approval_status` computes the counting rule; `user_can_edit_resource`
and `projects.policy_*` are its inputs; `ontology_resource_row(kind, id)`
resolves a resource whole, so display names are available. The surface's
**Assigned to me** tab filters on `proposal_reviews` — people who have
already reviewed — which is not what assignment means.

## Decisions

1. **`can_approve_proposal_task(task)`** — a derived predicate answering
   whether THIS caller's approval would count, composing exactly what
   `task_approval_status` counts with (edit permission on the resource's
   project, or membership of `policy_reviewer_ids` where a custom policy
   names one). Composed, never restated: if the two ever disagree the
   surface would lie about whose review matters.
2. **`invite_proposal_reviewer` / `remove_proposal_reviewer`** are not
   needed — the table's RLS already says who may write it, so the surface
   writes rows directly. Recording this as a decision because the reflex
   would be to add functions; a policy that already answers the question is
   the rung the rule says to stop at.
3. **The surface gets the invite half**: `+ Invite reviewers` on the
   proposal, the reviewers list rendered with removal, and the tasks split
   under the capture's own label — **Tasks eligible for your approval**
   above the rest. Approve and Reject stay available on every task,
   because "Users without permissions may still review the task"; what
   changes is that the page says which reviews count.
4. **Assigned to me means invited**, not "has already reviewed" — the tab
   moves onto `proposal_reviewers`. This is the defect the unreached table
   was hiding.
5. **View policies** renders the popover's three lines from the project's
   own policy columns, in the capture's order and words, including the
   `AND` and the contributor sentence.
6. **The label becomes "In progress"** where the page names it, leaving the
   internal token alone.
7. **Not built, with reasons**: the per-task before/after edit diff
   (`branch_resource_changes` holds authorship, not a field-level
   before/after — that is its own arc), per-task comments (no comment store
   for tasks), and the branch-taskbar and Global-Branching invite entry
   points (we have neither surface).

## Questions

1. **Does inviting notify?** No page says, and we have no notification
   store. Ours: the list only. `blocks: nothing.`
2. **May a reviewer be a group?** The table keys `user_id`, the capture's
   picker is redacted, and no sentence names groups here. Ours: users, as
   420 built it. `blocks: nothing.`
3. **What does the Reject dropdown carry?** Drawn as `Reject ▾` in both
   captures with no menu open. 651's approvals have "reject and close";
   whether proposals share it is unattested. Ours: plain reject.
   `blocks: nothing.`
