---
verify: strict
---

# Action permissions: we ship the discouraged writeback setting, and cannot choose the other

**Why this reading exists.** Item 2 of the ontology priority list. The course's
action-type wizard has a step nothing here has: *"Give yourself permission to
execute this action"*, and `action-types/permissions` is the page behind it.
Reading it turned up something larger than a wizard step.

**Pages read in full:** `action-types/permissions`, `action-types/dropdown-security`.

**Images parsed (3 of 3 on those two pages):** `recommended-writeback-setting.png`,
`objectDropdownSecurityFilter.png`, `objectDropdownSecurityProperty.png`.

**Consulted, quoted, images NOT parsed:** `action-types/read-write-authorizations`
— read whole for §5; its four images
(`read-write-authorizations-write-security.png`,
`read-write-authorizations-read-security.png`,
`read-write-authorizations-minimum-security.png`,
`read-write-authorizations-submission-error.png`) I did not open, because §5
concludes nothing is built from it. Recorded so the debt is not silent.

**Also grepped, and each names the same control:** `foundry-rules/marketplace`,
`object-permissioning/configuring-rv-access-controls`,
`object-backend/osv1-osv2-migration`.

---

## 1. Three questions, and we answer two of them

> Permissions apply to action types in the following ways:
> * Who can view a given action type?
> * Who can edit a given action type?
> * Who can apply an action type with a given set of parameters?

— `action-types/permissions.md`

View and edit are `can_read_action_type` and `can_write_action_type`. Apply is
the third, and the page spells out what it depends on:

> In all cases, the user submitting the action must be able to view the edited object types and link types and their datasources, and pass the submission criteria.

— `action-types/permissions.md`

The criteria half shipped in 602–604. The rest of the sentence is the subject of
this reading.

## 2. The writeback setting, which we do not have and are on the wrong side of

> Object edits can either be locked down so that edits are only allowed via actions, or reopened so that edits are allowed via actions, Foundry Forms, direct Object Explorer edits, and API calls. To enforce a consistent security paradigm across many workflows, by default, new object types only allow edits via actions. Other forms of edits are not recommended for new usage.

— `action-types/permissions.md`

Three more pages name the control by its label, in the tab the course names:

> Toggle on `Only allow edits via actions` to unblock the migration of that object type.

— `object-backend/osv1-osv2-migration.md`

> be sure to enable `Only allow edits via actions` for the `Rule` and `Proposal` object types in the `Datasources` tab of the Ontology Manager application. Without this step, users will encounter an `Actions:PermissionDenied` error when attempting to create a proposal.

— `foundry-rules/marketplace.md`

**Ours has one toggle where Foundry has two.** `object_types.edits_enabled` is
the course's *Allow edits*; there is no column for *Only allow edits via
actions*, and `object_edits`' INSERT policy is:

```
EXISTS (SELECT 1 FROM object_types t
         WHERE t.id = object_edits.object_type_id
           AND auth_member_of_ontology(t.ontology_id) AND t.edits_enabled)
```

— any ontology member may write an edit directly, with no action involved. That
is the *reopened* mode, permanently, for every object type. The page calls it
discouraged and says it is not the default:

> Therefore, setting an object type to be edited by actions, Foundry Forms, direct Object Explorer edits, and API calls is discouraged since granting `Edit` permissions simply for object editing may expose more data to a user than is required to complete the Ontology editing workflow.

— `action-types/permissions.md`

**And the direct path is the deprecated storage backend's**, which is worth
knowing given `readings/` already tracks an OSv2 migration:

> Object Storage v1 (Phonograph) supports editing object and link types directly through Object Storage v1 (Phonograph) edit APIs. This interaction is deprecated and not compatible with OSv2.

— `object-backend/osv1-osv2-migration.md`

and it is the mode the granular-policy page carves out by name:

> Granular Policies for edits can only be configured for object types using Object Storage v1 which do not have the **Only allow edits via actions** option selected. For all other object types, edit permissions are controlled via action types editing the object types.

— `object-permissioning/configuring-rv-access-controls.md`

So the mode we are stuck in is the discouraged one, the one that blocks the
migration we have already started, and the only one where a granular edit policy
is even configurable — everywhere else "edit permissions are controlled via
action types", which is what Decision 2 below encodes.

**The consequence the page draws is the interesting half**, and it is not a
tightening:

> For object types that only allow edits via actions, the user submitting the action will only need `Read` access on the objects that are being edited. This means that it is possible for users to create objects that they cannot view.

— `action-types/permissions.md`

Locking down *lowers* what an applier needs. That is the point: the action is
the permission, so the writeback dataset's `Edit` grant — which "will be able to
view all data in a writeback dataset" — stops being required.

**One boundary, stated so it is not assumed away:**

