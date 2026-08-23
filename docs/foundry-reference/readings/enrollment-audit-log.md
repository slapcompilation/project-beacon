---
verify: strict
---

# The enrollment audit log

The recorded Known-gap phase: DELIVERABLE-MAP says it "wants its own reading
before anything is built", written when 641 shipped the Project Activity log
and the two products were nearly conflated.

**What I read, counted rather than asserted.** All three security pages in
full: `security/audit-logs-overview` (450 lines), `security/audit-log-categories`
(176 lines, the whole category table), `security/monitor-audit-logs` (175
lines). All five pages of the api section:
`api/audit-v2-resources/log-files-list-log-files` and
`api/audit-v2-resources/log-files-get-log-file-content` are substantive; the
other three are copies of a one-line stub ("A file of audit logs").

**Images: one of one parsed.** `audit3-export-control-panel.png` is the only
image any of the eight pages references; §5 reads it.

## 1. What the product is

> "Audit logs provide a comprehensive record of every action taken in Foundry, enabling security teams to detect threats, investigate incidents, ensure compliance, and maintain accountability across the platform."

— `security/audit-logs-overview.md`

The audience is security analysts, the scope is the whole platform, and the
emitting half is *every service*: logs vary by product "because each product is
reasoning about a different domain". Two schemas exist; everything new is
`audit.3`:

> "All audit log analyses should use the new and improved `audit.3` schema logs to maintain continuity as we are in the process of fully migrating audit log archival from `audit.2` to `audit.3` for new audit logs."

— `security/audit-logs-overview.md`

`audit.2` is legacy — "for historical analysis only", no API ingestion, no
schema guarantees. We have no history, so it is dead weight here (Decision 6).

## 2. The audit.3 line, and its three guarantees

The schema is a 27-field table (`categories`, `entities`, `eventId`,
`logEntryId`, `name`, `orgId`, `origin`/`origins`, `product`, `producerType`,
`requestFields`, `result`, `resultFields`, `sequenceId`, `service`, `sid`,
`time`, `tokenId`, `traceId`, `uid`, `userAgent`, `users`, and the rest), with
three published guarantees:

> "**Union of categories:** Each log is produced strictly as a union of audit categories. This means that logs will not contain free-form data, ensuring predictable structure."

— `security/audit-logs-overview.md`

> "**Promoted key information:** Certain important information within an audit log is promoted to the top level of the `audit.3` schema. For example, all named resources are present at the top level, as well as within the request and result fields."

— `security/audit-logs-overview.md`

and explicit category definitions. Two field details that matter to us:

- `users` is a `set<ContextualizedUser>` whose `realm` and `groups` fields are
  **declared but empty**: "In the current `audit.3` pipeline, only the `uid`
  field is populated" — enrichment is explicitly pushed downstream. So even
  Foundry ships this schema half-populated, by design, for latency.
- `name` follows "a (product name)\_(endpoint name) structure in ALL CAPS,
  snake-cased" — but the page's own recommendation is to query by category,
  never by name.

## 3. Categories are the vocabulary, and it is enforced

> "In the `audit.3` schema, every event must be logged under one or more standardized categories that provide consistent request and result parameters."

— `security/audit-log-categories.md`

