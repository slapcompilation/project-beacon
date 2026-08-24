---
verify: strict
---

# Checkpoints

The sweep queue's second-ranked phase: the data-governance product that
interrupts a sensitive interaction with a justification prompt, records the
answer, and makes the record reviewable. It is also the product that owns the
approvals `action_required` state our 651 engine deliberately left out.

**What I read, counted rather than asserted.** All seven prose pages of
`checkpoints/`: `_index` (31) and `overview` (31 — the same content under two
slugs, differing only in source URL; the eighth double-mirrored pair),
`core-concepts` (24), `configure-checkpoints` (112), `checkpoint-types` (148,
every row of all six tables), `review-checkpoint-records` (42),
`checkpoints-marketplace` (37). And the six `api/checkpoints-v2-resources*`
pages: `get-record` (251, the full Record shape), `search-records` (371, the
filter grammar), `get-records-batch` (255 — the same Record schema behind a
batch wrapper, max 100), `record-basics` and the two section stubs (5 lines
each).

**Images: twelve of fourteen parsed** — `checkpoints-app.png`,
`export-checkpoint.png`, `checkpoint-conditions.png`, `checkpoint-prompt.png`,
`checkpoint-justification-type.png`, `checkpoints-frequency.png`,
`checkpoint-config-name-description.png`, `checkpoint-type-selector.png`,
`checkpoints-review-tab.png`, `checkpoints-action-form.png`,
`recent-justifications-config.png`, `recent-justifications-example.png`.
The two I skipped, named: `checkpoint-scope.png` and `checkpoint-selected.png`
— both captures of the Marketplace packaging flow §7 excludes.

## 1. What the product is

> "Checkpoints allows you to interrupt potentially sensitive user interactions with prompts requesting justification for the activity."

— `checkpoints/overview.md`

Three nouns carry the whole grammar:

> "The prompt in each checkpoint and the type of justification required is set in a **checkpoint configuration**."

— `checkpoints/overview.md`

> "Once submitted, each checkpoint produces a **checkpoint record** that contains the contextual data associated with an interaction governed by a checkpoint."

— `checkpoints/overview.md`

> "Checkpoints is integrated into 60+ different interactions in Foundry, which allows for seamless requests for justification at a variety of points in user workflows."

— `checkpoints/overview.md`

The user-side dialog (`checkpoints/images/export-checkpoint.png`) shows the
shape while a download is held behind a "Verifying download…" toast: a
flag-icon "Checkpoint" header, the configured title with a warning glyph, the
prompt, the description in lighter indented text, an acknowledgment checkbox,
the submitting username and timestamp, and Cancel/Submit with Submit disabled
until the box is checked.

## 2. A configuration is five wizard steps

The captures settle the creation flow: a five-step rail — Conditions, Prompt,
Justification type, Frequency, Name and description
(`checkpoints/images/checkpoint-conditions.png`).

**Conditions, the required half.** A configuration names one or more
checkpoint types and exactly one scope:

> "A checkpoint configured with an organization scope will only prompt users who are members of that organization."

— `checkpoints/configure-checkpoints.md`

> "A checkpoint configured with a space scope will only prompt users when they are interacting with a resource that is contained within that space, regardless of the user's organization."

— `checkpoints/configure-checkpoints.md`

**A vocabulary trap on the scope itself.** The prose says *space*; the
wizard's scope selector offers tabs labeled "Organization | Namespace"
(`checkpoints/images/checkpoint-conditions.png`), and the wire carries
`namespaceRid` throughout. The api's own `scope` enum recasts the pair
functionally — `USER_SCOPED` / `RESOURCE_SCOPED`:

> "Indicates whether the checkpoint was scoped to a user or resource."

— `api/checkpoints-v2-resources-records-get-record.md`

An organization scope gates by who the user is; a space scope gates by where
the resource lives. The same capture shows a **Conflicts** section the prose
never mentions — a green "This has no conflicts with other existing
checkpoint configurations." check
(`checkpoints/images/checkpoint-conditions.png`).

Configuring takes the Data governance officer role (organization scope) or
the `Administer resource-scoped checkpoint configurations` operation /
Space Administrator (space scope) — the same operations machinery our
capabilities engine holds.

