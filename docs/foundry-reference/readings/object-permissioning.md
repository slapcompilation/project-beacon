---
verify: strict
---

# Reading — object permissioning, and what dynamic security is

This closes the open question from `ontology-core-concepts.md`. **Dynamic security
is object and property security policies** — row, column and cell-level access
evaluated per object instance at read time.

Pages read in full:
- `mirror/object-permissioning/overview.md`, `_index.md`
- `mirror/object-permissioning/ontology-permissions.md`
- `mirror/object-permissioning/managing-object-security.md`
- `mirror/object-permissioning/object-security-policies.md`
- `mirror/object-permissioning/multi-datasource-objects.md` (skimmed for the MDO
  definition; not read line by line)
- `mirror/object-permissioning/ontology-permissions-legacy.md` (read for the two
  superseded models)

Image read: `images/osp-permissions-ui-overview.png` — the Compose object security
policy dialog. 21 further screenshots mirrored; **I recorded them as walking the
same flow without opening them, and that was wrong** — see the correction below.
All 22 have since been opened (2026-09-19); the two that changed the build are
`images/osp-add-granular-policy.png` and `images/osp-object-security-policy-properties.png`.

Pages added on the 2026-09-19 pass, none of which this reading originally touched:
- `mirror/platform-security-management/manage-granular-policies.md` — where the
  comparison set, the user attributes and the weights are actually enumerated
- `mirror/object-link-types/mandatory-control-properties.md` — the mechanism
  behind the worked example's `VIP` row, linked from step 5 of a page read in full

---

## The two things being permissioned are different

> "Object types are permissioned differently from objects. To see an object type,
> you must have View permissions on the object type, but do not need View
> permissions for the backing datasource.
>
> To see objects, you must hold View permissions on the object type **and access
> to the data**."

Schema and data are separate grants. Seeing that `Building` exists, with its
properties and contacts, is not seeing `Empire State Building`.

## Permissions live in Compass, not in the Ontology

> "The permissions to view, edit, and manage ontology resources are managed
> through **Compass**, the Palantir platform's filesystem. Ontology resources are
> saved into a project, and the selected project determines who can view, edit,
> and manage them."

So an object type is **a file in a project**, and your project role is your
permission on it. This replaces two legacy models, both named on the page:

| legacy model | how it worked |
|---|---|
| **Ontology roles** | ontology-specific `viewer`/`editor`/`owner`, "not a resource of a project" |
| **Datasource-derived** | "you have `editor` on the object type if and only if you are editor on the backing datasource" |

Stated benefits of the project model: one permission system for all resource
types, bulk management at project or folder level, a **Security tab** that
explains what is required, and the ability to hide resources by marking or by
withholding a role grant.

## Dynamic security — the answer

> "Object security policies allow you to configure view permissions on an object
> instance by configuring security policies on the object type, **independently of
> the permissions on the backing data source**. These are used to achieve
> *row-level security*."
>
> "The visibility of specific properties can be guarded using additional *property
> security policies*… used to achieve *column-level security*."
>
> "The combination of object and property security policies is used to achieve
> *cell-level security*."

The failure modes are specified, and they differ:

> "If a user does not pass the object security policy, the object instance will
> **not be viewable**… If they pass the object security policy but do not pass the
> property security policy, they will see a ***null* value** in place of the
> property value."

Access to an instance is the conjunction of three things:

1. `Viewer` access to the **object type**
2. passing a **granular policy**, if configured
3. passing any **marking**, **organization**, or **classification** check

And the decoupling, stated outright: "When an object or property security policy
is configured, users do not need `Viewer` permissions to the object type's backing
data sources to view object instances."

### What the image adds

`osp-permissions-ui-overview.png` — the **Compose object security policy** dialog
is a before/after with an arrow between two columns:

- **Left, Datasource access requirements** — `Viewer permissions` on a dataset
  (icon: a table) named `passenger`, **AND** `Organizations`, **AND** `Markings`
  (`demo: PII`, `demo: VIP`).
- **Right, Policy access requirements** — `Viewer permissions` on the **object
  type** (icon: a cube) named `Passenger`, **AND** `Granular policy` (None), **AND**
  `Organizations`, **AND** `Markings`.

Two things the prose does not make this vivid:

1. **The policy is a replacement, not an addition.** The left column is what the
   datasource demands; the right is what the policy demands instead. The icon
   changes from table to cube — the requirement moves from the data to the type.