The categories page enumerates ~80 categories, each defining its request and
result fields with required/optional marks. The set spans far more than we
have producers for (`containerLaunch`, `llmInference`, `configureInfra`,
`sap`-adjacent infra…), and several are explicitly deprecated tombstones kept
for `audit.2` compatibility (`mandatoryControlManagement` "Replaced by
`managementMarkings` in `audit.3`", `systemManagement`, `dataUpdate`).

The ones our write paths could genuinely produce today: `managementGroups`
("Changes to group membership should always go through here."),
`managementPermissions` ("Anything that changes permissions on the platform."),
`managementMarkings` ("Anything that modifies access to mandatory controls."),
`managementUsers`, `dataCreate`/`dataDelete`/`dataLoad`, `userLogin`/`userLogout`
(the substrate's `auth.audit_log_entries` already records these events),
`requestCreate`/`requestApprove`/`requestExecute` (our `ontology_proposals`
lifecycle is exactly their "pull request, access request" shape).

## 4. Delivery and its permissions

Two published mechanisms, both per-organization:

- **API ingestion** (`audit.3` only): `list-log-files` + `get-log-file-content`
  under `/api/v2/audit/organizations/{organizationRid}/logFiles`, OAuth scope
  `api:audit-read`, token-based pagination where "The `nextPageToken` field is
  **always** present in the response". The archive is *files* — the endpoints
  page calls the resource "A file of audit logs", and the scope is its own:

  > "Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:audit-read`."

  — `api/audit-v2-resources/log-files-list-log-files.md`

  The content endpoint takes an opaque file id — "The ID of an audit log
  file" (`api/audit-v2-resources/log-files-get-log-file-content.md`) — and
  returns the body as a string; there is no file grammar to build against.

- **Export to a Foundry dataset** through Control Panel:

> "Both `audit.2` and `audit.3` logs can be exported, per-organization, directly into a Foundry dataset through the audit logs tooling in [Control Panel](/docs/foundry/administration/control-panel/)."

— `security/audit-logs-overview.md`

The export's knobs: markings ("By default, audit log datasets will be marked
with the organization selected above"), an optional start-date filter, and an
optional per-dataset retention policy "(max 730 days)" keyed to *transaction*
timestamps, not log timestamps. Trashing or moving the dataset halts its
builds after about an hour, and "**there is no way to restart these builds
once halted**".

Permissions name two operations, each reached through a role:

> "`audit-export:view` is a gatekeeper operation that must be granted to the client/user whose token is used in the auth header for the organization whose audit logs are being requested."

— `security/audit-logs-overview.md`

granted via a role that includes "the **Create datasets with audit logs for
the organization** workflow" — the roles-bundle-workflows shape of 540-542,
and one more operation our missing workflow catalogue cannot hold (the 
workflow-catalogue finding). The export itself needs
`audit-export:orchestrate-v3`, grantable with the Organization administrator
role.

Integrity is a stated property of the pipe, not a policy:

> "The infrastructure through which audit logs flow from generation to storage is engineered to be append-only, ensuring audit trail integrity."

— `security/monitor-audit-logs.md`

## 5. What the image adds that the prose does not

`audit3-export-control-panel.png` (the export-setup capture): Control Panel's
shell has a left sidebar — Home, All Settings, **Approvals**, Search (ctrl+J) —
then a FAVORITE SETTINGS block and an ORGANIZATION block where **Audit logs**
sits selected with a favoriting star, plus "Suggested favorites based on your
recently visited settings". The top toolbar is a three-scope context switcher
(enrollment / organization / space glyphs, the organization one active) with a
gear. The page header reads "Access your organization's audit logs"
(`security/images/audit3-export-control-panel.png`); below it, a card links
out to documentation, a warning card restates the PII/markings guidance, and a
listing headed Audit log datasets for the organization carries a green
**+ Create export dataset** button over a table whose first column is **Log Type** — the
datasets listing is *plural*, so one organization holds many export datasets.
The Approvals sidebar entry is the Control-Panel-Approvals product the
DELIVERABLE-MAP records separately; this capture confirms it is core Control
Panel chrome, not a buried setting.

## 6. What this is not

The Project Activity log (641): a Project-scoped collaboration view with a
one-month retention and a twelve-token emit-only vocabulary. The audit log is
org-scoped, analyst-facing, schema-guaranteed, and delivered out of the
platform. Same raw material — the same write paths fire both — but neither
borrows the other's grammar. That separation is already recorded in
DELIVERABLE-MAP and held.

## Decisions

1. **The emitting half is the platform, and we do not fake comprehensiveness.**
   "Every action taken in Foundry" is written by every service; our services
   are SQL entry points, and instrumenting all of them is a cross-cutting
   change no single migration should pretend to make. An audit log that logs
   three things is not an audit log; it is a liability labelled as one. So the
   buildable slice is NOT "log everything" — it is the schema, a small set of
   real emitters, and the delivery mechanism, each honestly scoped.
2. **The audit.3 line is one table with the published 27 fields**, jsonb for
   `requestFields`/`resultFields`/`entities`/`users`, written only by an
   emitter function. `logEntryId` unique per line, `eventId` groups lines,
   `time` from `clock_timestamp()`. Append-only is enforced (no UPDATE/DELETE
   grants; the retention deleter is the one exception, on 553's runner shape).
3. **The categories CHECK admits only categories a writer here produces** —
   the event-log vocabulary rule (639): a category token nothing emits is a
   false past. This deliberately does NOT take the full ~80-category
   enumeration, and that divergence is scoped and stated: the page's set is
   the ceiling and the spelling authority; our CHECK grows one category per
   producer, in the migration that adds the producer. Tombstone categories
   (`audit.2` compatibility rows) are never admitted.
4. **First producers are the management paths we already trigger**: group
   membership (`managementGroups`), role/permission grants
   (`managementPermissions`), marking changes (`managementMarkings`) — each
   with the category's own published request/result fields (`groupPatches`,
   `resourcesWithPermissionsChanges`, `markingPatches`). These are triggers
   beside 641's activity triggers, not replacements — same paths, different
   product, per §6.
5. **Delivery is the per-organization export dataset, not the file API.** We
   have no log-file archive; the table is the store and a dataset export is
   expressible with machinery we already have (datasets, org markings by
   default, a start-date filter, a per-dataset retention bound of at most 730
   days). The `list-log-files`/`get-log-file-content` endpoints presume the
   file archive and are recorded as not-built with the reason. The Control
   Panel *surface* is out of scope until a Control Panel page exists to hold
   it; the export machinery must not wait for its chrome.
6. **audit.2 is not built, at all.** Historical-migration material for a
   history we do not have.
7. **The two operations are recorded against the workflow catalogue gap.**
   `audit-export:view` and `audit-export:orchestrate-v3` join the operations
   a role must bundle; we do not invent a grants table for them ahead of the
   catalogue phase.

## Questions

1. **Which slice first, if any?** The schema+emitters slice (Decisions 2-4)
   and the export slice (Decision 5) are separable; the export is worthless
   until emitters exist, so the order is forced — but whether to start at all
   is the operator's call. `blocks: everything below.`
2. **Should `userLogin`/`userLogout` be first-class producers by reading the
   substrate's `auth.audit_log_entries`?** The events exist without any new
   instrumentation, but the mapping crosses a schema boundary we do not own
   and its shape is Supabase's, not ours. `blocks: nothing` — Decision 4's
   three producers do not depend on it.
3. **Where does the per-dataset retention knob live?** Foundry's is
   dataset-specific configuration set at export creation, max 730 days; our
   retention timers so far (641, 642) are fixed constants in their deleter.
   A configured bound wants a column on the export registration, which only
   exists once the export slice is designed. `blocks: the export slice only.`