## 3. Seven additional condition kinds, AND or NOT

> "Different checkpoint types support different sets of condition types."

— `checkpoints/configure-checkpoints.md`

> "For checkpoint configurations that include multiple checkpoint types, only the condition types common to all of those checkpoint types can be used."

— `checkpoints/configure-checkpoints.md`

The kinds: **Locations** (a resource, a Project, or a space), **User
submitting checkpoint** (the interacting user, or membership of a group),
**Selected user or group** (a principal selected *in* the interaction, with a
member-groups flag), **Markings**, **Action type**, and **Object set** with
six variants (object type, type group, ontology, datasource location,
datasource marking, saved exploration or list). Each condition can be a
matcher or an exemption:

> "If the `NOT` option is selected, the checkpoint will only show up if the condition is false."

— `checkpoints/configure-checkpoints.md`

> "You can specify only one matcher of each type per checkpoint configuration, but there is no limit on the number of groups, users, resources, or markings you can exempt with exemption matchers."

— `checkpoints/configure-checkpoints.md`

## 4. Language, and the four justification types

Title (with "Use less than 45 characters to render fully within the
checkpoint." — `checkpoints/configure-checkpoints.md`), prompt, optional
description, and:

> "The checkpoint description and prompt fields support Markdown syntax."

— `checkpoints/configure-checkpoints.md`

The four justification types, drawn as four preview cards
(`checkpoints/images/checkpoint-justification-type.png`) — where the card
reads "Acknowledgement" against the prose's "Acknowledgment", and the api
union agrees with the card (`acknowledgementJustification`):

- **Acknowledgment** — a checkbox with configured text.
- **Response** — free text;

> "Use the **Response Validation** field to provide a regular expression to validate users' free-text responses. If left empty, any user-submitted response will be accepted."

— `checkpoints/configure-checkpoints.md`

  The edit capture adds a field the prose omits: **Placeholder Text**,
  "Placeholder text for the free response text box."
  (`checkpoints/images/recent-justifications-config.png`).
- **Dropdown** — predefined options, each row carrying its own label, a
  per-item Free response select and a per-item Display-recent checkbox, plus
  an Advanced "Allow selecting multiple items" toggle
  (`checkpoints/images/checkpoint-justification-type.png`);

> "If users can select multiple options, the dropdown will be presented as a set of checkboxes to the user."

— `checkpoints/configure-checkpoints.md`

- **Reauthentication** — "This will allow users to submit a justification by reauthenticating with the platform." (`checkpoints/configure-checkpoints.md`), unavailable for Login and Scoped session select types.

**Recent justifications** are a bounded convenience:

> "Enabling this option for a given free-text response field will allow users to auto-populate their free-text response by selecting one of their 5 most recently submitted justifications from the past month for this checkpoint configuration."

— `checkpoints/configure-checkpoints.md`

The user-side capture renders them as a history dropdown under the response
box, each with a "Last used on" line
(`checkpoints/images/recent-justifications-example.png`).

**Frequency** exists for exactly one type:

> "You can configure the checkpoint to display for a user only after some specified amount of time has passed since the user last saw the same checkpoint."

— `checkpoints/configure-checkpoints.md`

The step renders disabled with "Frequency can only be set for login
checkpoints" for every other type
(`checkpoints/images/checkpoints-frequency.png`).

**Name and description are reviewer-facing**, never shown in the prompt —
"This title will only be visible to reviewers. It does not appear in the
checkpoint itself." (`checkpoints/images/checkpoint-config-name-description.png`).

## 5. Records: a static snapshot with a typed justification

A record holds the user, timestamp, checkpoint type, the language *as shown*:

> "These values are inherited from the checkpoint configuration but are static; they always reflect the text shown to a user in the checkpoint and will not be updated if the underlying checkpoint configuration is edited or deleted."

— `checkpoints/core-concepts.md`

plus the justification, the checkpointed items, its own RID and the
configuration's RID. The api adds what the prose omits: `justification` is a
four-member **union** ("Justification submitted by the user to pass a
checkpoint." — `api/checkpoints-v2-resources-records-get-record.md`) whose
members each re-carry prompt/title/description; `CheckpointedItem` is a
~20-member union (resource, group, marking, principal-with-role, action type
with ontology snapshot, versioned object set, job, schedule, token…); every
name-like string sits in a redaction wrapper (`USER_REDACTED` /
`RESOURCE_REDACTED`); records carry `interactionRid`, `delegateUserId`, and
`approvalsMetadata` (task id + subtask ids) — the wire proof of the Approvals
integration. The search grammar: `eq` on nine fields, `lt`/`gte` on
`createdAt` only, `textSearch` on the three justification fields with
`EXACT`/`CONTAINS`, `checkpointedItemId` by typed id, and `and`/`or`/`not`.

**Review permissions are four doors**: record creator; the
`checkpoints:review-records` operation on the checkpointed resource (granted
to no default role — the workflow-catalogue finding again); Space
Administrator on the containing space; Data governance officer for the
organization. And redaction is per-item:

> "Foundry redacts certain resources or users contained in a record if you do not have the necessary permissions to view that item."

— `checkpoints/review-checkpoint-records.md`

The app (`checkpoints/images/checkpoints-app.png`) is two tabs, Review and
Configuration. Review: a filter rail (Organization, Space, Time, Submitting
user, Checkpoint type, Checkpointed resource) over a table of Time / Type /
User / Justification / Recorded item — an acknowledgment renders as a checked
box in the Justification column while a response renders as text
(`checkpoints/images/checkpoints-review-tab.png`) — and a details panel:
Justification time, Created by, type, Language, a "View current
configuration" link, the justification with its type chip, and one card per
checkpointed item with RID and HISTORICAL DETAILS (name, path, project)
(`checkpoints/images/checkpoints-app.png`).

## 6. The two integration seams

**Actions.** Submit action checkpoints embed:

> "If an Action form is shown, **Submit action** checkpoint prompts will be rendered as required fields inside the form."

— `checkpoints/checkpoint-types.md`

The capture shows the checkpoint as a bordered block inside the form with the
submit button disabled under a tooltip "Some Checkpoint prompts have not been
justified" (`checkpoints/images/checkpoints-action-form.png`).

**Approvals.** The asynchronous path, and the state it unlocks:

> "The corresponding tasks will display whether checkpoints have been completed or not. The requesting user is usually required to complete checkpoints when the request is made. If that does not happen, eligible reviewers can complete checkpoints on behalf of the requesting user."

— `approvals/overview.md`

and Action required exists because of this: a request approved on every task
still "cannot be invoked until the checkpoints are submitted"
(`approvals/overview.md`). Our 651 excluded `action_required` as a state
nothing could produce; checkpoints are what produce it.

## 7. The catalogue, and what stays out

`checkpoint-types` enumerates ~100 types in five categories (Download,
Upload, Manage security, Login, Other) plus three legacy ones —

> "Checkpoints can no longer be configured for these legacy checkpoint types, but historical checkpoint records of these types are still reviewable."

— `checkpoints/checkpoint-types.md`

The selector groups by category and by application
(`checkpoints/images/checkpoint-type-selector.png`). Most rows name products
we do not build (Contour, Notepad, Gaia, Cipher, Code Workspaces, Flow
Capture, Peer Manager…). The interactions we CAN intercept, because the
producing path is ours: submit action (`apply_action`), group member
addition/removal, marking member addition/removal, role grant
addition/removal, schedule create/modify/run/delete, run build, token create,
object set export, compass import (dataset upload), login.

Out, each with its reason: **Marketplace packaging** (its own page, its two
captures — a DevOps product we lack; also "Only checkpoint configurations
with a single checkpoint type can be included in Marketplace products." —
`checkpoints/checkpoints-marketplace.md`); **Login checkpoints in tranche
one** (the page's own callout demands a dedicated asynchronous user manager
even in Foundry, and our login path — the access-token hook — has no
interactive prompt surface); the **object-set condition variants** (they
condition on Explorer artifacts; second tranche); **reauthentication** (our
auth substrate has no re-auth ceremony to invoke); the ~80 types of absent
products.

## Decisions

1. **Three tables and an items table**: `checkpoint_configurations` (name and
   description reviewer-only; title/prompt/description as the shown language;
   justification type + per-type config jsonb CHECKed the audit-categories
   way; checkpoint_types as a text[] over an emit-only set; scope =
   organization XOR space, the wire's USER_SCOPED/RESOURCE_SCOPED derived,
   never stored); `checkpoint_conditions` (kind, negated flag, per-kind
   payload — the group-assignment-conditions pattern; one matcher per kind
   enforced, exemptions unlimited); `checkpoint_records` (user, created_at,
   type, the **static language snapshot**, justification jsonb in the api's
   union shape, config id, RID, interaction reference); and
   `checkpoint_record_items` (kind + typed reference per row, the
   CheckpointedItem union flattened).
2. **The checkpoint-type vocabulary is emit-only**: first tranche admits only
   types whose producing path is ours — `submit_action`,
   `group_member_addition`, `group_member_removal`,
   `marking_member_addition`, `marking_member_removal`,
   `role_grant_addition`, `role_grant_removal`, `schedule_create`,
   `schedule_modify`, `schedule_run`, `schedule_delete`, `run_build`,
   `token_create`, `compass_import`, `object_set_export` — snake_case of the
   prose table's names (the enumeration), with the wire's CAPS enum a wire
   concern. A type arrives WITH its interception, never before.
3. **Enforcement is a gate inside the producing path**: the operation calls
   `checkpoint_gate(type, items…)`; if an applicable configuration matches
   (scope + conditions) and no satisfying record accompanies the interaction,
   it refuses with a namespaced error carrying the configured language for
   the surface to render (`Checkpoints:JustificationRequired`); the surface
   collects the justification, `submit_checkpoint(...)` writes the record,
   and the retried operation consumes it — stamping the record's interaction
   reference. Transactional, and the record↔interaction link is the wire's
   own `interactionRid`. This is the inferred mechanism (no page states where
   Foundry enforces); the observable contract — the interaction is held
   until a record exists — is the captures'.
4. **Condition kinds, first tranche**: location (resource/project/space),
   user_submitting (user or group), selected_principal (user or group with
   the member-groups flag), marking, action_type — each AND or NOT.
   Object-set variants wait for their artifacts.
5. **Justification types**: acknowledgment, response (regex validation +
   placeholder), dropdown (items each with disabled/optional/mandatory free
   response, multi-select flag). Reauthentication is excluded with its
   reason. Recent justifications are a query — 5, past month, per config,
   per user — not a table.
6. **Review visibility is the four doors**: creator; org admin (our Data
   governance officer analogue); space admin; and a
   `checkpoints:review-records` operation registered in the capabilities
   engine, granted to no role by default — the page's own shape. Redaction
   of individual items a viewer cannot see is second tranche; the record
   row itself follows the doors.
7. **Approvals gets its state back**: `action_required` joins
   `approval_requests` — entered when an approved request's invocation is
   refused by the checkpoint gate, left when the checkpoint is submitted
   (by requester or an eligible reviewer, per the page). The 651 divergence
   closes exactly as it was scoped to.
8. **The surface** (own PR after the engine): a Checkpoints app with the
   captures' two tabs — Review (filter rail, the five-column table,
   details panel with item cards) and Configuration (the five-step wizard,
   including the conflicts check) — plus the prompt dialog component the
   gated surfaces render, and the Submit-action embedding in the action
   form.

## Questions

1. **Where does Foundry enforce?** No page states whether the server refuses
   an unjustified interaction or the client merely mediates. Decision 3
   builds the gate server-side because a client-only prompt is not a guard.
   `blocks: the build shape — flagged for the operator gate.`
2. **What is an interaction identifier?** `interactionRid` appears with no
   grammar page. Ours: the produced row's id (the group_members row, the
   build id…), recorded on the record. `blocks: nothing.`
3. **Does the conflicts check refuse or advise?** The capture shows a green
   pass; whether a conflict blocks saving is unstated. Ours: advisory,
   because the page says nothing stricter — do not be stricter than Foundry.
   `blocks: nothing.`
4. **Frequency beyond login** — the api records nothing about display
   frequency, and the wizard disables it elsewhere; excluded with login
   itself. `blocks: nothing.`