2. **It is a fixed conjunction of four slots**, each independently managed:
   viewer permission, granular policy, organizations, markings. ~~Not free-form
   rules.~~ — **that last sentence is false; see the correction below.** The four
   slots are right, and the `Granular policy` slot opens a rule composer. Two
   details this section also got wrong by reading only the one capture: the LEFT
   (datasource) column has **three** slots, not four — `Granular policy` exists
   only on the right — and only the right-hand cards carry a Manage affordance.

### Granular policies and mandatory control properties

A granular policy is row-level logic over the data: the VIP example adds the `VIP`
marking as a **mandatory control property**, and "Every row has a set of markings
in the mandatory control property that need to be satisfied by a user to access
that object instance."

A warning worth carrying: "**Avoid using `NOT` conditions** with group, marking,
or organization memberships… The platform supports scoped tokens, which carry only
a subset of a user's permissions. These tokens may lack the attribute the `NOT`
condition checks against, causing the condition to pass and grant more access than
intended."

### Constraints on property security policies

- an object security policy must exist first
- "The **primary key property cannot be a member** of any property security policy"
- "A non-primary key property can be a member of **at most one** property security
  policy"

### The older mechanisms, and why they are not preferred

**Restricted views** — row-level, dataset-only, e.g. `user.userAttribute('care_center') == care_center`.
**Multi-datasource object types (MDOs)** — one object type mapped to several
datasources so each carries its own markings; Object Storage v2 only.

Policies are preferred because they give "unified cell-level security" in one
feature, are configured on the object type, and update "near-instantaneously"
whereas "With RVs, policy changes require a pipeline rebuild before reads respect
the new policies". They also work with streams and with Global Branching.

RVs still win when "the backing dataset is used outside of the Ontology and
requires granular access control in those contexts" — policies "are scoped to the
Ontology and do not control access to raw datasets in non-Ontology contexts".

### A trap worth keeping

> "a media reference property can refer to a media item stored in a media set. If
> the media set has different permissions from the object type, then it is possible
> for a user to not have access to a media reference property, but still be able to
> fetch the media item directly from the media set."

Property-level security does not travel to the resource a property points at.

---

## Connects to

- **`ontology/_index`** — "kinetic elements (actions, functions, dynamic
  security)". This is that third item, now defined.
- **`compass/`** — projects and roles ARE the ontology permission model, not a
  neighbouring feature. Our `projects` + `project_role_grants` are more central
  than they looked.
- **`security/markings`, `classification-based-access-controls`,
  `platform-security-management/manage-granular-policies`** — the three check
  kinds; all mirrored, none read.
- **`object-link-types/mandatory-control-properties`** — unread, and it is the
  mechanism behind row-level markings.
- **Our RLS policies** — `organization_id = auth_org_id()` is the Organizations
  slot and nothing else. No markings, no classifications, no granular policy, no
  property-level anything.

## Correction (2026-09-19) — proposal 3 was false, and one image caused it

**Proposal 3 below is wrong.** It says not to invent a rule language because the
dialog is four fixed slots ANDed together. The four slots are real, but one of
them is `Granular policy`, and behind its Manage link is a full rule composer. I
concluded otherwise from the single capture I had opened — which is the *outer*
dialog — and recorded 21 others as walking the same flow. They do not.

`images/osp-add-granular-policy.png` prints its own definition:

> A granular policy is a combination of rules that describe what rows can be seen by different people
> — object-permissioning/images/osp-add-granular-policy.png

and carries a Match-All/any dropdown, a draggable rule row, an add-a-condition
affordance (so nesting), and a right-hand Define condition panel with a left
term, an operator dropdown and a right term. The rule it shows reads
`Current user markings satisfies VIP`.

Three further corrections from the same pass:

1. **`Satisfies` is an operator the enumeration does not list.** The eight
   comparison types are on `manage-granular-policies.md`; `Satisfies` is none of
   them. The same page's weight table implies it independently by pricing three
   condition kinds where the comparisons account for two:

   > "A marking condition is given a weight of 3,000."

   — `platform-security-management/manage-granular-policies.md`

   Its right-hand term is a mandatory control property. Note the
   two-vocabularies trap: `mandatory-control-properties.md` says to set the base
   type to Mandatory Control, while `properties-overview.md`'s table — which our
   vocabulary parses — enumerates `Marking`. The enumeration wins.

2. **Object policies are narrower than restricted-view policies on the same
   grammar**, which proposal 3 had no way to see:

   > "Object security policies do not support less/greater than comparison operators."

   — `platform-security-management/manage-granular-policies.md`