> Updating edit permissions on an object type to "Only allow edits via actions" will not remove historical, non-action edits, but they will prevent further edits from Foundry Forms, direct Object Explorer edits, and API calls.

— `action-types/permissions.md`

Retroactive: no. Forward: yes.

**And a warning against reading permission off the action type screen:**

> With either writeback setting, an action type's configuration does not display permission settings on affected underlying object types; the person configuring the action type must ensure that these permissions are correct.

— `action-types/permissions.md`

## 3. What the image shows, which is not what its caption says

The page captions `recommended-writeback-setting.png` *"Only allow edits via
actions is recommended."* **The image contains no such toggle.** It is a
`Permission breakdown` panel: a lock icon and a collapse chevron in its header,
two tabs — `Object type` (selected, blue underline) and `Object instances` — and
below them two columns.

- **left**: an eye glyph, `View object type`, subtitle *View the object type
  schema and metadata*, then *Users must meet **all** of the following
  requirements to view the definition of this resource.*
- **right**: a pencil glyph, `Edit object type`, subtitle *Edit the object type
  schema definition and metadata*, and the same sentence with *edit*.

Each column is an **AND chain of three blocks**, joined by a vertical connector
labelled `AND`:

1. a two-row resource stack — a redacted project row, then a redacted
   `[…] Test Object` row with a blue cube tile — footed by
   `Viewer permissions ⓘ` / `Editor permissions ⓘ`;
2. `Organizations · Any of ⓘ` listing `Titan`, `Palantir`, `Palantir 2`;
3. `Markings ⓘ`, here `None`.

**This is our access model, drawn.** `readings/` and migrations 557–560 settled
it as *(org AND markings) AND (≥1 role)*; the panel is that expression with the
role half resolved through the resource hierarchy, and it confirms two details
we inferred: Organizations are **Any of** (disjunctive) while Markings are a
separate conjunct, and the role requirement is expressed per **resource
ancestor**, not as a flat grant.

**The caption/image mismatch is recorded as a fact about the corpus**, not
resolved: CLAUDE.md's rule 8 says a screenshot does not say which product it is
of, and this is the adjacent failure — a screenshot does not say which *sentence*
it illustrates. **Nothing in this reading is inferred from the caption.**

## 4. Dropdown security, and a rule our new editor breaks

`dropdown-security` is about static value filters on an object dropdown leaking
property values. We have no object-reference parameter and no dropdown filter,
so the body of the page is not actionable here. Its **Technical details**
section is:

> In most cases, the actions backend redacts sensitive information in the action type definition to avoid exposing sensitive property values. For example, action submission criteria are hidden from users who cannot edit action types.

— `action-types/dropdown-security.md`

**Ours are not hidden.** The policy is

```
read criteria | SELECT | can_read_action_type(action_type_id)
```

and `can_read_action_type` is `auth_in_ontology(a.ontology_id)` — every member
of the ontology, not every editor. Until yesterday nothing read the table, so
the divergence was latent; #738's editor is the first thing that renders it.

**The obvious fix is a trap, and this is the important part of this reading.**
`submission_criteria_verdict` and `eval_criterion` are both INVOKER. Narrowing
the SELECT policy to `can_write_action_type` would mean a user who can apply an
action but not edit it reads **zero criterion rows**, the verdict comes back
NULL, and the gate **passes silently** — removing the constraint from exactly
the people it exists to constrain. Any narrowing has to make the evaluator
SECURITY DEFINER in the same migration, and prove the gate still fires as
`authenticated`.

