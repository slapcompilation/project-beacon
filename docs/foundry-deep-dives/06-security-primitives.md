# Deep Dive 6 — Data Governance Best Practices: Security Primitives (capture)

> Captured 2026-07-19 from source PDFs (`source/06-security-primitives/`, 19 lessons). Condensed
> record in our words with short quotes; Beacon mapping at the bottom. Unknowns `OPEN:`.

## 0. Course frame

- Role-play: data governance administrator. Most tasks require the **Data Governance Officer** role.
- The four named practices: **Projects** ("the primary way to organize work … and the primary
  security boundary"; projects + roles = "how **discretionary** access control is managed"), robust
  access controls, **Markings** (standardized classification labels), **Restricted Views**
  (row-level tailoring).
- Three sections: project setup + guardrails → markings/sensitivity classification → restricted
  views. Data: a notional `employee_data.csv` (uploaded as a structured dataset; Marketplace
  fallback).

## 1. Groups (Create a Course-Specific Group)

- Groups organize users for at-scale permissioning; can be **imported from directory services
  (e.g. Active Directory) or created manually** (Account → Settings → Groups → Create group; course
  group `Test_Foundry_Governance_Learning` with teammates added).

## 2. Project templates (Managing Project Templates)

- Templates = "predefined blueprints" for new projects: consistent structure, permissions,
  configuration. The default template = empty project with creator as owner; **custom templates can
  pre-create/apply specific groups, roles, and security markings**.
- Managed by space owners/managers in Control Panel → "Project templates". **Templates support
  variables** to parameterize group names or markings at creation time.

## 3. Roles on projects (Managing Roles on Projects)

- Roles = permission sets, typically assigned at project level, applying to everything inside
  (inheritance down the tree). Default ladder, most→least: **Owner, Editor, Viewer, Discoverer**;
  each role can grant its own level or lower. Defaults are customizable and **new roles can be
  created**.
- **Precedence rule (the load-bearing sentence): "mandatory controls like Organizations and Markings
  always take precedence, preventing access for ineligible users regardless of their assigned
  role."** Discretionary (roles) never overrides mandatory (org membership, markings).
- Post-creation editing: project view → **Lock icon** → Access → Manage under Roles → add group →
  grant Editor. (Users can see a project exists without full content access; access-request flow
  deferred to docs.)

## 4. Markings (Creating and Applying Markings)

- A Marking = a label ("PII", "Confidential", "Case-12345") that **enforces** access: "Users must be
  granted the corresponding Marking to access content protected by it" — and need the marking **and**
  normal permissions.
- Three stated properties: markings "**travel with the data, not just with the file location**";
  apply/remove has "immediate and broad effects due to inheritance"; both marking and permissions
  required.
- Two application methods:
  1. **Direct application** to a file/folder/project — flagged as "a sensitive action as it affects
     all downstream resources."
  2. **Inheritance**, two kinds: **hierarchical** (folder/project → all contents; inherited markings
     shown with a special icon) and **data-dependency** — *a dataset derived from a marked dataset
     inherits the marking, even if stored elsewhere*; removing a marking from the source "can
     potentially remove it from all downstream dependencies, unless explicitly overridden."
- Authoring (admin-gated, Settings → Markings): **marking category** ("Data Governance Training
  Marking"; visibility Visible by default — names/descriptions usually not sensitive; **categories
  cannot be deleted once created**) → **marking** inside it → **Marking permissions → Manage** →
  grant the course group **Manage** rights.

## 5. Restricted Views (row-level policies)

- Motivation: roles + markings gate whole resources; some cases need *per-row* control — "a company
  limits its sales representatives to viewing customers only at their assigned branch."
- **Hard rule stated twice: backing dataset and restricted-view dataset must live in two different
  projects** — so view-access never implies backing-access, each project's controls are managed
  independently, least privilege holds.
- Creation: right-click dataset → Actions → **Create restricted view** → save into the separate
  "…Restricted Views" project → the **policy builder** opens automatically. Course policy: two
  conditions — Column `State` **is equal to** static value `"MA"` AND **Current user's group ids
  matches any** `Test_Foundry_Governance_Learning`.
- **Validation via the testing panel**: "Open testing panel" → evaluate the policy **as another
  user** — a non-member gets an error; a member sees the rows. "This simple test confirms that the
  access restrictions are working properly."
- Conclusion pointers (paths not taken): investigating marking propagation through file hierarchies;
  **Restricted View–backed object types** for Workshop; additional marking policies; restricted
  views inside Marketplace products.

## OPEN items

- OPEN: **Restricted View–backed object types** (row-level security surfacing through the ontology
  into Workshop) — named in the conclusion, not demonstrated. This is the piece that would map
  1:1 onto our RLS-behind-object-views model.
- OPEN: marking *policies* beyond membership (the "additional policies for Markings" pointer).
- OPEN: markings/restricted views in Marketplace products; access-request flow.
- Note: obfuscation + purpose justification are explicitly deferred to Deep Dive 9 (Data Protection).

---

## Beacon mapping (analysis — separate from the record)

**Their three-layer model vs our one-layer model.** Foundry: discretionary (projects+roles) +
mandatory (organizations+markings) + row-level (restricted views), with mandatory always winning.
Beacon: **Postgres RLS is all three at once** — org/hotel scoping is mandatory, the role ladder is
discretionary, and row-level policies are the native primitive rather than a bolted-on view layer.
Their hard rule ("backing dataset and restricted view in separate projects so view-access never
implies backing-access") is a workaround for not having RLS at the storage layer; we don't need the
workaround. **Verdict: we hold the stronger primitive; no architectural gap.** Their
precedence sentence (mandatory over discretionary, always) is exactly our stance that RLS is the
floor no UI role can dig under — good phrasing to keep.

**The one idea genuinely worth stealing — policy testing as a first-class surface.** Their
"Open testing panel → evaluate policy as another user" is our `supabase/tests` contract suite
(anon/authenticated/cross-org/cross-hotel contexts) as an *interactive tool*. We already CI the
equivalent (db-contracts.yml) — stronger, because it's continuous — but a "**view as role/user**"
affordance for admins debugging access is a classic operator need and would make our RLS posture
demonstrable to non-engineers. Demand-gated note for Studio.

**Data-dependency marking inheritance is the concept to remember for doc-ingestion.** A label that
travels through *derived* data (marked dataset → derived dataset keeps the mark) is taint
propagation — and our document pipeline is exactly a derivation chain (document → chunks →
embeddings → entity suggestions → edges). Hospitality documents will contain PII (guest lists,
staff records, contract signatories). When Track 2/3 executes, the P8 proof should answer: *does a
sensitive source document taint its chunks and suggestions?* Today nothing carries that flag. A
lightweight `sensitivity` property on Document that propagates through the ingest chain is the
marking-analog — parked as a design consideration for the P6 node work, not added to the spec
without the user's call.

**Smaller notes:** project templates with variables = governance scaffolding as config — the analog
is a **hotel-onboarding template** (seed roles, org_policy defaults, zones) which our demo-seeding
runbook already approximates informally. "Discoverer" (can see existence, not content) is a tier our
role ladder lacks and hospitality ops probably never needs. Groups-from-AD foreshadows enterprise
SSO expectations for chain-scale customers.
