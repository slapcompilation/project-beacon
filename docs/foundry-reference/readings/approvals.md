---
verify: strict
---

# Approvals

The last unread Known gap. The map entry pointed at Control Panel, but the
Control Panel page is a 19-line pointer to the real product: the **Approvals
application**, a whole mirrored section. Requests hold tasks, reviewers are
whoever could have made the change themselves, and an approved request is
*invoked* — the platform applies the change, not the requester.

**What I read, counted rather than asserted.**
`administration/control-panel-approvals` (19 lines, whole),
`approvals/overview` (86 lines, whole), `approvals/review-a-request` (45
lines, whole). `approvals/_index` is **byte-identical to `approvals/overview`
past the source line** — the fifth double-mirrored slug found, verified by
diff. **Images: all fifteen parsed** — seven at the first reading
(`approvals_inbox.png`, `request_example.png`, `request_actions.png`,
`partially_approved_request.png`, `tasks_eligible_to_review.png`,
`task_checkpoints.png`, administration's `control-panel-approvals-inbox.png`)
and the remaining eight in the 2026-08-24 accuracy pass, which I had named
unparsed: `requests_to_review2.png`, `reviewer_tasks2.png`,
`adding_a_reviewer.png`, `approving_a_task.png`, `approval_all_tasks.png`,
`all_comments.png`, `marking_access_request_comment.png`,
`notifications.png`. §7 records what the eight added.

## 1. The loop: request → approve → invoke

> "A user may not have permission to make a particular change in Foundry and needs to make a request for that change. This request gets routed to administrators for approval. The request is invoked when the necessary approvals are obtained, meaning that the requested changes are applied."

— `approvals/overview.md`

Invocation is the load-bearing half: the product does not merely record a
yes — it *applies the requested changes*. And the record outlives the
decision:

> "Requests are persisted even if they have been completed, so you can reference them as an audit log of past decisions."

— `approvals/overview.md`

## 2. Requests and their six states

> "A request includes a set of tasks that must *all* be approved for the tasks to be invoked, which applies the requested changes."

— `approvals/overview.md`

The six request states, enumerated: **Pending approval**, **Closed** ("A
closed request cannot be reopened"), **Rejected and Closed**, **Changes
requested** ("The request stays open and eligible users can edit it or
provide further justification"), **Action required** (approved but blocked on
incomplete checkpoints), **Completed** (invoked). Actions: "Requests can be
edited or closed by the requesting user or by any eligible reviewers. Only
eligible reviewers can `approve`, `reject` or `reject and close` a request."
The Reject dropdown's own captions: Request changes — "You can edit the
request yourself for quicker resolution"
(`approvals/images/request_actions.png`); Reject and Close — "Closed requests
cannot be re-opened" (`approvals/images/request_actions.png`).

What `request_example.png` adds: a request carries a **title**, a free-text
justification, creator and date, and a collapsible Request details block
naming the **target** (Target project: Aircrafts). The footer states the
invariant as arithmetic — "0/2 tasks approved. All tasks must be approved
before the task can be completed." — beside Close / Edit / Reject / Approve.

## 3. Tasks: typed payloads, three states, derived eligibility

> "A task is an individual change in Foundry. *All* tasks associated with a request must be approved for the request to be invoked and requested changes to be applied."

— `approvals/overview.md`

Task states: **Review** (default), **Approved**, **Rejected** — and a
rejection is not final while the request lives: "an eligible reviewer can
return to this task and override the initial rejection with an approval."

The published task kinds are five: Group membership, Project access request,
Marking access request, Add reference request, Ontology proposal (which
"will redirect to the Ontology Manager"). Each names its approver by the
permission it needs — and the general rule is the important sentence in the
whole corpus:

> "By default, users who have the permission to perform an action themselves are eligible to review the corresponding task."

— `approvals/review-a-request.md`

Eligibility is DERIVED from the permission model, never stored. The captures
render it as a hard split — Tasks eligible for your approval / Tasks
ineligible for your approval (`approvals/images/tasks_eligible_to_review.png`)
— and a task's payload as typed field rows: User to add, Group to update,
Group role on project, Marking. Partial review is first-class:

> "If a request has multiple tasks with different eligible reviewers, actions by a reviewer are only applied to the tasks they are eligible to review."

— `approvals/overview.md`

`partially_approved_request.png` adds the decision trail: an approval lands
in the comments rail as a system entry (Approved: Group membership, with a
timestamp), task chips carry tooltips (Approved · 1 approved; In progress ·
Waiting on review), and the Approve button greys once the caller's eligible
tasks are done while the request waits on someone else's.

## 4. Reviewers can be invited, and invitation grants nothing

> "Note, inviting a reviewer does not grant permissions to view a request or approve tasks."

— `approvals/review-a-request.md`

Assignment is automatic ("users who have permission to approve a task will
automatically be assigned as approvers once the request is created");
invitation only notifies. Comments attach to the request or to a single task,
and "allows you to add links and upload files".

## 5. The Control Panel integration is a filtered window

> "Control Panel features a dedicated [Approvals](/docs/foundry/approvals/overview/) integration designed to facilitate the process of requesting, approving, and maintaining a history of sensitive workflows within Control Panel."

— `administration/control-panel-approvals.md`

Its three supported workflows are all infrastructure we do not model
(network ingress, egress, SDK web hosting), and the platform-version dialogs
we read earlier write "self-approved" requests into this inbox. The capture
(`administration/images/control-panel-approvals-inbox.png`) shows the same
inbox grammar embedded in Control Panel chrome: Requests to review / My
requests / All requests with Open/Completed/Closed sub-filters and In
progress pills. One product, two windows.

## 6. What this platform cannot hold yet

- **Checkpoints** are their own unbuilt product; the **Action required**
  state exists only because of them ("if a request is approved, but required
  checkpoints are incomplete, the request cannot be invoked"). A state
  nothing can produce is a false vocabulary token.
- **Notifications** (email/in-platform, the five configurable kinds) need a
  notification system that does not exist here.
- **Add reference request** invokes a Project-references mechanism we have
  no table for.
- **File upload on comments** needs object storage we do not use.


## 7. What the eight later-parsed captures added (2026-08-24)

- **The inbox has two label generations.** `requests_to_review2.png` says
  Requests to review / My requests where `approvals_inbox.png` says Your
  inbox / Created by you — and each page's PROSE matches its own capture.
  Ours follows the overview's labels; noted as an era split, not an error.
- **Inbox rows carry the request's target path** and the list header a Type
  filter (`requests_to_review2.png`) — enrichment not built, recorded.
- **A group-membership task displays the group's role on the project**
  ("Group role on project — Viewer",
  `approvals/images/reviewer_tasks2.png`) — display enrichment, recorded.
- **+ Review opens a per-task Approve/Reject menu** and the Actions dropdown
  holds Approve all / Reject all (`approving_a_task.png`,
  `approval_all_tasks.png`). Ours renders the same two verbs inline and its
  Approve button is approve-all-eligible; no Reject all — recorded.
- **Comments are author-attributed bubbles**, threaded back-and-forth, with
  @-mentions, per-task comment counts on task heads, and a per-task filter
  dropdown replacing All (`all_comments.png`,
  `marking_access_request_comment.png`). The author display was a real gap in
  our stream, fixed in the accuracy-pass PR; attachments render inline (a
  training certificate) — files still wait for storage, as Decision 6 said.
- **The invite popover** is a user-and-group search with Save
  (`adding_a_reviewer.png`); invitation stays out (no notification system to
  make it mean anything).
- **`notifications.png`** confirms the five Approvals notification kinds as
  account-settings toggles (Email/Web per kind) — the §6 ruling stands.

## Decisions

1. **Two tables, `approval_requests` and `approval_tasks`**, with the
   published vocabularies on the prose side: request states
   pending_approval / closed / rejected_and_closed / changes_requested /
   completed — **action_required deliberately excluded** until checkpoints
   exist, the emit-only rule applied to a state (the divergence is scoped:
   it returns with checkpoints, never before). Task states review /
   approved / rejected.
2. **Task kinds admit only what an invoker here can execute**:
   group_membership (→ `group_members`), project_role (→
   `project_role_grants`), marking_member (→ `marking_members`), and
   ontology_proposal (→ a pointer to the existing `ontology_proposals` row,
   the page's own redirect shape). add_reference waits for a references
   mechanism. Each kind's payload is jsonb with its required fields CHECKed,
   the audit-categories pattern.
3. **Eligibility is computed, never stored** — one function per kind
   composing the predicates that already exist (group manage, project owner,
   marking manage, ontology owner), because the page derives reviewers from
   "the permission to perform an action themselves". Reviews are recorded
   per task (reviewer, verdict, at); a later approval overrides a rejection
   while the request lives.
4. **Invocation is the platform's, and automatic**: when the last task
   approves, a SECURITY DEFINER invoker applies each task's change through
   the real write paths and stamps Completed. "The request is invoked when
   the necessary approvals are obtained" — no second button.
5. **The approvals writes are audit producers**: requestCreate,
   requestApprove and requestExecute join `audit_categories()` in the same
   migration as their emitters — the categories 645's reading matched to
   this exact lifecycle, arriving with their producers as the rule demands.
6. **Comments** are request- or task-scoped text with links; files wait for
   storage. System entries (an approval landing in the stream) are rows the
   engine writes, per the capture.
7. **The surface is an Approvals inbox page** with the captures' grammar:
   Your inbox / Created by you / All requests, the status sub-filters, the
   request page's eligible/ineligible split, typed payload rows, and the
   n/m footer. Ships as its own PR after the engine.

## Questions

1. **Who is an "eligible user" for Close beyond requester and reviewers?**
   The prose says "Eligible users can close a request if it is no longer
   relevant" and separately names requester-or-reviewers for edit/close.
   Taken as exactly that set. `blocks: nothing.`
2. **Does invoking a group_membership task honour group expiration
   (max_duration)?** The page is silent; the invoker writes through the
   real path, so whatever the path enforces holds. `blocks: nothing.`
3. **Request access to a Project names a target project; is the target
   column polymorphic?** The captures show only project targets, but the
   ontology_proposal kind targets an ontology branch. Ours: the target
   lives per task in the payload, and the request's display target is
   derived from its tasks. Marked as our shape. `blocks: nothing.`