The two images are the page's example and its two safe alternatives. Both are an
object-set builder: `Starting object set` with a teal document tile on
`Document`, then `Investigation Name is`, then the value row, then dashed
`+ Filter on property` and `Search around` rows. The unsafe one holds a grey
literal chip `Area 51 Investigation ✕`; the safe one holds two chips instead — a
quote-glyph `Investigation Name` (the parameter) and a document-tile
`Investigation Object - Investigation Name` (another object's property) — with
`Reset filters` beneath. **The chip's glyph is the discriminator**: quote mark
for a parameter, object tile for an object property, no glyph for a literal.
That is a rendering rule we can reuse the day we have a filter, and the prose
does not state it.

## 5. Read and write authorizations: beta, and not built

The page is explicit about its own status — *"Read and write authorizations are
in the beta phase of development and may not be available on your enrollment"* —
and about what it is not:

> These authorizations supplement the user's existing permissions and the action type's submission criteria. They do not grant access or replace existing permissions or submission criteria.

— `action-types/read-write-authorizations.md`

It needs marking categories with hierarchies, conjunctive and disjunctive
classification rules, and a declassification permission check at save time. We
have markings, and none of the rest. **Not built**, and its four images not
parsed, as the header says.

## 6. Side effects, which we also do not have

> Any user who can set up an action may configure side effects.

— `action-types/permissions.md`

and the ordering, which matters if we ever build them:

> Submission criteria must pass as normal; if the action submission criteria fail, then side effects will not be triggered.

— `action-types/permissions.md`

`action_rule_kinds()` already marks the side-effect kinds not executable, so
this confirms the position rather than changing it.

## Decisions

1. **Add `object_types.only_edits_via_actions`, DEFAULT true.** The page says
   "by default, new object types only allow edits via actions", and four pages
   name the control by that label. It sits beside `edits_enabled` in the Edits
   section of the Datasources tab, which is where every page that names it says
   it is.
2. **The INSERT policy on `object_edits` enforces it.** With the flag on, a
   direct insert is refused; the action path still writes. The discriminator is
   a transaction-local setting `apply_action` sets, because a PostgREST caller
   cannot set one — `apply_action` stays INVOKER, so the edit still lands
   through `object_edits`' own policy, which was the point of it being invoker.
3. **The refusal is `Actions:PermissionDenied`**, which is the name
   `foundry-rules/marketplace` prints for exactly this misconfiguration. Not a
   new namespace token.
4. **Not retroactive.** Existing rows are untouched: "will not remove
   historical, non-action edits".
5. **Default true means existing types change behaviour**, so the migration
   backfills `false` for object types that already have non-action edits, and
   `true` for the rest. A default that silently breaks a working type is not
   what the page describes — it describes the default for *new* types.
6. **Criteria visibility is a SEPARATE change and is not made here.** It needs
   the evaluator to become SECURITY DEFINER first, and a test as
   `authenticated` proving the gate still refuses. Doing half of it removes a
   gate.
7. **Read and write authorizations are not built.** Beta, and they need a
   marking hierarchy we do not have.
8. **Nothing is built from the caption of `recommended-writeback-setting.png`.**
   The image shows a Permission breakdown panel; what it confirms is the access
   model, and that is recorded in §3 rather than acted on.

## 7. What was built

**605** adds `object_types.only_edits_via_actions`, DEFAULT true, and enforces
it. The rule went on the **trigger** rung — it needs another table and a
namespaced error, and a trigger binds the owner where RLS does not, which
matters because the path being closed is the direct one. The arm joined
`guard_object_edit` rather than adding a second trigger. The refusal is
`Actions:PermissionDenied`, the token `foundry-rules/marketplace` prints.

"Via an action" is a transaction-local setting that `apply_action` and
`apply_function_edits` set — the only two functions in the schema that insert
into `object_edits`, confirmed by matching `prosrc` rather than by grepping the
repo. Both stay INVOKER. A PostgREST caller cannot set it: `set_config` is in
`pg_catalog` and only `public` is exposed.

Backfill: `false` for types that already have a non-action edit. The page's
default is for *new* object types, and switching a working type under its owner
is not what it describes.

**The surface** is the second Switch in the Edits block of the Datasources tab,
shown only when Edits is on — which is where four pages say the control lives.
Its help text is the page's own consequence: with it on an applier needs only
`Read`; with it off the writeback dataset's `Edit` grant "will be able to view
all data" in it.

**606 is the bug 605 shipped, and the platform suite is what caught it.**
`set_config(..., true)` is transaction-local, and 605 set the flag at the top of
both writers and never cleared it — so within one transaction the first applied
action opened the direct path for everything after it. 605's own probe could not
see this: it ran in a fresh subtransaction where nothing had applied an action.
The suite runs many cases in ONE transaction as `authenticated`, and the new
case asserting a direct edit is refused sits after the case that applies an
action. **That ordering is the finding.** 606 clears the flag before each
function's single `RETURN`; an abort restores an `is_local` setting on its own,
so only the normal path needed it.

Reachable outside a test: an edge function or a cron job on one connection that
applies an action and then writes. Not from PostgREST, where each request is its
own transaction — which is precisely why a migration assertion could not find
it.

## Questions

1. ~~Does our Check access panel show the AND chain the image draws?~~
   **They are different panels.** Ours (`features/security/CheckAccessPanel`)
   is `security/checking-permissions`'s *Check access*: pick a user, get a
   clause list with a satisfied dot. The image is a *Permission breakdown*: no
   user, the requirements themselves, as an AND chain. Foundry has both;
   nothing is changed here, and the image is the reference if the second is
   ever built.
2. **What is the `Object instances` tab?** The image shows it beside
   `Object type` and never selected. Per-row permission is a thing we have
   through restricted views; whether Foundry's panel shows the same is not
   answerable from this page.
3. ~~Is there an edit path other than `object_edits` and `apply_action`?~~
   **Two, and both are the action path.** `pg_proc` has exactly
   `apply_action` and `apply_function_edits` inserting into `object_edits`, and
   no web surface writes it at all — `materializations.ts` reads `applied_at`
   and that is the whole of it. Asked of the catalogue, not of a grep.