3. **The two halves of a policy propagate differently**, which decides what may
   be resolved at index time and what may not:

   > "Granular row and column controls within an object or property security policy filter what a user can read. These controls do not extend to downstream outputs or exports. However, mandatory and classification-based controls within the same policy continue to apply to derived data."

   — `object-permissioning/managing-object-security.md`

**Proposal 2 has come due** — object instances now exist, and the row-level half
shipped as 821. Proposals 1 and 4 stand.

### What this reading could not have caught, and the method that did

The false proposal rested on an image I had not opened while the header said the
unopened ones added nothing. That claim is the falsifiable kind CLAUDE.md warns
about, and it was false. The correction came from opening all 22 and pairing each
reader with an adversary told to attack the *build shape* hardest — which also
turned up two refuters disagreeing with each other about whether the policy is
keyed to the object type or the datasource. Neither settled it; the prose did.

## What this means for the build — proposals

1. **Our permission model is already Foundry-shaped in outline and thin in
   substance.** Object types as files in projects with role grants is exactly what
   we have. What we do not have is the *data* half: every policy we hold is
   type-level, none is instance-level.
2. **The object/property split should be built when object instances exist**, not
   before — there is nothing to secure per-row until an object type has a backing
   datasource. That places it immediately after the datasource work, not before.
3. ~~**Do not invent a rule language.** The dialog shows four fixed slots ANDed
   together. If we build this, it is those four~~ — **FALSE, see the correction
   above.** The fourth slot opens a rule composer, and the grammar to reuse is
   483's. The `NOT`-on-membership half of this proposal stands: it is a
   documented misconfiguration rather than a feature to support.
4. **The primary key constraint is a second sighting.** `create-object-type`
   requires one; here the primary key is the property that *cannot* be hidden.
   Two independent reasons it has to exist before anything else.

## Open questions

- What is a **marking** concretely, and how does it differ from an organization
  and a classification? Three mirrored pages, none read.
- **Object Storage v2** gates MDOs and appears repeatedly. What is it?
- ~~How does a granular policy get evaluated at read time — is it compiled into the
  index, or applied per query?~~ **ANSWERED, and the guess above was backwards.**
  Per query: the policy compiles to a predicate against the caller, which is why
  a change takes effect without a rebuild. The index stays whole. That is also
  how ours works — `object_read_predicate` (821). The two-halves rule in the
  correction above bounds it: only the granular arm is read-time, while the
  mandatory and classification arms follow derived data and so *can* be resolved
  earlier.
- ~~What is a **marking** concretely?~~ Answered by
  `docs/foundry-reference/readings/markings-admin-screen.md` and shipped as 807-811, 819, 820.

---

## Upstream moved (2026-08-18) — download is a separate permission

The drift sweep re-mirrored `object-permissioning/`. No quotation here went
stale, so nothing this reading stands on has changed. One thing was **added**,
and it is a permission dimension we do not have at all:

> "Download permissions are evaluated separately from the view permissions described above."

> "When an object type is secured with an object or property security policy, the location of the object type determines where the platform checks download permissions:"

> "* **Object types saved in a [project](/docs/foundry/object-permissioning/ontology-permissions/):** The platform checks download permissions on the object type."

> "* **Object types using [ontology roles](/docs/foundry/object-permissioning/ontology-permissions-legacy/#ontology-roles) or [datasource-derived permissions](/docs/foundry/object-permissioning/ontology-permissions-legacy/#datasource-derived-permissions):** The platform checks download permissions on the backing data source."

**Two things follow, and the second is the one that matters.**

First, *seeing* a row and *exporting* it are different permissions. Everything
481–486 built answers one question — may this caller read this row — and a
download check would be a second question asked of a different resource.

Second, **which resource is asked depends on where the object type lives.** A
project-saved type is asked about itself; a type on the legacy paths is asked
about its backing datasource. That is the same split `ontology-permissions` draws
for view, arriving one layer down — and it is why this cannot be modelled as a
boolean on the policy. It is a second edge in the resource graph.

**Decision: not built, and not stubbed.** We have no export or download path, so
a `download` verb would be a column nothing reaches — the fourth question in
CLAUDE.md's checklist answered "nothing". Recorded so that when an export
surface is built it starts from two checks rather than discovering the second
one afterwards.

**Question:** does a download check *compose* with the view check, or replace it?
"evaluated separately" says they are two checks and stops. A caller who may view
but not download is obvious; whether the reverse is even representable is not
said. `blocks:` any export surface.
