# Ontology parity — what Foundry does end to end, and what we have

**A measurement, not a plan.** Dated 2026-09-21. `DELIVERABLE-MAP.md` is the only
planning document and deletes an entry the day it ships; this file is a census and
is therefore a snapshot that goes stale. Re-run it rather than editing it.

## The numbers

| | count | share |
|---|---|---|
| **Have** — built and reached | 173 | 40% |
| **Partial** — reduced, or built and unreached | 140 | 32% |
| **Missing** — no representation | 120 | 28% |
| **Total capabilities surveyed** | 433 | |

Measured against a catalog snapshot of 240 public tables, 847 functions and 526
CHECK constraints, plus 216 files under `apps/web/src`.

**`Partial` is the load-bearing column.** It holds two different problems: a
mechanism built in reduced form, and a mechanism built in full that nothing calls.
The second is this repository's recorded dominant defect, so an engine no surface
reaches is counted here rather than as `have`.

## How this was measured, and what that is worth

Fourteen parallel surveys, one per lifecycle stage, each enumerating what the
mirror publishes and then measuring it against the catalogs. Every `missing` and
`partial` claim was then handed to a second agent whose only instruction was to
**falsify** it — because a false gap is the expensive error here: it invites
rebuilding something that already exists under a different name.

That adversarial pass overturned **37** claims, listed at the end. Two further
claims were checked by hand: object-set algebra is genuinely absent (`set_kind` is
`exploration | list`, not union/intersect/subtract), and per-resource history is
genuinely absent while ontology-level history exists (`OntologyHistoryPage.tsx`).

**Obsolete generations are excluded by instruction** and are not counted as gaps:
Object Storage v1 / Phonograph, the legacy `Ontology roles` and `datasource-derived`
permission models, and anything a page marks deprecated or superseded. See
`CLAUDE.md`, *Build the latest generation only*.

---

## Ontology container, spaces, organizations, namespaces

*Where an ontology lives, who may reach it.* **15 have · 4 partial · 7 missing**

Foundry's ontology container layer is mostly present and mostly reached. The spine — an ontology 1:1 with a space, born with it, gated by the space's organization list, with project-based permissions on every resource — is built and something calls each piece (`create_space()` 721, `auth_in_ontology` 441, `guard_resource_placement` 454, `OmaProjectPicker`, the object type Security tab). Organizations are markings with guests, and both organization- and space-level roles bundle workflows and are granted from real screens.

Three clusters are thin. (1) **The space as a filesystem location is half-wired**: `spaces.path` and `resource_location()` exist, but nothing sets `projects.space_id` from the UI (ProjectsPage's own header says `The space picker is still absent`), `resource_location()` is called by nothing outside `generated.ts`, and `spaces` has no `rid` column although `Space.rid` is required on the wire. Everything the create-space wizard's steps 3-5 configure — deletion policy, filesystem, usage account, resource queue, role set, maven identifier, project inherited roles — has zero catalog representation, which SpacesPage documents as deliberate.

(2) **Ontology resources carry a project but never become files in it.** 454 put `project_id` on all five placeable kinds and enforces it, but 812's `index_in_filesystem` trigger is attached to fourteen non-ontology tables only, so `project_resources` — the listing `FilesCard` reads — never contains an object type. The companion rule `resources must be saved in a project within the same space as the ontology` is quoted in a reading and enforced nowhere; `OmaProjectPicker` offers every project.

(3) **Every migration/transition mechanism is absent**: the migrate-to-project-based-permissions assistant, bulk and individual resource migration, and migrating resources between ontologies. Foundry's *Default Ontology* as a distinct ontology kind has no representation either — our `default_ontology()` is an unrelated convenience (the caller's only ontology, 413) and the name collision is worth knowing about before someone builds against it.

Two smaller divergences: the organization `Expand access` permission is not in our `marking_permissions` vocabulary (manage/apply/remove), and `Organizations can only be applied at the Project level` is enforced only in the object/property policy marking slots (829/830), not in `resource_markings` generally.

**Have**

- Ontology as the container holding Ontology resources (object types, link types, action types, interfaces, shared properties, object type groups) — `ontologies` table (cat_tables.txt:138) and an `ontology_id` column on all six published kinds: object_types, link_types, action_types, ontology_inte…
- An ontology is mapped 1:1 with a space (a space holds a single ontology) — `ontologies.space_id NOT NULL UNIQUE REFERENCES spaces(id)` in supabase/migrations/412_a_space_holds_one_ontology.sql. apps/web/src/features/ontologi…
- Creating a space simultaneously creates its ontology with the same name and the same organizations — `create_space(p_name, p_description)` (cat_functions.txt:194), rewritten in supabase/migrations/721_a_space_is_born_with_its_ontology.sql to insert s…
- Private vs shared ontology — one or several organizations applied, and only their members/guests can be granted access — `space_organizations` (cat_tables.txt:197) is many-to-many; `auth_in_ontology(uuid)` / `auth_member_of_ontology(uuid)` (cat_functions.txt:56,59, migr…
- Organizations are a special category of Markings; every user has one primary organization and may be a guest of many — `organizations.marking_id` plus `mint_organization_marking(uuid,text)` and the `provision_organization_marking()` trigger (cat_functions.txt:538,624…
- Organization roles bundling workflows, granted to users and groups — `organization_roles`, `organization_role_workflows`, `organization_role_grants` (cat_tables.txt:150-152) with `org_workflows(uuid)` and `has_org_work…
- Space roles bundling workflows, with the roles available to a space and their grants — `space_roles`, `space_role_workflows`, `space_role_grants` (cat_tables.txt:198-200), `has_space_workflow(uuid,text)` / `space_workflows(uuid)` (cat_f…
- The space is the first element of every resource path, and the path is immutable — `spaces.path` + `set_space_path()` trigger raising `Compass:SpacePathIsImmutable` (cat_functions.txt:733; supabase/migrations/397_a_path_starts_at_th…
- Ontology identity on the wire: RID, API name, display name, description — `ontologies.rid` GENERATED ALWAYS AS `rid_of('ontology','ontology',id)` → `ri.ontology.main.ontology.<uuid>` (migration 412), `ontologies_api_name_ch…
- Project-based ontology permissions: a resource is saved into a project and the project decides who views, edits and manages it — supabase/migrations/454_ontology_resources_live_in_projects.sql adds project_id to object_types, link_types, shared_properties, ontology_interfaces a…
- `Require new ontology resources be saved in a project` toggle in Ontology configuration, flippable by an ontology owner — `ontologies.require_resources_in_project` (cat_tables.txt:138) with `guard_ontology_configuration()` (cat_functions.txt:364) raising `Ontology:OwnerO…
- Export, edit and import the ontology working state as JSON from the Advanced page — `export_working_state(p_ontology, p_branch)` (cat_functions.txt:267) and its import counterpart, reached by apps/web/src/pages/ontology/AdvancedPage…
- Ontology switcher in the top-left of Ontology Manager, showing the ontology over the folder it lives in — apps/web/src/features/ontologies/OntologyPicker.tsx renders a two-line switcher (label over `spacePath`) with a folder icon and double-caret, backed…
- Value types are associated with a space, not an ontology, and usable only within it — `value_types: id, space_id, api_name, display_name, ...` (cat_tables.txt:212) — scoped to space_id, not ontology_id like every other resource. Reache…
- Portfolios as a Compass curation primitive living inside a space — `portfolios` (space_id), `portfolio_curators`, `projects.portfolio_id` (cat_tables.txt:158,159,163) with `can_curate_portfolio`, `can_manage_portfoli…

**Partial**

- **Create a custom role from selected workflows (+ New role), and the rule that custom roles are frozen** — Roles are readable and grantable but not authorable; the frozen flag is enforced yet unreachable.
- **Creating a new organization (Control Panel / Create Organization)** — Organizations can only come from a migration or seed; the cross-organization collaboration workflow cannot be started from the app.
- **An ontology's resources must be saved in a project within the same space as the ontology, under Compass naming conventions (no `/`, unique names)** — A resource can be placed in a project belonging to a different space, and two resources in one project can share a name.
- **Organization access-requirement semantics: applied only at the Project level, governed by Apply organization and Expand access permissions** — Two divergences: the project-level rule is enforced only in the policy slots, and `Expand access` is not in the permission vocabulary.

**Missing**

- **Choosing the space (location) when creating a project** — Every UI-created project has a NULL space, so its location falls back to /<project>. *(compass/create-a-project.md)*
- **Space settings: deletion policy, filesystem, usage account, resource queue, role set, maven identifier, project inherited roles** — Deliberately unbuilt and documented; each belongs to a system (role sets, usage accounts, resource queues) this platform does not have. *(platform-security-management/manage-orgs-and-spaces.md)*
- **Space RID** — organizations, ontologies and projects all carry rid; the space is the gap in the chain. *(api/filesystem-v2-resources-spaces-list-spaces.md)*
- **Ontology resources appear as files inside the project (the Compass listing shows them)** — Object types hold a project_id but never enter `project_resources`, so FilesCard.tsx can never list one. *(ontologies/ontology-permissions.md)*
- **Migrate existing ontology resources to project-based permissions (assistant, bulk, and individual)** — Not urgent while require_resources_in_project defaults true, but Proceed to migration has no counterpart. *(ontology-manager/migrate-to-project-based-permissions.md)*
- **Migrate ontology resources between ontologies (Migrate resources from the ontology switcher)** — Selecting a different ontology works; moving a resource into one does not exist. *(ontologies/ontology-migration.md)*
- **Default Ontology as a distinct kind of ontology (non-default vs default, with its own restrictions)** — The name collision is a trap: Foundry's Default Ontology is a kind, ours is a lookup. *(ontologies/ontology-migration.md)*

---

## Object types and properties

*The entity and its columns.* **19 have · 14 partial · 6 missing**

Measured the `object-link-types/` mirror (46 pages) against the 240-table / 847-function catalog snapshot and the 216 files under apps/web/src. The engine side of this slice is strong: `object_types` (28 cols) and `object_type_properties` (46 cols) carry nearly every published field, 48 CHECK constraints enforce the published vocabularies, and `property_base_types()` holds all 22 base types from `properties-overview.md`'s table. The gaps are concentrated in three places. (1) **The creation wizard is compressed** — Foundry publishes seven steps; ours is one card with no Groups step, no Generate actions step and no save-location picker, and there is no `generate_*_actions` function at all. (2) **Property↔column mapping is a free-text box** — `backing_column` is typed by hand, so `Add as a new property`, `Add all unmapped columns`, the datasource column pane and struct automapping have no representation, even though `dataset_current_fields()` and `datasource_mapping_problems()` exist server-side to feed a picker. (3) **Three engines are unreached**: `ontology_type_classes` (table + catalogue + guard, zero references in apps/web/src), `object_type_properties.analyzer` (11-member CHECK, read into the TS type in api.ts and rendered nowhere), and `allow_empty_arrays` (CHECK + index-time enforcement in 670, touched only by packages/platform tests). Render hints cover 3 of the 9 published. Bulk editing — of statuses across object types, and of the five fields `edit-properties.md` lists for multi-selected properties — is absent in both directions. Struct properties are built and reached, but the three struct sub-features (main fields, automapping, shared struct property types) are not. One recorded divergence stands: Foundry's object type **ID** is a lowercase-dashed slug distinct from the API name; ours is the uuid, declared as such in MetadataCard.tsx.

**Have**

- Choosing a backing datasource / `select a location to generate a dataset` — generate_backing_dataset(p_object_type uuid, p_name text, p_folder uuid) in cat_functions.txt line 287; guard_object_type_datasource(); apps/web/src/…
- Aliases, point of contact, contributors on an object type — object_types.aliases / point_of_contact / contributors; apps/web/src/features/objectTypes/MetadataCard.tsx lines 97-120 — TagInput for aliases, HTMLS…
- API names — PascalCase/camelCase rules, 1-100 chars, reserved keywords, fixed once active — CHECKs object_types_api_name_check (^[A-Z][A-Za-z0-9]*$, length 1..100) and object_type_properties_api_name_check (^[a-z][A-Za-z0-9]*$, 1..100) plus…
- Primary key — designation, eligibility by base type, uniqueness, protection — is_primary_key column; primary_key_eligibility(p_base_type) and primary_key_advice(p_base_type) (cat_functions.txt 608-609); CHECKs object_type_prope…
- Title key — designation and eligibility — is_title_key column; title_key_eligible(p_base_type) (cat_functions.txt:791); CHECK object_type_properties_check2 calls it; ObjectTypesPage.tsx:154 f…
- The 22 property base types — property_base_types() (cat_functions.txt:615) returns exactly 22: string, integer, short, date, timestamp, boolean, byte, long, float, double, decima…
- Array properties — element type, no nesting, no null elements — array_element_type column with three CHECKs: array_declares_element (biconditional), array_element_allowed (excludes vector, time_series, media_refer…
- Struct properties — fields, the 12 field types, depth of one — property_struct_fields (id, property_id, api_name, display_name, description, field_type, backing_column, position); struct_field_types() returns the…
- Media reference properties and their media source — base type 'media_reference' in property_base_types(); object_type_media_sources (datasource_id, property_id); useMediaBindings / useSetMediaBinding i…
- Vector properties — dimension, distance function, embedding configuration — vector_dimension, vector_distance_function, vector_embedding_kind/model, vector_deployment_rid + input/output params; CHECKs vector_declares_its_dime…
- Property visibility — prominent / normal / hidden — CHECK object_type_properties_visibility_check and object_types_visibility_check, both ARRAY['prominent','normal','hidden']; HTMLSelects at ObjectType…
- Statuses — the five values, promoted, deprecation metadata, consistency cascades — CHECK object_types_status_check = promoted/active/experimental/deprecated/example and object_type_properties_status_check = the four without promoted…
- Value formatting — numeric, date/time, Foundry ID, Resource RID, Artifact GID — object_type_properties.value_formatting jsonb with CHECK object_type_properties_check calling value_formatting_valid(base_type, j); number_format_opt…
- Conditional formatting — rules, ordering, copy to other properties — object_type_properties.format_rules jsonb with CHECK object_type_properties_format_rules_check calling format_rules_valid(); format_rule_valid(), for…
- Value types on a property (use-value-type) — object_type_properties.value_type_id and shared_properties.value_type_id; value_types (space-scoped, api_name, base_type, example_value, failure_mess…
- Edit-only properties (not mapped to a column, permissioned to a backing dataset) — object_type_properties.source with CHECK object_type_properties_source_check = column/user_input/linked_objects and object_type_properties_source_nam…
- Delete an object type / delete a property under status protection — Migration 447 (`an active resource is protected`) and 730 (`an active property is protected`) refuse deletion and API-name change for active/promoted…
- Change a backing datasource on an existing object type — object_type_datasources table; useAddObjectTypeDatasource / useRemoveObjectTypeDatasource at features/objectTypes/TypeConfigTabs.tsx:221-222 inside D…
- Derived properties (Linked objects source) — source='linked_objects' arm with six CHECKs (derived_fields_only_when_derived, derived_is_not_a_primary_key, derived_is_not_required, derived_aggrega…

**Partial**

- **Create object type — guided step-by-step helper (7 steps)** — Datasource, metadata, properties and keys are covered in one pane; the Groups step, the Generate actions step and the Save location step are absent (projectId is read from the omaProjectId store, never chosen).
- **Object type metadata — display name, plural display name, description** — Plural display name is settable only at creation — there is no editor for it on a saved type.
- **Icon and colour as the object type's visual identifier** — Colour is stored and rendered but can never be chosen; the icon set is 10 hardcoded names, not a picker.
- **Object type groups — create, assign, search and filter by group** — No groups menu in the OMA sidebar, and the object types table neither displays nor filters by group. type_groups.description and type_groups.display are read by nothing.
- **Limited-support base types (byte/float/short barred from action types; vector KNN-only, max 2048)** — The vector limits are enforced; the `cannot be used within action types` restriction on byte, float and short is not.
- **Render hints** — 3 of the 9 published. Missing: Disable formatting, Identifier, Keywords, Long text, Low cardinality, Enable leading wildcards, Enable regex queries.
- **Analyzer selection (Properties > Interaction dropdown)** — The column is read into the object and rendered nowhere — no dropdown, no writer. An unreached engine.
- **Type classes on properties (kind + name pairs)** — Table, catalogue and guard exist; no web file creates, lists or removes a property type class. The Capabilities tab writes object_type_capabilities instead, which is the published successor for the non-deprecated subset.
- **Value type constraints — the eight kinds** — 5 of 8 reachable; uniqueness, nested and element are schema-only. summarize() at line 57 also falls through to an uppercased kind name for anything past enum/range/regex.
- **Shared property types — create, metadata, inheritance, usage** — The creation helper's aliases and required fields have no column; value formatting, type classes and render hints — three of the nine published shared-property metadata fields — are not held on the shared definition; the RID is stored but…
- **Required properties, including allow-empty-arrays** — Required itself is built and enforced where the page says (at index, not at save). The allow-empty-arrays sub-toggle is an unreached column — no web reader or writer.
- **Mandatory control properties — markings, organizations, classifications** — 1 of the 3 published mandatory-control types. Organizations (allowed-organizations set on the datasource) and CBAC Classifications (max classification) have no representation.
- **Property↔column mapping — column pane, add-as-new-property, add all unmapped columns** — None of the three published mapping gestures exists: map a column to a new property, map a column to an existing property, or `Add all unmapped columns as new properties`. The column name is typed, so a typo is caught by the linter rather…
- **Property display name and description editing** — Display name is editable; property description is carried through saves but has no editor, so it can only ever be whatever a migration or seed put there. Item 1 of the page's four property-metadata tabs is half-built.

**Missing**

- **Generate a standard set of actions for a new object type** — The wizard's `optionally generate a standard set of actions… and assign a specific user or group that can run them` has no representation. *(object-link-types/create-object-type.md)*
- **Object type ID — the lowercase-dashed slug distinct from the API name** — A recorded divergence, not an oversight: the property side DOES have it — object_type_properties.property_id with CHECK ^[A-Za-z][A-Za-z0-9_-]*$, the published property-type-ID rule. *(object-link-types/create-object-type.md)*
- **Struct main fields [Beta]** — No designation, no ordering, no `Struct main field` tag. *(object-link-types/struct-main-fields.md)*
- **Struct automapping (`Automap all`) and column-mapping tab** — Same root cause as the property mapping gap — there is no datasource column pane to automap from. *(object-link-types/struct-automapping.md)*
- **Struct shared property types** — A shared property cannot be a struct, so field inheritance and re-mapping on promotion have no floor. *(object-link-types/struct-shared-properties.md)*
- **Bulk edit — statuses across object types, and the five fields on multi-selected properties** — Neither published bulk surface exists: base type, type classes, render hints, visibility and value formatting across selected properties; and status across selected object types from the table. *(object-link-types/edit-properties.md)*

---

## Datasources and backing

*What the data comes from.* **15 have · 4 partial · 7 missing**

Measured against the api's datasource union (10 real members in `object-types-get-object-type-full-metadata.md`: dataset, restrictedView, mediaSetView, timeSeries, stream, direct, editsOnly, geotimeSeries, table, plus the `unsupported` catch-all) our `object_type_datasources_one_backing` CHECK encodes exactly four: dataset+branch, restrictedView, mediaSetView, timeSeries. The four we have are genuinely reached — DatasourcesTab.tsx adds three of them and timeSeries.ts the fourth — and the rules around them are unusually faithful: the 70-datasource cap is exact including its two exclusions (586 + 774), the `primary key must exist in every input datasource` sentence is a live linter arm, property multiplicity is refused structurally, and 833's `datasource_readable` gates object visibility. Six backing kinds are absent with no representation at all: stream, direct (and its source-timestamp/liveness/direct-writers surface), editsOnly, geotimeSeries, table/virtual table, and derived-properties-as-a-datasource. The most consequential reductions are not the missing kinds but three reached-but-reduced things: column-wise MDO works for datasets only because 733 scopes a deliberate divergence refusing a restricted view beside any other datasource (Foundry says `any combination of datasets or restricted views`); `conflict_resolution` has a column, a CHECK and a trigger and no surface in the entire repo outside `generated.ts`; and `generate_backing_dataset()` — the wizard's documented `Continue without datasource` branch, atomic across dataset+branch+datasource row — is unreached, with `useResolveBacking` reimplementing two-thirds of it client-side and skipping the folder→project derivation and the `DatasourceNeedsALocation` refusal. Two wizard mechanics are simply absent: the column-first mapping pane (`Add as a new property`, `Add all unmapped columns as new properties`, and the automatic column→property mapping on datasource selection), and `Generate join table` for a new many-to-many link.

**Have**

- Dataset + branch as an object type datasource — `object_type_datasources.dataset_id` + `branch_id`, arm 1 of the `object_type_datasources_one_backing` CHECK; backed by real `datasets`/`dataset_bran…
- Restricted view as an object type datasource — `restricted_views` (id, rid, input_dataset_id, policy, protected) + `object_type_datasources.restricted_view_id`, arm 2 of `one_backing`; `guard_rv_d…
- Time series sync as an object type datasource — `time_series_syncs` (input_dataset_id, series_id_column, timestamp_column, value_column, timestamp_unit, rid), `object_type_datasources.time_series_s…
- Derived-properties datasource (api `unsupported`, unsupportedType `derivedProperties`) — Derived properties exist as property columns — `object_type_properties.derived_aggregation`, `derived_from_property_id`, `derived_limit`, with `sourc…
- Property multiplicity refused (one property comes from exactly one datasource) — `object_type_properties.datasource_id` is a single scalar FK, so two datasources feeding one property is unrepresentable rather than merely discourag…
- Per-datasource primary key column (the `Map primary key` helper) — `object_type_datasources.primary_key_column`, `object_type_datasources_media_has_no_join_key` CHECK (a media set has nothing to join on), and two arm…
- The 70-datasource cap, with media sets and time series syncs excluded — `guard_object_type_datasource()` counts `WHERE object_type_id = … AND media_set_rid IS NULL AND time_series_sync_id IS NULL` and raises `Ontology:Too…
- A datasource backs exactly one object type / one link type — `guard_object_type_datasource()` raises `Phonograph2:DatasetAndBranchAlreadyRegistered` per backing kind (dataset+branch pair, restricted view id, or…
- Generate a backing dataset (`Continue without datasource` / select a location for permissions) — `generate_backing_dataset(uuid,text,uuid)` exists (590) and does dataset + master branch + datasource row in one transaction, deriving project from t…
- Refusal of MapType / StructType columns in a backing datasource — `guard_object_type_datasource()` (live version from 586) raises `Ontology:UnsupportedColumnType` for `f->>'type' = 'MAP'` only. 405 and 410 refused `…
- Backing column still exists in the datasource schema (stale-mapping linter) — Two arms in `ontology_violations` (410): `Backing column `%s` is not in the schema of dataset `%s`` for any `source='column'` property, and `The prim…
- Per-datasource mandatory control constraints (allowed values for a marking property) — `object_type_datasources.allowed_markings` and `allowed_organizations`, plus the `object_policy_marking_stops` / `property_policy_marking_stops` pair…
- Datasource readability gates whether a caller sees objects at all — `datasource_readable(uuid)` (833) and its use in the object read path at 833:147 (`AND public.datasource_readable(d.id)`); 834's Check access panel d…
- Link type backing kinds: object type foreign keys, join table dataset, backing object type — `link_types.backing_kind` with `link_types_backing_check` covering all three arms plus the cardinality guards (`link_types_backing_cardinality`, `lin…
- Struct property mapped to a struct column with per-field mapping — `property_struct_fields` (property_id, api_name, field_type, backing_column, position) matching the api's `StructFieldPropertyMapping` {column, field…

**Partial**

- **Media set view as an object type datasource (media reference properties)** — The pair of RIDs is typed by hand into two InputGroups; the platform holds no media set resource to pick from or create.
- **Column-wise multi-datasource object types (MDOs)** — MDO is dataset-only here; the page's `any combination of datasets or restricted views` is unreachable until the read path can null per-datasource instead of gating whole rows.
- **Per-datasource conflict resolution strategy (apply user edits / apply most recent value)** — An engine nothing reaches — the page places this control `in the Ontology Manager, under the Datasources section` and DatasourcesTab.tsx does not render it.
- **Data type coherence between datasource schema and property base type on sync** — A property mapped to a column of the wrong type indexes silently instead of failing the build; the base-type-change migration failure has no representation either.

**Missing**

- **Stream (Foundry stream) as an object type or link type datasource** — Stream compute profile, exactly-once vs at-least-once consistency, the 250-property / 1MB record limits, and stream-backed many-to-many links all absent with it. *(object-indexing/funnel-streaming-pipelines.md)*
- **Direct datasource (low-latency writes, source timestamp, liveness, direct writers)** — With it go the Object Storage v2 liveness block (Data / Schema / Latest edit), the Direct writers panel and the invalid-writes banner. *(object-indexing/direct-datasources.md)*
- **Edits-only datasource (no external resource; all properties via Actions)** — We have edit-only *properties* on a tabular datasource; we cannot have an object type whose whole datasource is the edit log. *(api/v2/ontologies-v2-resources/object-types-get-object-type-full-metadata.md)*
- **Geotime series integration as a datasource for GTSR properties** — 788's header records this as a deliberate non-build — the integration RID rides inside the value instead of naming a datasource. *(geospatial/integrate-geotemporal-series-with-the-ontology.md)*
- **Foundry table / virtual table as an object type datasource** — 703 already records `virtual tables are a product this platform does not have`; consistent, and still a published backing kind we cannot express. *(data-integration/virtual-tables.md)*
- **Automatic column→property mapping on datasource selection, and `Add all unmapped columns as new properties`** — Only the property→column direction exists (PropertySource.tsx's `Backing column` input); the datasource column pane that drives Foundry's property editor is absent. *(object-link-types/create-object-type.md)*
- **Generate a join table for a new many-to-many link type** — Same shape as generate-backing-dataset for object types, and the page gives the same reason (start before production data exists). *(object-link-types/create-link-type.md)*

---

## Indexing, Object Storage v2, builds and schedules

*How the data becomes objects.* **9 have · 6 partial · 13 missing**

Measured against mirror/object-indexing/, mirror/building-pipelines/ and mirror/data-integration/ using the pre-dumped catalogs. The build/schedule layer is the strongest part of this slice: builds, jobs, JobSpecs, the seven job states, the four build statuses, cycle detection, build locking, staleness/force, dependent abort, job queuing, schedules with cron+event+AND/OR triggers, run history with the three outcomes, pause-resets-trigger-state, project scope and allow-overlapping-runs all exist and are reached from BuildsPage/BuildReportPage/SchedulesPanel on a per-minute pg_cron heartbeat. Object-type indexing is real and reached (index_object_type builds objects.ot_<uuid> under a RUNNING build job; Reindex button; 644 gives it true replacement-pipeline swap semantics). The three large holes are all on the indexing side: (1) indexing is always a FULL rebuild — Foundry's headline OSv2 feature is `incremental object indexing (enabled by default)` and we have no changelog dataset, no APPEND diff and no 80% threshold; (2) streams do not exist anywhere in the platform (zero hits for `stream` across 240 tables, 847 functions, 216 web files), so Funnel streaming pipelines, stream configuration, direct datasources and CDC changelog metadata are wholly absent, and our datasource-kind set is 4 of the API's 10; (3) the OSv2 data-restrictions page — the most directly actionable page in the section — is read and documented but almost entirely unenforced beyond primary keys. Surface-side, the Funnel pipeline graph, live logs, Builds-app search filters and the Build schedules application are unbuilt. One reachability defect found: the link-type index engine (750) is read by the traversal reader but nothing ever BUILDS it — no heartbeat arm, no web caller.

**Have**

- Funnel batch pipeline: index an object type into OSv2 — index_object_type(uuid,uuid) builds objects.ot_<uuid> (one typed column per property) under a RUNNING build_jobs row; run_index_build(uuid[],bool), i…
- User-triggered full reindex — useReindex() in apps/web/src/features/objectTypes/indexing.ts calls runIndexBuild({p_types:[id], p_force:true}); the 'Full reindex' button is ObjectT…
- Live pipeline: reindex when the datasource moves or edits arrive — run_stale_indexes(timestamptz) selects stale types and forces a build; called by run_schedules(), which pg_cron runs every minute (cron.schedule('bea…
- Replacement pipeline: build beside the live index, then swap — 644 patches index_object_type to write objects.<tbl>__next and rename it (with its primary-key constraint) over the live table only after the last ro…
- OSv2 primary key rules: eligible base types and uniqueness — primary_key_eligibility(text) + primary_key_advice(text) (408) send geopoint, geoshape, array, time_series, decimal/double/float to 'no'; enforced by…
- Build / job / JobSpec model and the two state vocabularies — builds, build_jobs, job_specs in cat_tables.txt. build_jobs_state_check = WAITING, RUN_PENDING, RUNNING, ABORT_PENDING, ABORTED, FAILED, COMPLETED (t…
- Build lifecycle: cycle detection, build locking, staleness and force, dependent abort, queuing — 493 raises Builds:CycleDetected, opens a dataset transaction per output as the lock ('Build locking: the open transaction is the lock', 493:378), ski…
- Schedules: trigger → build, run history with Succeeded/Ignored/Failed, pause with trigger-state reset, project vs user scope, allow overlapping runs — schedules + schedule_runs; schedule_runs_outcome_check = Succeeded|Ignored|Failed; schedules_scope_check = user|project plus schedules_scope_names_it…
- Link type index build (the join-table pair store kept current) — link_type_indexes, index_link_type(uuid,uuid), run_link_index_build(uuid[],bool), link_type_index_ready/_state, link_index_job_spec all exist (750) a…

**Partial**

- **Indexing job retry policy (auto-retry after ~5 min for transient failures; retry only on new data for terminal ones)** — Retries happen, but every minute and unconditionally — the published policy's two branches are collapsed to one.
- **Data type coherence between datasource schema and object type schema, validated on every sync** — Column presence is linted; type compatibility and the 'A property could not be cast to the new type' migration refusal are not.
- **The published object-type datasource kinds** — geotimeSeries is deliberately unbuilt with a recorded reason (788 header: the feature 'is not buildable from what the corpus publishes'); the other four are simply absent.
- **The range of job kinds a build can run (sync, transform, health check, analytical app, export)** — Three of the five published job kinds have no representation; health checks exist but outside the build system.
- **Trigger grammar: time trigger, the seven event types, arbitrary AND/OR nesting** — Five of the seven published event types; the two missing ones have no backing resource in this platform (no media sets as first-class transactional resources, no virtual tables).
- **Cron expression coverage (* - / , L #, month/day names, the day-of-month/day-of-week OR rule)** — L and # are an explicit recorded refusal, not an oversight; the month/day-name gap is unrecorded.

**Missing**

- **Incremental indexing (default) — changelog dataset + APPEND diff, with the 80%-changed fallback to batch** — OSv2's headline feature — 'incremental object indexing (enabled by default) for all object types' (object-backend/overview) — is the one we do not have. *(mirror/object-indexing/funnel-batch-pipelines.md)*
- **Funnel pipeline graph and hydration status in the Datasources tab (OSv2 node green tick, Failed job link, Stream bubble)** — **Corrected 2026-09-22: the screenshots are open and the shape is measured.** pipeline1.png (882x1068, full panel) shows one Changelog node PER DATASOURCE fanning into a single Merge changes -> Indexing -> Object Storage V2 spine; four node status glyphs (green tick, dark minus-in-circle, red exclamation, a refresh badge carrying a percentage); a data store row with two independent chips `Data:` and `Schema:` beside `+ Add new data store`; and a `...` overflow holding `Copy diagnostic logs` and `Reindex`. reindex.png adds an `Enable high-scale indexing` toggle that appears in no prose. Still unbuilt, but no longer unevidenced. *(mirror/object-indexing/funnel-batch-pipelines.md)*
- **Monitor the health of an object type: Funnel job monitoring rules + Sync Propagation Delay** — **Corrected 2026-09-22: the rule family IS published and counted.** `monitoring-views/rules-reference.md` enumerates eight rules for these jobs — Changelog jobs failing, Merge changes job failing, Sync jobs failing, Scroll job failing on pipeline, Sync propagation delay, Liveness: Time since last successful checkpoint, Invalid stream records detected, Invalid direct write records detected. What is missing is ours, not Palantir's. *(mirror/object-indexing/funnel-batch-pipelines.md, mirror/monitoring-views/rules-reference.md)*
- **OSv2 value and size restrictions at index time (no NaN/±infinity, no empty strings, no nested arrays, no null array elements, 12 MB string cap, 100,000-element array cap, Lat,Long format)** — The page is read and written up (readings/datasets-rid-and-object-storage.md §'Data restrictions — the enforcement list') and none of it is built. *(mirror/object-indexing/data-restrictions.md)*
- **Funnel streaming pipelines: stream-backed object types and many-to-many link types** — No streams resource exists to back an object type, so nothing downstream (record drops, 1MB/250-property limits, retention windows) can exist either. *(mirror/object-indexing/funnel-streaming-pipelines.md)*
- **Stream configuration on an object type: compute profile and exactly-once vs at-least-once consistency guarantee** — Both settings are stated with defaults ('exactly-once' default) so they are a value set with a page, if streams ever land. *(mirror/object-indexing/funnel-streaming-pipelines.md)*
- **Direct datasources [Beta]: low-latency direct writes, source timestamp ordering, data/schema/latest-edit liveness, invalid-write logging** — Beta, not legacy, so it is in scope; it is also the documented way to get user edits onto stream-backed types. *(mirror/object-indexing/direct-datasources.md)*
- **Change data capture: changelog metadata (primary key + ordering columns + deletion column) on a datasource, resolved to a current view at index time** — 'CDC indexing for batch- and stream-backed objects' is the Ontology row of the CDC support table; we support neither side of it. *(mirror/data-integration/change-data-capture.md)*
- **Build configuration the API publishes: retryCount/retryBackoffDuration, fallbackBranches, `connecting` target mode, ignoredRids, notificationsEnabled, Cancel build** — readings/builds-and-schedules.md §'What else the spec publishes that we do not have' records all of these as deliberate residual. *(mirror/api/v2/orchestration-v2-resources/builds-create-build.md)*
- **Live logs on a running job (colour-coded levels, pause/resume, JSON parameter blocks)** — Without logs, the published debugging path for a failed Funnel job ('Choose the failed job in the pipeline graph, then select Failed job') has nothing to show. *(mirror/data-integration/builds.md)*
- **Builds application search filters (filter build jobs by object type, dataset, user, status)** — funnel-batch-pipelines names this as the way to list all build jobs for a given object type, so it is an indexing debugging path as well as a Builds-app feature. *(mirror/data-integration/application-reference.md)*
- **Build schedules application (find schedules by files/user/projects, filter by name and pause status, sort by name/creation/last run/last update, shareable search links)** — The sidebar half of the page is built; the standalone discovery application is not. *(mirror/data-integration/schedules.md)*
- **Views (a resource that is the union of backing datasets, with primary-key deduplication, resolution columns, deletion column and schema evolution)** — funnel-batch-pipelines has a whole 'Views incremental indexing' subsection about indexing view-backed object types; none of it can apply. *(mirror/data-integration/views.md)*

---

## Link types and traversal

*How objects relate.* **14 have · 8 partial · 5 missing**

Foundry's link-type layer is largely built here and largely reached: the three published relationship kinds (foreign key, join table dataset, backing object type) all exist with their cardinality pairing rules enforced as CHECKs, the pair store is indexed off the build heartbeat, per-object linked reads and the full link-filter grammar (presence + nested far-property) run in SQL and are reached from the Object View and the Explorer, and link edits are restricted to join-table links exactly as the docs restrict them. The gaps cluster in two places. First, AUTHORING AFTER CREATION: `save_link_type` accepts an `id` and can modify status, visibility, keys, API names and backing kind, but `createLinkType` in apps/web never sends one — so there is no edit path at all, no Datasources page for a link type, no conversion of an existing link to object-backed, and no `Generate join table`. Second, SET-LEVEL TRAVERSAL: the per-object walk and the link-filter semi-join are real, but `searchAround` — Foundry's type-changing ObjectSet constructor — exists only as a pure TypeScript engine nothing imports, `object_sets.traversals` is stored and ignored by `object_set_rows`, and Object Explorer's pivot to linked objects has no surface. Three smaller absences: per-side plural display names, the `hierarchy.parent` / `timeseries.parent` relation type classes, and the intermediary object's properties on an object-backed link. Per the standing scope I excluded the Phonograph/OSv1 reindex and writeback-dataset mechanisms that `edit-link-types.md` and `allow-editing.md` describe, and the Vertex-only link type classes.

**Have**

- Link type as a bidirectional schema definition with two independently-named sides — link_types carries source_label/target_label and source_api_name/target_api_name (cat_tables.txt); apps/web/src/features/linkTypes/LinkTypeView.tsx r…
- Cardinality vocabulary — one-to-one, one-to-many, many-to-one, many-to-many — CHECK link_types_cardinality_check = ARRAY['one_to_one','one_to_many','many_to_one','many_to_many'] (cat_checks.txt); LINK_CARDINALITIES drives the c…
- Backing by object type foreign keys (one-to-one / many-to-one) — backing_kind='foreign_key' + backing_column, gated by link_types_backing_check and link_types_foreign_key_cardinality; guard_link_type() raises Ontol…
- Backing by join table dataset (many-to-many) — backing_kind='join_table' with dataset_id, branch_id, source_key_column, target_key_column; CHECK link_types_backing_cardinality forces cardinality='…
- Backing object type (object-backed link types) — backing_object_type_id + source_edge_link_type_id/target_edge_link_type_id; CHECKs link_types_object_backed_edges and link_types_object_backed_cardin…
- Link type status vocabulary and the active-status protections — CHECK link_types_status_check = active/experimental/deprecated/example; guard_link_type_delete raises Ontology:CannotDeleteActiveLinkType; guard_link…
- A link type joins two object types of one ontology — guard_link_type() compares both ends' ontology_id against NEW.ontology_id and raises Ontology:LinkCrossesOntologies (417:88-93), asserted in the same…
- One datasource backs one link type — CREATE UNIQUE INDEX link_types_one_link_per_datasource (437:94) over the join-table binding; guard_link_type_datasource() trigger
- Link type validation linter (undeclared relationship, stale join key, key type match) — link_type_problems() (717) composed into ontology_violations(); three arms — undeclared backing_kind, a join key column the dataset no longer carries…
- Link indexing — the pair store built and kept fresh — link_type_indexes(link_type_id, link_count, index_table, indexed_at), index_link_type(), link_index_job_spec(), run_link_index_build(), link_type_ind…
- Per-object linked reads (List Linked Objects / Get Linked Object) — list_linked_objects(p_object_type, p_primary_key, p_link, limit, offset, application) and count_linked_objects(); called from apps/web/src/features/o…
- Link filters — presence (MUST_HAVE / MUST_NOT_HAVE) and nested far-property filters — object_set_where's linkFilter arm (776:281) plus object_set_filters_valid's one-per-LINK rule (777) and single negation (778); the Explorer's filter…
- Link edits (addLink / deleteLink) on writeback-enabled link types — link_edits(link_type_id, a_key, b_key, instruction, action_type_id, seq) with CHECK instruction IN ('addLink','deleteLink'); write_link_edit(), apply…
- Derived properties that hop across link types — derived_property_hops(property_id, position, link_type_id) with link_hop_is_many() and link_other_end(); authored in apps/web/src/features/objectType…

**Partial**

- **Object-backed link carries additional metadata on the link (the intermediary's properties)** — The two-hop walk is built; `Select a link to view the link's backing object properties` is not — no reader surfaces the middle object.
- **Editing an existing link type's metadata (status, key, API name, type classes)** — Engine complete, surface absent: a link type can only be created or deleted from the app.
- **Per-side visibility (prominent / normal / hidden)** — Stored and displayed, never authored and never obeyed: a `hidden` side still appears everywhere.
- **Link type API name rules (lowercase alphanumeric, <=100 chars, unique per object type)** — Four of the page's six rules enforced; NFKC normalisation and the reserved-keyword refusal are unchecked.
- **Type classes on link types (relation-scoped)** — Missing the two non-Vertex relation classes (hierarchy.parent drives Object View breadcrumbs), and nothing in the app writes a link type class.
- **searchAround — the type-changing set-to-set traversal, capped at depth 3** — The engine exists and nothing reaches it; a saved exploration's stored traversals are silently dropped at evaluation.
- **Code accessor names for a link side (Flight.assignedAircraft.get() / aircraft.flights.all())** — Built and unreached: the accessor the page teaches users to copy is never shown in the link type view.
- **Creating a link type from the object type's link type graph on its Overview page** — The page's third entry point (`select Create new link type from within the link type graph`) is a screenshot-evidenced UI I did not open; the absence is from the code grep, not the image.

**Missing**

- **Generate a join table dataset from the two primary keys** — `The Generate join table option will create a dataset with the correct schema based on the primary keys` has no counterpart; a many-to-many link needs a pre-existing dataset. *(mirror/object-link-types/create-link-type.md)*
- **Changing a link type's backing datasource, with key remapping** — The keys-remap-only-on-same-schema warning has nowhere to fire. *(mirror/object-link-types/edit-link-types.md)*
- **Converting an existing link to an object-backed link type** — `In the Configuration section, update the join method and select Object type` is unbuilt. *(mirror/object-link-types/create-link-type.md)*
- **Plural display name per side** — `Plural display name: The name shown to anyone accessing a link of this type with many linked object types` has no column. *(mirror/object-link-types/link-type-metadata.md)*
- **Object Explorer pivot to linked objects (change the subject type mid-exploration)** — Link filters narrow the current type; nothing produces a set of the far type from the Explorer. *(mirror/object-explorer/pivot-linked.md)*

---

## Interfaces and shared properties

*Abstraction across types.* **13 have · 12 partial · 4 missing**

Foundry's interface model is unusually well covered here: the three clauses (properties, link type constraints, action type constraints), extension with inheritance, the five implementation resolutions, the searchable 50/1000 caps and all five action-constraint save refusals are built and reached from `apps/web/src/features/interfaces/`. The gaps cluster in three places. (1) The consumption side: nothing can search or load objects BY interface — every object-set evaluator takes `p_object_type uuid` and `object_sets.subject_interface_id` is a dead column — and `ActionsMenu.tsx:74` never looks at `r.interface_id`, so an interface action never renders for an implementing object although `actions-on-interfaces.md` lists Object Explorer/Object Views as supported. (2) A transaction-shape defect: `implement_interface` takes only `p_mappings`, while `assert_link_constraints_conform` and `assert_action_constraints_conform` are DEFERRED to commit — so from the web an interface declaring a REQUIRED link or action constraint cannot be implemented at all; the platform suite only passes because it runs in one uncommitted transaction and forces `SET CONSTRAINTS ... IMMEDIATE`. (3) Property metadata depth: type classes, render hints, value formatting and aliases exist on `object_type_properties` but on neither `shared_properties` nor `interface_properties`, and struct fields hang off object type properties only. Two named divergences: `guard_parameter_mapping` (467) still refuses `interface_reference` and `object_set` parameter constraints as `not representable yet` although `action_type_parameters.data_kind` has since gained `interfaceObject` and `objectSet` — a refusal that outlived its reason; and `shared_property_id` is `ON DELETE RESTRICT` where Foundry deletes and reverts consumers to regular properties, i.e. we are stricter than the page. Excluded per scope: the `Ontology roles` interface permissioning (the overview links it to `ontology-permissions-legacy`), Phonograph/OSv1 render-hint indexing, and Pipeline Builder's implement-interface flow.

**Have**

- Interface type as an ontology resource (create with display name, API name, description, icon, saved to a project) — Table `ontology_interfaces` (api_name, label, description, rid, icon, searchable, status, project_id, ontology_id); function `save_interface(p_interf…
- Interface metadata reference — all eight published fields (RID, icon, display name, description, API name, status, searchable) — All columns on `ontology_interfaces`; status CHECK is exactly `active/experimental/deprecated/example`. Edited in apps/web/src/features/interfaces/In…
- Interface properties defined locally on the interface (the recommended form) — `interface_properties` with CHECK `interface_properties_source_check` = local|shared and `interface_properties_check` ((source='shared') = (shared_pr…
- Required vs optional interface properties, enforced at implementation — `interface_properties.required`; toggled per row in PropertiesTab; enforced by `assert_implementation_conforms()` as a DEFERRED constraint trigger (m…
- Extend an interface — multiple parents, inherited properties/link/action constraints, cycle refusal — `interface_extensions` (interface_id, parent_interface_id) with a self-reference CHECK; `interface_ancestors(uuid)` resolves the transitive closure a…
- Interface link type constraints — link target kind, target, ONE/MANY cardinality, required — `interface_link_constraints` with CHECKs `_cardinality_check` (ONE|MANY, matching the api enum), `_target_kind_check` (interface|object_type) and the…
- A concrete link type satisfies an interface link type constraint (several per constraint) — `interface_link_satisfactions` + `satisfy_link_constraint(uuid,uuid,uuid,uuid[])`; shape guarded by `guard_link_satisfaction()` (CONSTRAINT TRIGGER…
- Interface action type constraints and their parameter constraints — `interface_action_constraints` (api_name, display_name, description, required) and `interface_action_parameter_constraints` (api_name, display_name…
- The five save refusals for action type constraint mappings — All five raise in migration 467: unmapped required constraint (`ActionConstraintNotSatisfied`, :166), unmapped required parameter constraint (`Parame…
- Implement an interface — map local properties, with the wizard's resolutions — `implement_interface(p_object_type, p_interface, p_mappings jsonb)` + `object_type_interfaces` + `interface_implementation_mappings` with CHECK `_res…
- Searchable interfaces and their implementer caps (50 searchable / 1,000 non-searchable) — `guard_interface_capacity()` raises `Ontology:TooManyImplementations` with cap = CASE WHEN searchable THEN 50 ELSE 1000, on INSERT to `object_type_in…
- Shared property type as an ontology resource (create, edit, delete, staged through working state) — `shared_properties` (api_name, label, description, base_type, visibility, value_type_id, project_id, rid) + `save_shared_property(p_property jsonb, p…
- Use a shared property on an object type — assign, detach, inherited metadata disabled, base type must match — `object_type_properties.shared_property_id` + trigger function `enforce_shared_property_type()` raising `Ontology:SharedPropertyTypeMismatch` and `On…

**Partial**

- **Interface property backed by a shared property type (`Add shared properties` on the Properties tab)** — Engine accepts it; no surface reaches it, so an interface property can only be local from the UI.
- **Interface property side panel — API name, description, visibility, primary key constraint, base type** — Four of the documented tabs collapsed to one inline row; pk constraint and visibility unreachable.
- **Parameter constraint types — string, timestamp, object reference, interface reference, object set, attachment, media reference, struct** — Two of eight kinds declarable but unmappable; the refusal predates `data_kind` gaining `interfaceObject`/`objectSet`, so it has outlived its reason.
- **Implementing an interface that declares REQUIRED link or action type constraints (wizard steps 3 and 4)** — An interface with a required link or action constraint is un-implementable from the UI; the engine is correct, the entry point is the wrong shape.
- **Edit an interface implementation — update mappings after the fact; remove interface** — Delete works; `Update implementation mappings` requires removing and re-implementing.
- **Interface action rules — create / modify / delete objects of an interface, create / delete interface links** — Rules execute and are authorable; they never appear in Object Explorer or an Object View for an implementing object, which the page lists as supported.
- **Interface reference parameters on action types** — Only auto-generated by the rule compiler; never hand-authored, and the run dialog has no picker for one.
- **Interface action control — disable actions inherited from an interface per object type** — Enforced in the database, but no Interface action control section to toggle it.
- **Search, load and sort objects by interface (Object Set Service against an interface)** — The single benefit the page gives for implementing an interface — `searches against the interface will return matching objects` — is a dead column.
- **Shared property metadata reference — value formatting, type classes, render hints, aliases** — Six of the documented shared-property fields have no column; the four-tab editor (General/Display/Interaction/Details) is one inline row over label, description and visibility.
- **Deleting a shared property reverts its consumers to regular properties** — We refuse where the page deletes and reverts — stricter than Foundry, and the divergence is unscoped.
- **Shared property Usage view (which object types use this definition)** — Count plus tooltip rather than a Usage tab listing the object types.

**Missing**

- **Type classes on interface properties** — Absent; the union-with-shared-property rule has nothing to apply to. *(mirror/interfaces/edit-interface-definition.md)*
- **Struct-typed shared property types (inherited struct fields, converting a local struct property to a shared one)** — A struct shared property (or struct interface property) would be a type with no fields; no promote/convert path exists. *(mirror/object-link-types/struct-shared-properties.md)*
- **Interfaces in Functions (TypeScript v2) — importing an interface type into a function** — The overview lists Functions TS v2 as fully supported; our imports vocabulary has two members, not three. *(mirror/interfaces/interface-overview.md)*
- **Package and install interfaces through Marketplace products** — Marketplace is read but unbuilt platform-wide, so the interface content type is out of reach rather than specifically skipped. *(mirror/object-link-types/marketplace-ontology-types.md)*

---

## Derived properties, time series, geospatial, media, structs

*The richer property kinds.* **10 have · 5 partial · 10 missing**

Measured against the pre-dumped catalogs (240 tables, 847 functions, 526 CHECKs, 216 web files) and the mirror. The slice splits sharply by subsystem. DERIVED PROPERTIES and STRUCTS' core, TIME SERIES' ontology half, and the MEDIA REFERENCE property are built the way Foundry builds them and are reached from ObjectTypesPage — link-hop chains with the nine published aggregations, evaluated at read time under every hop's security; a time series sync as a real dataset-backed resource with the sensor branch; a media set VIEW as a third datasource arm. What is thin is everything one layer out: the READ surfaces (time_series_points and time_series_formatting are engines only the platform suite reaches — no surface plots or displays a series), the QUERY layer (derived properties are refused as filter/sort/group-by targets by 757; there are no geospatial filters at all against six published ones), and the BACKING SERVICES (no streams, no media sets as a resource, no geotemporal syncs, no raster). Structs are the widest definitional gap: five published struct capabilities — main fields, property reducers, struct-field-to-interface mapping, struct parameters in actions, shared-property field inheritance — have zero representation, and 633's own header already recorded four of them as unbuilt. Geotemporal series is a deliberate non-build recorded in readings/geospatial.md (its wire encoding is unpublished), not an oversight. Nothing in this slice is Phonograph/OSv1-era; derived properties, struct main fields and function-backed time series are marked Beta by Foundry itself and are reported on their newest published form.

**Have**

- Derived property definition: the Linked objects source type, an ordered chain of up to 3 link hops, the nine aggregations, and the collect limit — object_type_properties.source='linked_objects' + derived_property_hops (position CHECK 1..3) + guard_derived_property_hop(); derived_aggregations()/d…
- Derived property computed at read time, using the security context of every object involved — derived_property_select(p_property, p_alias) (758), wired into the readers by 767 (two-hop walk), 771/772/773 (far-side policy on every index joined)…
- Time series property: an existing string property designated (never the primary key), with item type answered by the sync's value column and one default per type — timeSeries.ts designate/release flips base_type; primary_key_eligibility('time_series')='no' since 408; time_series_sync_item_type(p_sync) + CHECK ob…
- A time series property backed by several syncs, resolved by a qualified series id {seriesId, syncRid} — object_type_time_series_sources(datasource_id, property_id) + guard_time_series_source(); 786 deleted 780's MultiSyncNotBuilt refusal and made time_s…
- Reading a series' time-value pairs for an object (the time series read path) — time_series_points(object_type, pk, property, from, to, limit) exists and is typed in packages/platform/src/generated.ts:4800, but its only callers a…
- Sensor object type: the designation, the Sensor link entries, and the search-around read from a root object — object_types.is_sensor + object_type_sensor_links(object_type_id, link_type_id, sensor_name_property_id) + guard_sensor_link(); sensor_series(root_ob…
- Geopoint property: 'latitude,longitude' in WGS 84 or a geohash, validated on the indexed column — 'geopoint' in property_base_types(); geopoint_valid(text) (632) accepts '57.64911,10.40744' and 'u4pruydqqvj' and refuses out-of-range lat/lon and JS…
- Geoshape property: a GeoJSON Geometry string, one of six types, never a Feature/FeatureCollection/GeometryCollection — geoshape_valid(text) (632) + property_column_check(); assertions in 632 prove Feature, FeatureCollection and GeometryCollection are refused.
- Media reference property: the base type, its three-RID value union, the media set VIEW as a datasource, the per-property media source binding and its linter — 'media_reference' in property_base_types(); media_reference_valid(jsonb) admits mediaSetViewItem/mediaSetItem/datasetFile; object_type_datasources.me…
- Struct property: declared fields over the twelve published field types, depth one, at least one field, each field mapped to a datasource column — property_struct_fields(api_name, display_name, description, field_type, backing_column, position) + struct_field_types() (the twelve, struct absent s…

**Partial**

- **Derived properties usable for further operations in the same request — filtering, sorting, aggregating** — The value is returned but cannot be a query target; the refusal is ours and scoped, not Foundry's rule.
- **Time series sync as a resource backed by a dataset or a stream, with the four published columns and the long-timestamp units** — Dataset only — grep 'stream' over cat_tables.txt returns 0 rows, so the published stream backing is absent; the optional ingestion-time column is absent; and there is no Time Series Catalog surface (no page under apps/web/src/pages) — sync…
- **Time series formatting: Units and Internal interpolation as constant-or-property operands, over the five published interpolation members** — Configured but never applied — time_series_points returns stored rows and interpolates nothing; grep 'interpolat' over cat_functions.txt returns 0. External interpolation is deliberately not modelled (it is a plot setting).
- **Geotemporal series reference (GTSR) property: at most one per object type, never an array** — Storage rules only, and deliberately so — readings/geospatial.md records that the single read endpoint is preview and the api's PropertyValue encoding table has no geotemporal row, so the wire form is unpublished.
- **Attachment property type** — A selectable base type with no validator, no storage and no read path — the shape the rest of this slice avoided.

**Missing**

- **Derived series: templated and single, saved as resources and surfaced back into the ontology as time series properties calculated on the fly** — No representation at all — neither the resource nor the 'behaves like any other TSP' read path. *(mirror/time-series/derived-series-overview.md)*
- **Function-backed time series: a function's output treated as a time series without a sync** — Beta in Foundry. We have a functions runtime (F1, QuickJS/WASM) but nothing binds a function's output to a time series property. *(mirror/time-series/function-backed-time-series-overview.md)*
- **Geospatial search and geo filters on object sets (withinDistanceOf, withinPolygon, withinBoundingBox, intersects/doesNotIntersect for shapes)** — 'Objects with geopoint properties are indexed for geospatial search' (geospatial/ontology.md) — ours are not. Also: features/objects/ObjectMap.tsx exists but is marked @surface-orphan-ok and is reach… *(mirror/functions/api-object-sets.md)*
- **Geotemporal series data itself: syncs, observations, series ids, the entries read path, and raster data in the ontology** — A recorded non-build, not an oversight: geotemporal syncs are configured in Pipeline Builder against observation schemas and hot/cold storage, none of which is ontology. *(mirror/geospatial/types-of-geospatial-and-geotemporal-data.md)*
- **Media sets as a backing resource: import, upload, views, settings, virtual media sets, DICOM, audio transcription, media transforms, granular policies** — A media reference points at a resource the platform does not hold, so nothing can resolve it to bytes. *(mirror/media-sets-advanced-formats/media-overview.md)*
- **Media item content operations (read the raw item, OCR, text extraction, transcription, metadata) and media upload through an action form** — 'Media files uploaded in action forms are only uploaded to the backing media set upon successful form submission' — we have neither the form control nor the media set. *(mirror/media-sets-advanced-formats/media-in-ontology.md)*
- **Struct main fields, and combining them with property reducers for interface implementation** — Beta in Foundry. Without it, compact views have no way to show a struct's core value, and a struct array cannot implement the four interface shapes the reducers page enumerates. *(mirror/object-link-types/struct-main-fields.md)*
- **Mapping a struct FIELD to an interface property when implementing an interface** — 'you can select a specific field from a struct property to satisfy the interface contract' — our picker can only reach whole properties. *(mirror/object-link-types/struct-main-fields.md)*
- **Struct parameters in actions: a STRUCT parameter with nested fields, complete field-to-field mapping to a struct property, and per-field defaults from an ObjectReference parameter** — So a struct property's value cannot be created or modified field-wise by an action, which is the only documented way to write one. *(mirror/action-types/actions-on-structs.md)*
- **Struct shared property types (field inheritance on conversion/attachment), struct automapping ('Automap all'), and struct field RIDs** — 633 gives the reason for the RID one: giving struct fields a RID would put them ahead of their own parent property, which has none. *(mirror/object-link-types/struct-shared-properties.md)*

---

## Action types, edits and materializations

*How objects change.* **12 have · 11 partial · 12 missing**

The authoring-and-apply spine of action types is genuinely built and reached: `action_types` + rules + parameters + criteria + form sections, all thirteen published rule kinds executable (`action_rule_kinds()`, asserted 13/13 in `packages/platform/src/actions.test.ts`), `apply_action`/`apply_function_edits` writing an append-only `object_edits`/`link_edits` ledger, reverts, the Edits and Only-allow-edits-via-actions toggles, and the T0-T14 answer key from `how-edits-applied.md` reproduced by the indexer. What is absent is almost entirely the surrounding governance and side-effect layer: there is no action log, no webhooks, no action-type notification rule, no test run, no read/write authorizations, no action metrics or action monitoring rules, no inline-edit binding, no attachment/media upload, no parameter constraint storage (so no multiple-choice or dropdown filters), no list parameters, no struct parameters, and no schema-migration framework for edits. Three engines exist but are not reached end to end: per-datasource conflict resolution (stored and guarded, ignored by the replay), materialization propagation (stored, no worker), and `action_type_parameters.value_type_id` (bound, never validated). Excluded as pre-latest per the scope directive: OSv1/Phonograph writeback datasets, `StaleObject` OSv1 version checks, and legacy writeback-dataset edit permissions.

**Have**

- Action type as an ontology entity (definition, API name, label, status, RID, project, protection) — Table `action_types` (id, ontology_id, api_name, label, description, status, project_id, rid, protected, automate_can_submit, allow_revert); CHECKs `…
- Ontology rules: the twelve rule kinds plus the schedule rule, and the refused rule combinations — `action_rule_kinds()` returns 13 rows, all `executable`; `action_type_rules` (kind, position, object_type_id, link_type_id, function_name, interface_…
- Rule property value sources (From parameter, Object parameter property, Static value, Current User/Time) — `action_rule_value_sources()` = parameter, object_parameter_property, static, current_user, current_time, schedule_run_rid, unique_identifier; `actio…
- Parameters: base type, object / interfaceObject / objectType / objectSet reference kinds, exposed and editable flags — `action_type_parameters` (base_type, object_type_id, interface_id, data_kind, required, exposed, editable, position); CHECK `action_type_parameters_d…
- Parameter default values: static, object property, and type-class prefills — `action_type_parameters.default_source` CHECK (static|object_property), default_static / default_object_parameter_id / default_property, `type_classe…
- Form sections: title, one- or two-column layout, description, hidden, collapsible — `action_type_form_sections` (api_name, title, description, columns, show_title_bar, visible, position) with CHECK `columns = ANY (ARRAY[1,2])`; `acti…
- Function-backed actions: function rule, version pinning, Edits provenance, edit batch application — `action_type_rules.kind='function'` with function_name / function_version_id / auto_upgrade; `action_function_to_run()`, `action_function_preflight()…
- Action reverts: Allow revert toggle, the undo toast, applier-only, and refusal once a later edit exists — `action_types.allow_revert`; `action_applications` (revertible, reverted_at, reverted_by_user_id); `revert_action(uuid, text)`; `clear_revertible_on_…
- Object edits log: create / modify / delete instructions, append-only, attributed to user and action — Table `object_edits` (object_type_id, primary_key, instruction, properties, applied_at, applied_by_user_id, action_type_id, seq, application_id, befo…
- Link edits: addLink / deleteLink applied through link rules and the pair store — Table `link_edits` (link_type_id, a_key, b_key, instruction, action_type_id, application_id, seq) with CHECK `link_edits_instruction_check` (addLink|…
- Edits toggle and Only allow Action types to edit objects — `object_types.edits_enabled` and `object_types.only_edits_via_actions` (default true, 605); `guard_object_edit()` raises Actions:PermissionDenied unl…
- How edits resolve against datasource updates — the T0-T14 answer key — `index_object_type` replays `object_edits` over each datasource's current view; `guard_object_edit()` enforces T14 (Ontology:ObjectIsDeleted on modif…

**Partial**

- **Allow multiple values — list parameters (primitive lists and object reference lists), i.e. bulk action types** — Without it there is no 'bulk action type' in the use-actions sense; ActionsMenu.tsx loops one apply per selected key instead. The three list-size limits in scale-property-limits are therefore unreachable too.
- **Parameter and section overrides: if/then blocks, first-true-wins** — `action_override_effects_valid` admits only visible, disabled, required, default_static. The page's fourth effect — changing the parameter's constraints — is absent, and its own COMMENT says so: 'Constraints effects arrive with constraints…
- **Submission criteria: condition/logical tree, ten operators, failure messages, evaluated at apply and pre-checked in the form** — CHECK `action_type_submission_criteria_template_check` admits only current_user and parameter. The third published template, Execution context (is this a Scenario), is missing even though `apply_action_in_scenario` and `ontology_scenarios`…
- **Conflict resolution strategy per datasource (Apply user edits vs Apply most recent value)** — Stored and guarded but unreached: the replay always behaves as apply_user_edits, and no screen sets the strategy. Edit-only properties (`object_type_properties.source='user_input'`) exist, so the 'edit-only always applies' carve-out is moo…
- **Track user edit history (per-object history of every edit, with before/after)** — Reduced: the reader selects only id/instruction/applied_at/action_type_id and never reads `before`, so there is no value comparison; nothing gates the list on `track_edit_history`; and the page's 'disabling permanently deletes all existing…
- **Materializations: materialized object dataset, property subset, automatic vs periodic propagation** — Three published members missing: restricted-view materialization targets (the row holds only `dataset_id`), the marking/provenance propagation from backing dataset and mandatory-control properties, and the propagation worker — the module's…
- **Scale and property limits on action submission** — One of three edit limits enforced, and only on one of two apply paths. The three configuration limits are unreachable because list parameters do not exist.
- **Uploading attachments and media through an action form** — Media reference properties exist as ontology structure; nothing uploads a file at action-submission time, so the 200MB cap and the ten-object attachment lifetime limit are unrepresented.
- **Permission checks when applying an action to single- and multi-datasource objects** — The single-datasource contract (can view the object + passes submission criteria) is effectively what we have; the multi-datasource D[i..k] / D[m..n] differentiation is not built.
- **Actions surfaced across the platform (Object Explorer dropdowns, Object View Actions section)** — The applicability dropdowns are built; the configurable Actions section is not — `object_views` / `object_view_tabs` store no per-button label, colour, apply-immediately behaviour, per-parameter default or visibility override, so the page'…
- **Branching action types: running an action on a branch and gating its side effects** — The configuration half of the page is absent, which is expected given webhooks and notification rules do not exist; the 'object types must be indexed on the branch' prerequisite warning is also not surfaced.

**Missing**

- **Parameter constraints (User input, Multiple choice, ranges/length) and dropdown filters with Search Arounds** — So the getting-started tutorial's 'change the constraints from User input to Multiple choice' cannot be expressed, and the object-set-derived dropdown, filters, starting-set change, Search Arounds an… *(action-types/parameters-filter.md)*
- **Struct parameters and struct property mapping in actions** — Struct properties can be defined but cannot be written by an action. *(action-types/actions-on-structs.md)*
- **Batched execution for function-backed actions (one execution over a list-of-structs input)** — The related batch-call cap (10,000, reduced to 20 for non-batched function-backed actions) is therefore also unenforced. *(action-types/function-actions-batched-execution.md)*
- **Action log: a generated [Log] object type per action type, required values, summary, and the Only allow Action types with action logs requirement** — `action_applications` is a submission ledger for reverts, not an action log object type. The whole Capabilities-tab configuration, the per-object-type requirement toggle, and the five troubleshooting… *(action-types/action-log.md)*
- **Webhook rules on action types (writeback and side effect, input parameters, output parameters)** — Consequently the writeback-before-edits ordering, the single-writeback constraint, and the branch gating of webhooks are all unrepresented. *(action-types/webhooks.md)*
- **Notification rules on action types (recipients static / parameter / object attribute / function, template or function content, links)** — The delivery substrate is built and reached from the Automate side, so this gap is the action-type binding (the Add new rule dropdown's Notification entry), not notifications themselves. The 500/50 r… *(action-types/notifications.md)*
- **Test run: simulate an action, Proposed changes, execution log, side-effect preview, referred entities** — No path produces unapplied proposed changes, and nothing separates admin-facing from end-user-facing errors. *(action-types/test-run.md)*
- **Read and write authorizations (access constraints bounding what an action may read and the minimum security it must write)** — Marked beta on the page. Its absence means an action can currently write below the security of what it read, which is the data-spill case the page's danger callout names. *(action-types/read-write-authorizations.md)*
- **Action metrics and action monitoring rules (success/failure counts, P95 duration, failure categories, dynamic scopes)** — The eight published failure categories (invalid parameter, scale limit, authentication, side effect, function, user-facing function, conflict, unclassified) have no representation. *(action-types/action-metrics.md)*
- **Action-backed inline edits (one inline edit action type per property, with its five requirements)** — So the Properties > Interaction tab binding, the bulk validate-and-submit semantics, and the invalid-inline-action refusals are all absent. *(action-types/inline-edits.md)*
- **Schema migration framework for user edits (drop all property edits, drop all edits, move edits, cast property to new type)** — So the Migrations tab in Review changes, the breaking-change detection that blocks a save, and the Delete edits button in the Datasources tab's Edits section are all absent. *(object-edits/schema-migrations.md)*
- **Packaging action types into a Marketplace product** — Read but unbuilt (the DevOps + Marketplace reading). The page's one action-specific requirement — that submission criteria reference groups rather than users before packaging — has nowhere to live. *(action-types/marketplace-action-types.md)*

---

## Functions and the OSDK

*Code against the ontology.* **10 have · 8 partial · 10 missing**

Functions are the strongest-built slice in this repo: the resource, immutable semver versions with the six published backward-compatibility checks, a QuickJS-on-WASM serverless isolate at the documented 60s limit, the five-verb edit batch, provenance enforcement, and the full function-backed action path (preflight → submission criteria → application row → apply_function_edits → revert) are all built AND reached from the web. What is reduced is the surface *inside* a function: the guest client has only where/count/fetchPage/fetchOne, its `aggregate` ignores its own spec and always returns $count, there is no ordering, no group-by and no search-around, and the declared-imports gate consults object types only while `imports.link_types` is written empty by the only publisher. What is absent falls into three clusters. (1) **Operations**: no function RID, no metrics/run-history table, no per-version configuration (timeout, memory, consistent snapshots), no live preview, no unit-testing story, no npm dependency resolution. (2) **The OSDK proper**: `gen:client` emits value sets, action types and platform functions but has no OBJECT TYPES section at all — its own comment still says `the ontology holds none`, which is stale since `index_object_type` builds `objects.ot_<uuid>` — so `client(Restaurant).fetchOne(pk)` exists only inside the isolate's hand-written harness, never as generated app-facing code. No subscriptions, no Developer Console application, no scoped token, no other-language generation. (3) **Second execution models and bindings**: staged writes, streaming, function interfaces (ChatCompletion), attachments/media, function-computed notifications, extended-execution allowlists, branching, and batched execution are unrepresented. One live defect worth naming: a `function` automation effect is storable and declared `executable` but `run_automations` raises `Automate:WrongRuntime` for it — the effect can be authored and can never fire.

**Have**

- Function resource with the four published API-name rules (lowerCamelCase, <100 chars, no leading digit, unique per ontology) — Table `functions` (id, ontology_id, project_id, api_name, display_name, description); CHECK `functions_api_name_check` = `api_name ~ '^[a-z][a-zA-Z0-…
- Immutable semantic-version releases chosen by the publisher — Table `function_versions` (major, minor, patch, prerelease, source, signature, imports, edits, breaking_changes) + `guard_function_version()` + CHECK…
- Backward-compatibility checks before publish — the six published breaking changes (drop function, drop input, reorder input, add required input, bad input retype, bad output retype), with numeric widening a warning — `signature_breaks(p_old jsonb, p_new jsonb)` in the function catalog; findings stored on `function_versions.breaking_changes` and shown at FunctionsP…
- Latest-version resolution as a choice — `latestVersionResolution` of SEMANTIC_VERSION (default) or PUBLISH_TIME, plus `includePrerelease` — `function_latest_version(p_function, p_resolution default 'SEMANTIC_VERSION', p_include_prerelease)` and `function_resolve_version(...)` exist and ar…
- Ontology edit functions — the edit batch with the five published verbs (create/update/delete/link/unlink → addObject/modifyObject/deleteObject/addLink/deleteLink) — `createEditBatch` in supabase/functions/_shared/guest.ts:97-136 emits the published ObjectEdit variants; `apply_function_edits(p_action_type, p_edits…
- Edits are applied only by a function-backed action, atomically, and never by running the function — supabase/functions/function-run/index.ts returns the batch and applies nothing; supabase/functions/action-apply/index.ts:66 `action_function_to_run`…
- Edit provenance (@Edits): a version declares the object types it may edit, and an edit outside it fails execution — `function_versions.edits` + CHECK `function_versions_edits_valid = function_edits_valid(signature, edits)` + `guard_function_edits()`. The refusal wa…
- Function-backed action rule: pins a function version, an auto-upgrade toggle, an input→parameter mapping, and exclusivity against all other rule kinds — `action_type_rules.function_name, function_version_id, auto_upgrade` + table `action_type_rule_inputs (rule_id, input_name, parameter_id)`; `guard_fu…
- Serverless (per-execution isolate) execution mode, with the 60-second elapsed limit and a memory ceiling — supabase/functions/_shared/isolate.ts:28-29 `TIME_LIMIT_MS = 60_000`, `MEMORY_LIMIT = 128 * 1024 * 1024`; :124 the QuickJS interrupt handler surfaces…
- UserFacingError distinguished from an ordinary runtime failure — supabase/functions/_shared/guest.ts:149-155 defines `globalThis.UserFacingError`; :172 reports `userFacing` as a distinct outcome, which action-apply…

**Partial**

- **Queries — the read-only subset of functions, executed through the API gateway** — Execute exists; the rest of the published resource does not — no `getQuery`, no `getByRid` or its batch variant, no `streamingExecute`, and no `transactionId` read. Read-only-ness holds by construction (the isolate cannot write) rather tha…
- **Declared resource imports scope what a function may read (object types, link types, and in v2 interface types, functions, value types, sources — the last three pinned at a version)** — Two of the six published import categories are modelled, one of those two is never populated and never checked; and an imported function or value type carrying its own pinned version has no representation.
- **Object set / search API inside a function: filtering, ordering and limiting, aggregations, group-bys, and search-arounds over links** — Missing from the guest: numeric/approximate-distinct aggregations, all four group-by kinds, orderBy, offset, and search-around/pivotTo entirely.
- **The ten published function failure types** — Four of the ten have no representation: structured error, deployment error, consistent snapshot error, and the runtime/invalid-output split is collapsed into one generic failure.
- **A function carries a RID, and can be found by it** — The page's search is 'by name, description, API name and RID'; three of the four have nothing to search and the fourth does not exist.
- **Generated Ontology SDK with a typed value per object type — client(Restaurant).fetchOne(pk) / .where({...}) / .fetchPage() in application code** — The OSDK's headline capability — the ontology entity as a generated typed value — is the half not generated. `gen:client --check` keeps the other three sections honest in CI, which is the local-SDK discipline the docs describe.
- **OSDK subscriptions — .subscribe on an object set, and the WebSocket API beneath it** — An unreached engine, and the wrong shape: it subscribes to a public table + postgres_changes filter, not to an object set with objectAdded/objectRemoved/propertyChanged callbacks.
- **Function as an Automate effect — selectable, version-pinned, auto-upgradeable, running asynchronously for up to 4 hours (with its edits deliberately not applied)** — A live defect: the effect is authorable and declared executable, and every scheduled run of it fails by name. No version pin and no 4-hour extended ceiling either.

**Missing**

- **Function metrics and run history — success/failure counts, P95 duration, 30-day usage, 7-day run history** — A function execution leaves no durable trace at all, so the Functions tab cannot show usage, and monitoring rules on P95/failure count have nothing to read. *(mirror/functions/function-metrics.md)*
- **Per-version function configuration — timeout and memory overrides, configuration inheritance, consistent-snapshot mode** — Also means no Configuration tab and no inheritance of overrides across a publish. *(mirror/functions/manage-functions.md)*
- **Developer Console application: registering an application, its OAuth client, and the scoped token restricted to chosen ontology entities — plus function registration as a requirement distinct from folder access** — This is the OSDK's third stated benefit ('a token scoped only to the ontological entities') and the source of `FunctionRegistry:ReadOntologyFunctionPermissionDenied`; neither the scope layer nor the… *(mirror/developer-console/application-scopes.md)*
- **Function interfaces — a published contract (ChatCompletion) that functions implement and applications discover** — Nothing implements or discovers a function by signature contract. *(mirror/functions/function-interfaces.md)*
- **Staged writes — a second edit model with read-after-write inside the function, WriteableClient, and discard-on-throw** — Beta upstream, and recorded as unread-and-unbuilt in docs/foundry-reference/readings/typescript-v2-functions.md §5; named here because it makes the shipped edit batch look like the only option. *(mirror/functions/typescript-v2-staged-writes.md)*
- **Streaming functions, attachments/media in functions, function-computed notifications, and npm dependencies** — Four published bindings with no representation; the exclusion is recorded and reasoned (a signature token the runtime cannot marshal would pass the CHECK and fail the call). *(mirror/functions/streaming-functions.md)*
- **Global Branching for functions — develop, publish and consume a function on a branch** — Branching exists here for six ontology entity kinds and stops before functions. *(mirror/foundry-branching/branching-functions.md)*
- **Live preview / debugging / unit testing a function, and the 280-second preview ceiling** — Our own tests (packages/platform/src/functions.test.ts, editFunctions.test.ts) test the platform's handling of functions, not a user's function. *(mirror/functions/unit-test-getting-started.md)*
- **OSDK generation for Python, Java and other languages; Python functions as a second authoring language** — TypeScript-only is the repo's stated substrate, and CLAUDE.md reserves Python for modelling behind an adapter seam — recorded as a deliberate non-goal rather than an oversight, but it is still a gap… *(mirror/ontology-sdk/generate-osdk-for-other-languages.md)*
- **Extended execution capabilities granted by administrator allowlists (calling an action from inside a function, long-TTL tokens, Marketplace install allowlist)** — The seam is drawn where the page implies it should be — the capability does not exist rather than being ungranted — so nothing is wrong, but the administrator's grant has no counterpart. *(mirror/functions/permissions.md)*

---

## Security: policies, markings, roles, access checking

*Who sees what.* **13 have · 11 partial · 7 missing**

Measured against mirror/object-permissioning/ and mirror/security/ (plus manage-granular-policies.md, mandatory-control-properties.md, manage-markings.md), reading the pre-dumped catalogs and apps/web/src. The row/column/cell engine is the strongest part of this repo's security layer and is genuinely reached: object and property security policies exist, compile to SQL, override the datasource policy, and are edited from a mounted Security tab card. The granular grammar carries all eight published comparisons, the three published weights and both limits. Markings are complete as a mandatory control — conjunctive AND, categories, the exact three-permission vocabulary, inheritance along both file hierarchy and data dependency — and a marking on an object type now hides the type and its instances. Restricted views, mandatory control properties (markings + organizations), organizations-as-markings, groups, project roles and checkpoints are all built and reached. The gaps cluster in four places. (1) CBAC exists only as its marking machinery (disjunctive categories, implied/disallowed/required relations, banner, restrictions); the classification *objects* — file, data, project and project-maximum classification — have no column anywhere, which also leaves the classification arm of mandatory control properties and action parameters unbuilt. (2) Everything that evaluates a policy for *someone other than the caller* is thin: the Test security policies modal is read but unbuilt, Check access covers four kinds but is mounted on only two surfaces and has no folder kind, and Data Lineage permission coloring, the access graph and emulation mode are absent. (3) Download is entirely absent as a concept — no download operation, no role that can drop one, and `dataExport` is deliberately refused by `audit_categories()`. (4) Three smaller published pieces are unbuilt: per-datasource property nulling on an MDO, the markings a materialization must inherit from its policies, and the restricted-view-to-object-security-policy migration tool. Two deliberate divergences are worth surfacing to the operator: we refuse `NOT` outright where Foundry only warns, and scoped sessions narrow dataset/project reads but not object-type markings.

**Have**

- Object security policies — row-level view permissions configured on the object type, independent of the backing datasource — Table `object_security_policies` (id, object_type_id, name, policy). Compiled by `object_security_predicate(uuid,text)` and applied through `object_r…
- Property security policies — column-level, a passing row with a null in the covered cell; plus the three published restrictions — `property_security_policies` + `property_security_policy_properties` with PRIMARY KEY (policy_id, property_id) and UNIQUE (object_type_id, property_i…
- The Markings slot of a security policy — inherit from datasources, stop inheriting, add new — `object_policy_marking_stops` / `object_policy_marking_adds` and `property_policy_marking_stops` / `property_policy_marking_adds`; readers `object_po…
- Seeing objects requires the object type AND access to the data (datasource Viewer when no policy is configured) — 833 added `datasource_readable(uuid)` and `object_type_data_readable(uuid)`; four readers refuse with `Ontology:ViewObjectPermissionDenied` while the…
- Markings as a mandatory control — conjunctive AND, categories, binary membership, all-or-nothing — `markings`, `marking_categories` (category_type CHECK IN ('conjunctive','disjunctive'), visibility IN ('visible','hidden')), `marking_members` (user…
- Marking permissions — Manage permissions / Apply marking / Remove marking, distinct from membership — `marking_permissions.permission CHECK IN ('manage','apply','remove')` exactly matching manage-markings.md:79-81; functions `can_manage_marking`, `can…
- Marking inheritance along the file hierarchy AND along data dependencies, and removing an inherited marking in a transform — `effective_file_markings(p_kind,p_id)` and `effective_data_markings(p_dataset)` are separate as the page requires; `file_marking_origin(p_kind,p_id,p…
- A marking on an object type hides the type and its instances — `effective_object_type_markings(uuid)` (819/820) inherits from the project; `object_type_instances_readable(uuid)` (823-825) gates `indexed_objects`…
- Restricted views, including marking-backed restricted views and testing a view as a user — `restricted_views` (policy jsonb, protected), `restricted_view_predicate(uuid,text)`, `restricted_view_markings(uuid)`, `restricted_view_marking_stop…
- Project roles — Owner, Editor, Viewer, Discoverer as the discretionary control on ontology resources in a project — `project_role_grants_role_check CHECK (role = ANY (ARRAY['owner','editor','viewer','discoverer']))`, principal is user or group (`project_role_grants…
- Checkpoints — acknowledgement or justification before a sensitive action, with reviewable records — `checkpoint_configurations`, `checkpoint_conditions` (four kinds enumerated in its CHECK: user_submitting, selected_principal, marking, location), `c…
- Organizations as a mandatory boundary — an organization is a marking, disjunctive across a set, with guest membership — `organizations.marking_id`, `mint_organization_marking(p_org,p_name)`, `provision_organization_marking` trigger, `refuse_marking_reassignment`; `orga…
- Groups as the principal for role grants and policy attributes — nested membership, expiring membership, provider-driven assignment — `groups` (group_type, latest_expiration, max_duration, realm), `group_members` (member_user_id OR member_group_id, expires_at) so nesting and expiry…

**Partial**

- **Granular policies — 8 comparison types, the user-attribute list, the 10-comparison and 10,000-weight limits** — Missing: **custom attributes** (`Any custom attributes configured by your identity provider`) — 483:37 refuses them by name. `authorized_group_ids` is accepted but compiles to '{}' (484:158, 568), so it is unbound. Divergence: we refuse `N…
- **The Organizations slot of a security policy — add/remove organizations as a mandatory control on the policy** — Blocked on a real missing primitive, not on evidence: the organization permission model itself is unbuilt.
- **Mandatory control properties — a per-row marking/organization set on a restricted-view-backed datasource, securing all other properties of that datasource** — Missing the third type: classifications. 727's header records `Max classification is CBAC-gated ... and stays a recorded residual` — no max_classification column on object_type_datasources.
- **Mandatory controls in actions — a marking or classification parameter whose value must satisfy the property's allowed set** — Missing: the classification parameter and the parameter-level **max classification** validation the page describes as an action-type validation distinct from the datasource check. Organization parameters are correctly absent — the page say…
- **Multi-datasource object types — column-wise MDO, the 70-datasource limit, and per-datasource nulling for an unreadable source** — Missing the documented UX: `properties mapped from those datasources will appear as null`. 833's own header records the per-datasource nulling as unbuilt, and the platform has one type with one datasource to exercise it.
- **Check access panel — Access requirements and Additional data requirements for a named user** — The `project` and `restricted_view` branches are built and unreached. Missing kinds: **folder** (`a Project, folder, or file`) and the Workshop/Slate application the object-security page names.
- **Custom roles and role sets — a role built from operations, e.g. one with download operations removed** — So a custom role that removes an operation from a resource role (the download control the page describes) is not representable.
- **CBAC marking machinery — disjunctive categories, implied/disallowed/required-in-conjunction relations, classification banner** — The marking algebra is there; what is keyed to it is not — see the classification-objects row. Single-level (not transitive) implication is a recorded inference in readings/cbac.md.
- **File, data, project and project-maximum classification — the CBAC objects that gate discovery, data and project membership** — This also leaves unbuilt the three rules ontology-permissions.md states: a file classification is required at creation, it must be ≤ the project maximum, and `object type materializations fail if no classification is specified`.
- **Scoped sessions — narrow a session to a subset of markings, with the No-scoped-session escape and the workspace banner** — Enforcement is narrower than the docs: 404 applies `passes_scoped_session` to dataset and project reads only, and `satisfies_markings` has no scoped-session arm — so a marking on an OBJECT TYPE is not narrowed by the active session. Also `…
- **The Security tab explains all four permission questions — view the object type, edit it, see instances, run actions** — The page enumerates four — `the required permissions to view and edit an object type, and the required permissions to see instances or run actions`. The fourth needs to reason over action types.

**Missing**

- **Test security policies modal — evaluate an UNSAVED policy for a named user against a hypothetical object** — Three seams we do not have at once: someone else's identity, an object that may not exist, a policy that is not saved. *(mirror/object-permissioning/object-security-policies.md)*
- **Visualizing access across a pipeline — Data Lineage permission coloring (Resource access / Data access in datasets) and the access graph** — The lineage tool exists; the permissions lens on it does not. *(mirror/security/checking-permissions.md)*
- **Download controls — download permissions on an object type or its backing datasource, a role that lacks the download operation, and download auditing** — Absent as a concept, so all three of the page's role/checkpoint/audit layers are unreachable for downloads. *(mirror/security/download-controls.md)*
- **Emulation mode — a scoped session over a chosen subset of your own groups and markings, to test a workflow as a lesser user** — Marked Beta upstream, but it is the other half of the `test before releasing` story alongside the Test security policies modal. *(mirror/security/emulation-mode.md)*
- **Materializations under an object security policy — the output dataset carries the most restrictive markings from datasources, policies and mandatory-control properties** — All three published sources of markings on a materialization are unpropagated, including `markings from all mandatory controls properties used in the granular policies`. *(mirror/object-permissioning/object-security-policies.md)*
- **Restricted view → object security policy migration tool, with its six unsupported configurations and the discretionary-security preservation step** — The page recommends object security policies over restricted views `for most use cases built on the Ontology`, so this is the documented path off the older mechanism. *(mirror/object-permissioning/object-security-policies.md)*
- **Property security markings shown beside a property value (the condensed pill and expanded view)** — Upstream this ships in Workshop widgets, which are outside this repo's build scope; the per-value marking metadata a reader would have to return is not, and does not exist. *(mirror/security/property-security-markings.md)*

---

## Object sets, search, filtering and aggregation

*How objects are found.* **7 have · 14 partial · 10 missing**

Measured 28 published capabilities for this slice against the catalog snapshots, the migrations and `apps/web/src`. The shape of what we have: **the single-type filtered object set is real, reached and well-guarded** — `evaluate_object_set` / `count_object_set` / `aggregate_object_set` / `histogram_object_set` compile the seven-kind filter grammar `generate-urls.md` prints, enforce the Searchable/Sortable/Selectable render hints and the hidden-property rule, and are called from `apps/web/src/features/explorer/api.ts`, the Functions guest runtime and the automation ledger. Saved Explorations and Lists, sorting, Actions-over-a-selection and Export are all built end to end.

What is missing is **the algebra and the text engine**. There is no `union`/`intersect`/`subtract` anywhere in the 847-function catalog, so an object set is never composed from other object sets — which also means no Comparison Views. `searchAround` is stored (`object_sets.traversals`, with a validator and a COMMENT marking the shape as ours) but no evaluator reads the column and no web file writes it: the pivot, which `pivot-linked.md` calls the point of the Explorer, is a grammar with nothing behind it. Same pattern for KNN (`object_type_nearest` exists, only a platform test calls it) and for interface-backed sets (`subject_interface_id` exists, `save_object_set` cannot write it). Three engines nothing reaches.

Text search is the largest reduction. The OpenSearch path is genuinely built — `search_index_payload` emits analyzer-derived mappings, `search-index` pushes them, `search-query` issues a Lucene `query_string` with the documented syntax verbatim — but it is gated on an unset `OPENSEARCH_URL`, and the live fallback `search_objects()` is `ILIKE '%q%'` against the **title column only**. Property keyword filters have one of the four published match modes and no leading wildcards, no relevance ordering, no boolean composition. Aggregation covers exact-value grouping and auto-bucketing but none of `ranges`/`duration`/`segmentBy`/`accuracy`, and two of the eight `AggregationV2` metrics.

Note on vocabulary: our filter grammar is deliberately the Object Explorer's URL encoding (7 value kinds + `linkFilter`), not the API's 27-member `SearchJsonQueryV2`. I report that as one capability rather than 27 gaps, but the geo, regex, wildcard, isNull and term-matching families really are absent from the wire model.

**Have**

- Object set: `base` + `filter` (a single object type narrowed by predicates) — `object_sets` table (cat_tables.txt:118) plus `evaluate_object_set(uuid,jsonb,jsonb,int,int,text)`, `count_object_set`, `object_set_where`, `object_s…
- Object set: `static` (an explicit list of members) — `object_set_members(object_set_id, primary_key)` (cat_tables.txt:117); `save_object_set` list branch (supabase/migrations/477:118-133) either snapsho…
- Object set referenced by RID (`reference` / `methodInput`, object set parameters) — `object_sets.rid`, `evaluate_object_set_by_rid(text,int)`, `object_set_subject_api_name(text)` (cat_functions.txt 263/567). Reached by `supabase/func…
- Explorer filter value grammar — the seven value kinds — `object_set_value_filter_valid(jsonb)` (migration 776:85-100) enumerates exactly textFilter, valuesFilter, dateRangeFilter, numberRangeFilter, relati…
- Sorting an object set (multi-property, ordered, hint-gated) — `evaluate_object_set` builds a multi-key ORDER BY `applied in order`, refuses hidden properties and raises `Ontology:PropertyNotSortable` for a strin…
- Saved Explorations and Lists (dynamic vs static, re-evaluated on open) — `object_sets_kind_check CHECK (set_kind = ANY (ARRAY['exploration','list']))` (cat_checks.txt:307); `save_object_set(jsonb)`, `object_set_rows(uuid,i…
- Object set as an automation / monitor condition input — `object_set_keys(p_set uuid, p_limit int DEFAULT 100000)` (cat_functions.txt:562) with `automation_input_limit()` carrying the published 100,000 / 1…

**Partial**

- **Object set: `searchAround` / pivot to a linked object type** — Stored grammar with no evaluator and no writer — the Explorer's defining move is unreached.
- **Object set: `withProperties` (derived properties computed over the set)** — Projects but cannot filter, sort or aggregate by the computed value.
- **Object set: `nearestNeighbors` (KNN / vector search)** — Engine exists with the published k<=100 and 2048-dim bounds; no surface reaches it.
- **Object set: `interfaceBase` / sets scoped to an interface** — Pre-teardown column with no live writer; `asType` / `asBaseObjectTypes` have no representation at all.
- **Filtering on links: Has Link, far-object properties, Filter by <LinkedType>** — 2 of 3 published link filter kinds; the far-object listogram has no token in `valuesFilter`.
- **Text analyzers and the searchable index (standard/simple/whitespace/not-analyzed/language)** — The index is built and pushed, but the cluster is gated on `OPENSEARCH_URL` and nothing in the repo sets it; no repo-side evidence the analyzer ever takes effect at query time.
- **Global search bar with the documented syntax (phrases, AND/OR/NOT, wildcards, fuzzy)** — The fallback — the only path provable from the repo — matches one property by substring: no tokens, no operators, no wildcards, no fuzzy.
- **Property keyword filter match modes (Contains / Starts with / Exact / Is not) and leading wildcards** — 1 of 4 published match modes, and that one is substring rather than token; the `Enable leading wildcards` render hint does not exist.
- **Aggregation metrics over an object set** — 6 of 8 metrics, and one metric per call rather than a list of aggregations.
- **Aggregation group-by kinds (exact / ranges / fixedWidth / duration) and segmentBy** — 2 of 4 groupBy kinds, no `segmentBy` three-dimensional aggregation, no `accuracy` enum (REQUIRE_ACCURATE / ALLOW_APPROXIMATE) and no 10,000-bucket cap.
- **Pagination through a large object set** — Offset exists and is unreached; no `pageToken`/`nextPageToken` cursor and no `snapshot` consistency flag.
- **Charts as the filtering surface (8 chart kinds, linked-object charts, config)** — 2 of 8 kinds; listogram aggregation/sort config is unreached (`aggregate_object_set` takes p_sort_by/p_desc, the UI hardcodes 'count'/true), and Keep/Exclude multi-select, histogram range inputs and charts on linked objects are absent.
- **Applying Actions, Export and Open In over the current object set** — Actions and Export are built and reached; the `Open In` category has no route to any other application.
- **Object Explorer search results page (All/Objects/Object types/Artifacts tabs, facet sidebar, search-around from a hit)** — Result ordering is faithful; the results page, its facets and the hover `start an exploration across this link` affordance are unbuilt.

**Missing**

- **Set operations: `union`, `intersect`, `subtract`** — An object set is never composed from other object sets — 3 of the 15 published ObjectSet union members. *(functions/api-object-sets.md)*
- **Temporary object set (createTemporary, expires after one hour)** — No ephemeral set handle for a client to pass between calls. *(api/v2/ontologies-v2-resources/ontology-object-sets-create-temporary-object-set.md)*
- **API filter vocabulary `SearchJsonQueryV2` (27 comparison kinds)** — A deliberate divergence (we build the Explorer, not the API), but the geo, regex, wildcard, isNull and term-matching families are absent in every form. *(api/v2/ontologies-v2-resources/ontology-object-sets-load-object-set.md)*
- **Boolean composition of filters (AND/OR/NOT, nested search terms, term modifiers)** — The search bar's whole compositional half — nested And/Or tags, operator flipping, per-term modifiers — has no model. *(object-explorer/filter-results.md)*
- **Cross-property keyword search within an exploration (`Has keywords`)** — `Keyword searches are supported across all of an object type's properties` — we only support the per-property form. *(object-explorer/filter-results.md)*
- **Property selection on load (`select` / `selectV2`, struct-field and load-level selectors)** — Always all visible properties; no projection, no APPLY_REDUCERS / EXTRACT_MAIN_VALUE load levels, no `excludeRid`. *(api/v2/ontologies-v2-resources/ontology-object-sets-load-object-set.md)*
- **Comparison Views (compare two filtered object sets side by side)** — Follows from the missing set algebra — comparison needs a second set as a first-class object. *(object-explorer/compare-object-sets.md)*
- **Exploration layouts (save/share/default per user and globally) and undo/redo** — Chart layout, column configuration and sorts are not persisted anywhere; the admin default-layout branch has no representation either. *(object-explorer/explore-charts.md)*
- **Subscribing to changes in an object set (OSDK `.subscribe` / Object Set Watcher WebSocket)** — No streaming read path for a set; every explorer read is a TanStack Query poll. *(ontology-sdk/websocket-subscriptions.md)*
- **Analyze objects using SQL (read-only scratchpad over object types and link types)** — Beta in Foundry; its materialization prerequisite (`object_type_materializations`) does exist here, so the input side is present and the surface is not. *(object-explorer/analyze-sql.md)*

---

## Ontology management: branching, versioning, linting, cleanup, migration

*Changing the ontology safely.* **14 have · 10 partial · 6 missing**

Foundry's ontology lifecycle in its current generation is Global Branching plus Ontology Manager: branch from `main`, stage a working state, rebase with conflict resolution, open an ontology proposal (one task per resource), pass merge checks, get approvals, merge — with cleanup, save history and restore alongside. We have built most of the engine and most of it is reached. 26 capabilities measured: 14 have, 6 partial, 6 missing.

The spine is genuinely there and wired: `ontology_branches` / `ontology_proposals` / `proposal_tasks` / `proposal_reviews` / `working_state_changes` / `ontology_saves` back a real UI (BranchesPage, ProposalsPage, MainBranchUpdatesPage, ReviewEdits, OntologyHistoryPage, CleanupPage). Cleanup is the closest match of anything in this slice — all six computable published flags, all three verbs, and the config subpage, all reached. Resource protection covers exactly the five kinds Foundry lists and deliberately omits type groups, which is what Foundry also does.

The gaps cluster in three places. **(1) Branch security is half-built**: `branch_roles`, `assign_branch_owner()`, `guard_last_branch_owner()` and `can_manage_branch()` exist and no web file names any of them, and the branch carries no space or organizations at all — Foundry gates branch access on org membership. **(2) Nothing happens at the branch boundary**: no branch indexing (so no Preview status), no build options at merge, no inactivity sweep or retention policy despite `last_activity_at` being maintained. **(3) The proposal is a review surface, not a record**: no Changelog tab, no overview edit list with `remove from branch`, no task comment threads, and `do_not_merge` is enforced by `proposal_blockers` but has no toggle.

Outside branching: Upgrade Assistant is absent entirely, migrating resources between ontologies is absent, the destructive-edit `type the entity name` confirmation is absent, and there is no per-resource History tab despite `ontology_save_changes` being indexed on `(resource_kind, resource_id)` precisely for it. Legacy ontology branches/proposals, ontology-roles migration and the OSv1 `phonograph_deindexed` cleanup flag were excluded per scope; our `cleanup_flags()` already marks that flag non-computable, which is the right call.

**Have**

- Create and switch ontology branches (branch from `main` only; title + description) — Table `ontology_branches` (id, ontology_id, name, title, description, status, last_activity_at, last_rebased_at, rid, ...) with CHECK `name <> 'main'…
- Save to new branch from the save dialog — Function `save_to_new_branch(p_name text, p_title text)` (migration 466); imported and used as `useSaveToNewBranch` in apps/web/src/features/branchin…
- Resource protection on the five branchable ontology resource kinds — Migration 462 creates `guard_protected_object_type`, `guard_protected_link_type`, `guard_protected_shared_property`, `guard_protected_interface`, `gu…
- Ontology proposal as a PR: one task per ontology resource, Open / Merged / Closed — `ontology_proposals` (status CHECK open/merged/closed) + `proposal_tasks (proposal_id, resource_kind, resource_id, auto_approved)` + `create_proposal…
- Reviewers: invite, assigned-to-me, approve or reject per task or in bulk — `proposal_reviewers (proposal_id, user_id, added_at)`, `proposal_reviews (task_id, user_id, decision, comment)` with `CHECK (decision IN ('approved'…
- Merge the proposal into main — `merge_proposal(p_proposal uuid)` defined in migration 461, patched by 462 and 672 (672 splices `record_ontology_save` in after the version bump, ass…
- Working state: stage edits, Review edits dialog, discard one resource or all — `working_state_changes (ontology_id, branch_id, user_id, resource_kind, resource_id, operation, fields, base, base_version)` with operation/resource_…
- Save-time update and merge-conflict resolution when another user saved first — `working_state_conflicts(p_branch)` and `update_working_state(p_resolutions jsonb, p_branch uuid)`; `working_state_changes.base_version` is the optim…
- Ontology linting: errors block the save, warnings do not — `ontology_violations()`, `ontology_violations_core()` and `ontology_warnings()` (base 589, spliced forward through 787); `save_working_state` refuses…
- Restore an object type to an older version, staged into the working state — `restore_object_type(p_object_type uuid, p_save uuid)` reading `ontology_save_changes.definition`; reached in OntologyHistoryPage.tsx:130-158 with th…
- Ontology cleanup queue: Start cleanup, flags with priority, filters, configurable flag set — `cleanup_configurations (mode CHECK default/custom, computed_at)`, `cleanup_candidates (configuration_id, object_type_id, flags, priority CHECK high/…
- Cleanup verbs: Snooze, Deprecate, Delete — staged like normal ontology modifications — `cleanup_snoozes (user_id, object_type_id, until)` plus useSnooze/useUnsnooze/useSnoozed, useDeprecateCandidates and useDeleteCandidates in apps/web/…
- Entity status and deprecation metadata (reason, deadline, replacement) — `status, deprecation_reason, deprecation_deadline, replaced_by` present on object_types (cat_tables.txt:130), action_types (:9), link_types (:90), on…
- Export, edit and import the ontology working state as JSON — `export_working_state(p_ontology uuid, p_branch uuid)` and `import_working_state(p_file jsonb)`; reached from apps/web/src/pages/ontology/AdvancedPag…

**Partial**

- **Branch lifecycle states Active / Inactive / Archived / Merged, with retention-driven inactivity** — No automatic inactivity marking, no data deletion after N days, and no Control Panel global branch retention policy — only manual archive/restore.
- **Branch taskbar: branch name, modified-resource panel, proposal and merge actions** — Three published taskbar members missing: the modified-resource panel with navigation, checks/reviewer management, and merge from the taskbar.
- **Branch security: Owner role, role management, and the branch Security tab** — Owners are assigned and guarded in the database, but no surface assigns or shows roles — the Security tab is unbuilt.
- **Branch access gated by space and organizations** — `a user must be a member of at least one of the organizations listed on a branch in order to access it` is not represented.
- **Rebase a branch onto main with conflict resolution (Use Main / Keep current / custom change)** — Two of the three published resolution paths. No custom-change path (navigate to the resource and edit until the conflict clears), and the page has no All changes / Conflicts / Errors tab split — it shows conflicts only.
- **Merge checks / blockers, including the Do not merge setting** — Checks are enforced; the branch owner has no way to apply or remove Do not merge, which is the owner's only merge veto.
- **Build options when merging a proposal (all affected / modified only / none)** — A merge applies metadata only; downstream resources are never rebuilt or re-indexed.
- **Preview status: index object types on a branch so branch data is viewable** — Also means the published limitation `indexing counts as a modification` has nothing to apply to.
- **Proposal Changelog tab, overview edit list, and task-level comment threads** — Three published members of the proposal view absent: Changelog, the removable edit list, and the Comments sidebar.
- **Ontology history: every save, who made it and when, expandable to per-resource detail** — Two published filters absent: hiding changes to object and link types you cannot view, and consolidating same-author entries into one.

**Missing**

- **Destructive-edit confirmation (type the entity name to proceed with a breaking save)** — `you can type in the name of the entity you edited to proceed with saving` has no representation; a writeback-enabled object type can be edited destructively with one click. *(ontology-manager/save-changes.md)*
- **Owner-authored ontology linters that check entity definitions in code before deploy** — Foundry: `Ontology owners who need to enforce style and design-pattern guidelines write linters that check the entity definitions in code before they are deployed.` Ours are ours, not theirs. *(superrepo/core-concepts.md)*
- **Per-resource History tab and the last-edited-by footer on a resource page** — The global history page exists; the per-resource one does not, so you cannot see or restore one type's timeline from its own page. *(ontology-manager/restore-changes.md)*
- **Migrate ontological resources between ontologies** — Resources carry ontology_id and could in principle be repointed, but there is no selection-and-preview migration flow and no check that connected resources move together. *(ontologies/ontology-migration.md)*
- **Upgrade Assistant: platform changes, impacted resources, assignment, notifications** — The nine-page section is entirely unrepresented; we publish the role that would oversee it without the thing to oversee. *(upgrade-assistant/overview.md)*
- **Bulk edit multiple properties (base type, type classes, render hints, visibility, value formatting)** — None of the five published bulk actions exists; the one bulk-shaped thing we have is a status cascade, not property-editor multi-select. *(object-link-types/edit-properties.md)*

---

## Ontology Manager and consumption surfaces

*The screens.* **11 have · 18 partial · 12 missing**

Measured mirror/ontology-manager (10 pages), mirror/object-views (23 pages) and mirror/object-explorer (17 pages) against the pre-dumped catalogs and apps/web/src. The OMA *shell* is genuinely built and reached: top bar + sidebar (OmaLayout.tsx), branch control and taskbar, Cmd/Ctrl+K search, Discover, the resource pages, Review edits with merge-conflict resolution, Unsaved changes, Ontology history with a staged restore, Advanced export/import, Cleanup with its flag configuration, and the Ontology configuration toggles. The object type view carries eight of Foundry's tabs, and every engine behind them (usage ledger, dependents, capabilities, materializations, security policies) has a reader. The consumption side is thinner than it looks: the standard Object View ships, the configured view ships in its minimal form, but **seven of the object-views section's published pages have no representation at all** — profiles, the applications sidebar, panel form factors (instance and set), tab visibility conditions, per-view branching, object comments, and real versioning. Object Explorer has the explore/results loop, saved explorations and lists, pivot-on-links, Actions and Export, but two of its seven chart kinds, no column configuration, no inline edits, no comparison mode and no SQL analysis. Three distinct failure shapes recur: (a) *unreached engines* — `opensearch_analyzer()`, `search_index_payload()`, `object_view_for()` exist in `pg_proc` and in `packages/platform/src/generated.ts` and nothing in apps/web calls them; (b) *Overview sections that became tabs* — ③ Action types and ⑥ Data are simply absent from the type Overview; (c) *list pages with no list affordances* — the object types page is an unfiltered card grid where navigation.md documents filtering on visibility, development status and indexing issues. Per the standing scope instruction I excluded Object Storage v1 / Phonograph flags (cleanup.md's `Phonograph deindexed` flag, navigation.md's Phonograph reindex error column), legacy datasource-derived and Ontology-roles permission models, and config-legacy-object-views.md. I did not open any PNG; where a capability is only evidenced by a screenshot I say so in the note.

**Have**

- Ontology Manager navigation: the persisting top bar and sidebar — apps/web/src/features/ontologyManager/OmaLayout.tsx (381 lines) renders `.oma-top` + `.oma-side` with the Resources group from features/ontologyManag…
- Branch switcher in the top bar and the branch taskbar — OmaLayout.tsx BranchControl + BranchTaskbar + WakeBranchDialog against `ontology_branches` (id, ontology_id, name, title, status, last_rebased_at) an…
- Object type view: sidebar of pages with the selected page beside it — pages/ontology/ObjectTypesPage.tsx:534 `<Tabs id={type-…} vertical>` with Overview, Security, Datasources, Interfaces, Capabilities, Object views, De…
- Object type Overview ① metadata card — features/objectTypes/MetadataCard.tsx (MetaShell two-column shell, Row with help icons) reading object_types.plural_label, point_of_contact, contribu…
- Object type Overview ⑤ Dependents — features/objectTypes/DependentsTab.tsx + features/objectTypes/dependentsAndUsage.ts over `object_type_dependent_counts`; rendered as a tab (ObjectTyp…
- Export, edit and import an Ontology working state as JSON (Advanced page) — pages/ontology/AdvancedPage.tsx calling `exportWorkingState` / `importWorkingState` from @beacon/platform, downloading and re-uploading the file in t…
- Ontology cleanup: queue, flags, flag configuration, snooze / deprecate / delete — pages/ontology/CleanupPage.tsx + CleanupFlagsPage.tsx over `cleanup_configurations`, `cleanup_candidates`, `cleanup_flag_overrides`, `cleanup_snoozes…
- Standard Object View: prominent properties spotlighted above a table of normal properties, hidden excluded — pages/ObjectViewPage.tsx StandardBody — `.ov-prominent` cards over the `.ov-properties` grid, `visibility === 'prominent'` vs 'normal', hidden never…
- Configured Object View: one per type, tabs backed by Workshop modules in the two published kinds, toggle back to standard — features/objectView/ObjectViewsTab.tsx (create/add/remove tabs), features/objectView/api.ts, features/objectView/EmbeddedModule.tsx; tables `object_v…
- Save explorations and save lists, and apply Actions / Export from an object set — features/explorer/SaveDialog.tsx + SavedSetPage.tsx over `object_sets` (filters, traversals, set_kind) and `object_set_members`; features/explorer/Ac…
- Text search behaviour: analyzers, wildcards, fuzzy matching, boolean operators — `object_type_properties.analyzer` is stored and `opensearch_analyzer(p_analyzer text)` and `search_index_payload(p_object_type uuid)` exist in cat_fu…

**Partial**

- **Header search bar (Cmd/Ctrl+K) over Ontology resources** — navigation.md also lists *property* as searchable — no property is in the index; and no per-field match highlight, no result preview pane, no faceted sidebar counts while searching (OmaSearch's own comment concedes the last).
- **'Back home' navigation with hover quick-links to recent and related resources** — Consequence of our divergence: Foundry opens an object type as its own view, ours expands it below the grid.
- **Discover view (favorites, recently viewed, favorite groups, customizable sections)** — Absent and named in the file's own header: Favorite object types, Favorite groups, the Customize homepage dialog (no per-user store — grepped cat_tables.txt for favorite/star, no match), and the new-user fallback sections (recently modifie…
- **Object type Overview ② Properties section and the Property editor view** — Foundry: `Select a property from the Properties section of an object type's Overview page to open the property editor view.` Ours has no per-property surface at all — the editor is a draft-and-save row grid, so there is nothing to select i…
- **Object type Overview ④ Link type graph with graph/list toggle** — No graph canvas, no graph/list toggle, no zoom/fit; and links where this type is the TARGET never appear, so the section is one-directional where Foundry's graph is not.
- **Ontology metrics: reads, writes, interactions, active users; Overview graph and Usage tab** — The Usage TAB is built and correctly refuses to read 'no data' as 'no usage'. The Overview usage bar chart with its 'See more' link is absent — there is no chart on Overview at all.
- **Save changes: Review edits dialog, per-resource entries and discard, merge-conflict Update** — Absent: the dialog's **Errors** and **Warnings** tabs (grepped the file — no such strings; errors surface only on /ontology/health via ontology_violations/warnings), and the destructive-edit confirmation that makes you type the entity's na…
- **Review and restore changes: Unsaved changes, global History, per-resource History, object type restore** — Missing: the per-resource **History** tab on an object/link/action type page (TypeDetail has no History tab), the 'hide changes to resources you cannot see' filter, the merge-by-author consolidation, and the 'last edited by X' footer at th…
- **Prominent-property display behaviour per base type (media viewer, time-series chart, Map)** — All three special formats named by the page — dedicated media viewer, interactive time-series chart, geohash/geoshape/GTSR on a Map — fall back to the ordinary FormattedValue cell.
- **Linked objects component: group by link type, inline far-property preview, open a subset in a new tab, preview in the side panel** — Three of the four documented uses are absent: inline preview of a linked object's properties without leaving the view, opening a subset in a new tab, and previewing a selected linked object in the side panel. Rows are plain links to /objec…
- **Panel Object Views: object instance panels and object set panels** — Both form factors are published as first-class (full and panel), and the object SET panel with its Charts/List default tabs is a second thing entirely. Recorded as deferred in readings/object-views.md §21.2.
- **Object View versioning: save vs publish, version list with author and description, republish an older version** — A monotonic integer only. No version rows (no table holds prior versions), no 'Automatically publish new versions' switch, no descriptions, no preview-and-republish dialog, so 'control which version is published' — the point of the page —…
- **Object Explorer home: global search, object type groupings, per-type counts, preview panel, favorites** — 'Add object type as favorite (F)' has no store — nothing in cat_tables.txt records a favourite, which is the same gap as the OMA Discover view's favourites.
- **Exploration: charts as filters, results table with sorting, selection preview, link pivots** — Two of the seven published chart kinds. Missing: Pie Chart, Grid Plots, Single Statistic, Statistics Table, Maps; also absent are undo/redo of exploration changes and the saved chart layout.
- **Link type view with Overview and Datasources pages** — Foundry's link type view has two pages; ours has one, and the link type's own datasource configuration is reachable only through the creation form on the source type's Overview.
- **Action type view with Overview / Logic / Observability pages** — Observability is the whole gap: 30-day near-real-time action usage and the action monitoring rules with their status. `monitoring_rules.resource_type`/`target_id` could carry it — nothing points them at an action type from this page.
- **Function type view with Overview / Configuration / Observability, usage history and version selector** — The version dropdown is there in effect (Versions tab). Missing: the Observability page (function metrics over 30 days + monitoring rules), the Usage History panel that lists which applications use which version, and the 'Open in Code Repo…
- **Preview and edit entry points for an Object View from Ontology Manager** — config-overview names four things this tab does that ours does not: select and **pin a default display object** to preview, preview the full and panel form factors, test light and dark mode, and an **Edit** control on the right of the head…

**Missing**

- **Top bar 'create new Ontology resources' menu** — Creation exists per-kind on each resource page; the single top-bar entry point does not. *(mirror/ontology-manager/overview.md)*
- **Home page filters on the resource lists (visibility, development status, indexing issues)** — navigation.md: `These pages allow for filtering object types and link types based on their visibility, development status, and indexing issues.` The index state IS shown per card (ready/refreshing/fa… *(mirror/ontology-manager/navigation.md)*
- **Object type Overview ③ Action types section** — The screenshot's banded sub-header (`References [Example Data] Aircraft` with its own count) is image-only evidence, which I did not open; the prose alone establishes the section exists. *(mirror/ontology-manager/overview.md)*
- **Object type Overview ⑥ Data (datasource sync rows with relative times)** — The 'x weeks ago / See all' rows are image-only evidence (oma-user-interface-overview-annotated.png), which I did not open. *(mirror/ontology-manager/overview.md)*
- **Object View tab settings: conditional visibility (property values, link visibility), content type / link badge, content layout, cross-section filtering** — All four of the page's configurable settings are absent; a tab is title + position + module. *(mirror/object-views/config-tabs.md)*
- **Object View profiles (surface different tabs to different roles)** — Named as a deferred residual in readings/object-views.md §21.2, so this is a recorded omission rather than an oversight. *(mirror/object-views/config-profiles.md)*
- **Object View applications sidebar (groups of application cards, actions, parameterized URL cards)** — The whole opt-in sidebar — group titles, card/compact modes, thumbnails, `{{parameterName}}` URL templates, the `{{objectId}}`/`{{objectTypeId}}` defaults — has no representation. *(mirror/object-views/config-app-sidebar.md)*
- **Object View branching (Global Branching integration, per-resource branch entries in the taskbar)** — The ontology itself branches (ontology_branches + working_state_changes.branch_id); object views do not travel with it. *(mirror/object-views/branching-object-views.md)*
- **Comment on objects (comments helper, mentions, attachments)** — The page is short but unambiguous: the button lives in the header of any Object View. *(mirror/object-views/comment-on-objects.md)*
- **View results: configure columns (add, remove, reorder, resize) and inline edits** — Sorting by column IS built (SortSpec); the column set is fixed and cells are read-only. *(mirror/object-explorer/view-results.md)*
- **Compare object sets (comparison mode, saved and shared comparison views)** — Recorded as a known omission in the source, with the rest of the comparison family (undo/redo, Compare ▾). *(mirror/object-explorer/compare-object-sets.md)*
- **Analyze objects using SQL from an exploration** — Marked [Beta] upstream but not deprecated, so in scope. *(mirror/object-explorer/analyze-sql.md)*

---

## Operational lifecycle: health, usage, packaging, automations

*Running it in production.* **11 have · 15 partial · 11 missing**

Foundry's operational lifecycle for this slice has four pillars: Data Health (health checks + monitoring views, one app), Automate (the single entry point for business automation, which supersedes Object Monitors), observability/metrics (usage, run history, action/function metrics), and DevOps + Marketplace (packaging resources into products and installing them). We are strong on two and absent on two. The Data Health and Automate ENGINES are real and reached: `health_checks`/`evaluate_health_check`/`run_health_checks`, `monitoring_views`/`evaluate_monitoring_rule`/`run_monitoring_rules`, `automations`/`automation_effects`/`run_automations`, all on the pg_cron minute hand, all with routed web surfaces (`/data-health`, `/automate`, `/notifications`, `/ontology/health`). What is reduced is consistently the ENUMERATION, not the mechanism: 21 of 29 published check types, 5 rule types in 3 of 11 published rule families, 4 of 6 current condition types, scheduled evaluation only (no live monitoring, no automation-dependent). Two structural holes are worth naming. First, the alert-to-notification seam: the notification engine (793-803) was built for Automate and never wired to the other two producers — `evaluate_health_check` and `evaluate_monitoring_rule` never call `send_notification`, so watchers and subscribers are modelled audiences that receive nothing, against a page that says Data Health `will always send an in-platform notification to watchers of failed checks`. Second, packaging: DevOps and Marketplace are entirely unbuilt — no products, stores, versions, installations, presets or upgrades — which means an ontology built here cannot be shipped anywhere, and every per-entity `marketplace-*.md` page (action types, automations, health checks, schedules) has no counterpart. Also absent across the whole slice: external alert destinations (PagerDuty/Slack/webhooks), Data Health's Issues integration, email/digest delivery, and action/function/AIP-Logic metrics. EXCLUDED per the latest-generation rule and not reported as gaps: Object Monitors (`object-monitors/overview.md` marks the whole app Sunset, `We recommend migrating your workflows to Automate`), Data Health check groups (`check-groups-overview.md` Sunset, migrate to monitoring views), Automate's `metric_changed` condition (Sunset), and Resource Management Monitors (`resource-management/monitors.md` deprecated in favor of anomaly detection).

**Have**

- Health checks on datasets (Data Health) — Tables health_checks, health_check_results, health_check_watchers; functions evaluate_health_check(uuid), run_health_checks(); pg_cron entry in 659_t…
- Check evaluation schedules — automatic on update plus a manual interval — AFTER-commit trigger run_dataset_health_checks (659_the_data_health_engine.sql:633-653) covers the on-update arm; health_checks.refresh_interval + ne…
- Check watchers and the three watch levels — health_check_watchers(check_id, user_id, level) with CHECK level IN ('nothing','all_failures','only_critical'); useSetWatch in features/dataHealth/ap…
- Monitoring views — views, rules, severity ladder, subscribers, alerts — Tables monitoring_views, monitoring_rules, monitoring_rule_conditions, monitoring_subscribers, monitoring_alerts, monitoring_alert_transitions; funct…
- Alert snoozing at rule and alert level — snoozed_until/snoozed_by/snooze_reason on both monitoring_rules and monitoring_alerts, CHECK requiring a non-empty reason, trigger clear_alert_snooze…
- Automate — automations, conditions, effects and the runner — Tables automations, automation_effects, automation_runs, automation_events; run_automations(timestamptz) spliced into the minute hand (518, 544:186…
- Per-effect automatic retries — automation_effects.retry_count/retry_interval with CHECKs bounding 1-5 and <24h and restricting them to action and logic kinds; automation_runs.attem…
- Muting, pausing, expiration and auto-mute — automations.muted/paused/expires_at/auto_mute; auto_mute_if_due(uuid) + automation_should_auto_mute + automation_event_all_failed spliced into run_au…
- Manual execution of an automation — execute_automation_now(uuid) enqueues an event that queued_automation_events(timestamptz) drains inside run_automations (625:187); useExecuteNow at f…
- Ontology export and import of the working state as JSON — export_working_state(p_ontology, p_branch) and import_working_state(p_file jsonb); reached from apps/web/src/pages/ontology/AdvancedPage.tsx:27,46 th…
- Ontology health issues — the entity linter's errors and warnings — ontology_violations() and ontology_warnings() read by apps/web/src/features/health/api.ts and rendered by pages/ontology/HealthIssuesPage.tsx, routed…

**Partial**

- **The published check-type enumeration (checks reference)** — Eight types unbuilt; the four sync-family ones need a sync concept we do not have.
- **Health checks on schedules and on tables** — Foundry names three check targets (datasets, schedules, tables); only datasets are reachable.
- **In-platform notification to watchers when a check fails** — Watchers receive nothing; the page says Data Health will ALWAYS notify them.
- **Email notifications and email digests** — The channel set is declared honestly; only in_platform actually delivers, and there is no digest scheduler.
- **The monitoring rule catalogue (eleven published rule families)** — Missing families: agent, object and link, streaming dataset, live deployment, time series sync, geotemporal, function, action.
- **Dynamic scopes for monitoring rules** — Missing the three application scopes — Workflow Lineage, Workshop, OSDK application — which the page ties to the function and action rules we also lack.
- **Object set condition types** — Missing objects_modified (live-monitoring only) and threshold_crossed (needs a metric the grammar has no room for).
- **Evaluation frequency — live, scheduled, automation-dependent** — Two of three published modes absent; live monitoring is what objects_modified depends on.
- **Effect kinds — action, logic, function, notification** — Three of four execute; 'logic' is declared but inert because AIP Logic is not built here.
- **Fallback effects** — The engine runs fallbacks; nothing in the app can author one.
- **Automation history and its six-month retention** — Missing three of the ten published types — automation_recovered, subscribed, unsubscribed — the first because threshold conditions do not exist.
- **Notification effect — recipients, object grouping, content** — Missing function-generated notification content and attachments (Notepad/Contour PDFs).
- **Ontology usage metrics (reads, writes, interactions, active users)** — The page names two places to view usage; only the Usage tab exists — the Overview tab's summary graph is unbuilt.
- **Run history for functions, actions and automations** — One of the three published source-executor types has a run history.
- **Audit log export to a dataset** — Engine and cron are live; no screen creates or lists an export, so it is unreached.

**Missing**

- **Data Health to Issues integration (file an issue on failure, close it on recovery)** — Our only 'Health issues' is the ontology linter, a different thing entirely. *(data-health/notifications.md)*
- **Object and link monitoring rules (ontology indexing health)** — The one rule family that watches the ontology's own pipelines is absent, though index_object_type exists to watch. *(monitoring-views/rules-reference.md)*
- **Composite monitoring rules (conditions joined by AND)** — The severity ladder is built; AND-joining two metrics in one rule is not. *(monitoring-views/core-concepts.md)*
- **Sending alerts to external systems (PagerDuty, Slack, webhooks)** — Alerts cannot leave the platform; severity has no routing target outside our own tables. *(monitoring-views/external-systems.md)*
- **Event retries (retry a whole trigger event)** — The second half of the retries page — a strategy for the entire event — has no function. *(automate/retries.md)*
- **Branching automations (test on a branch before merging to main)** — Automations live only on main; the page's create-test-merge cycle has no representation. *(automate/branching-automations.md)*
- **DevOps products — package resources, versions, stores, tags, folder tracking** — Nothing here can be packaged; the reading devops-and-marketplace.md is explicit that it was read and not built. *(foundry-devops/create-products.md)*
- **Marketplace installations, inputs, presets, upgrades and release channels** — No installation job, no input mapping, no Release/Test/Stable channel, no maintenance window. *(marketplace/installations.md)*
- **Packaging ontology entities into a product (action types, automations, health checks, schedules)** — The whole 'ship an ontology to another enrollment' end of the lifecycle is absent. *(foundry-devops/supported-resources.md)*
- **Action, function and AIP Logic metrics (success/failure counts, P95 duration)** — None of the seven published action failure categories are recorded, so no rule could alert on them either. *(action-types/action-metrics.md)*
- **Resource Management — compute and storage usage reports, budgets, anomaly detection** — Per-project and per-ontology consumption accounting has no representation; RM Monitors are excluded as deprecated. *(resource-management/usage-types.md)*

---

## What the adversarial pass overturned

Each of these was first reported as a gap and then falsified against the catalogs.
They are listed because the pattern is the useful part: a capability built under a
different name reads as missing to anyone grepping for Foundry's wording.

| capability | was | now | what overturned it |
|---|---|---|---|
| The space is the first element of every resource path, and the path is immutable | partial | **have** | The claim's only evidence was that nothing calls `resourceLocation`. True, but the concept is built and reached under a different name: `datasetLocation()` at apps/web/src/features/datasets/api.ts:51-52 composes `${spac… |
| An ontology's resources must be saved in a project within the same space as the ontology, under Compass naming conventions (no `/`, unique names) | missing | **partial** | The first clause — resources must be saved in a project — is fully built AND reached, so `no representation` is false. supabase/migrations/454_ontology_resources_live_in_projects.sql adds `project_id` to all five placea… |
| Bulk edit — statuses across object types | missing | **partial** | FALSE GAP. Bulk status editing across object types IS built and reached — on the Cleanup page, not the Object types page the surveyor grepped. apps/web/src/pages/ontology/CleanupPage.tsx holds `const [picked, setPicked]… |
| Primary key — designation, eligibility by base type, uniqueness, protection | partial | **have** | Every published element of create-object-type.md's `Configure the primary key and title key` section is built AND reached; the surveyor's own evidence lists the engine and stops short of the surface. apps/web/src/pages/… |
| Refusal of MapType / StructType columns in a backing datasource | partial | **have** | The claim measures us against create-object-type.md:41 (`may not contain `MapType` or `StructType` columns`), but migration 440 resolved that as a documented contradiction in the corpus, not as a narrowing of ours: stru… |
| Generate a backing dataset (`Continue without datasource` / select a location for permissions) | partial | **have** | The capability is built and REACHED end to end in the UI; only the SQL function is bypassed. `apps/web/src/features/objectTypes/BackingStep.tsx` draws both cards from the capture (`Continue without datasource / Generate… |
| Time series sync as an object type datasource | partial | **have** | It matches the published member field-for-field. api/v2/ontologies-v2-resources/object-types-get-object-type-full-metadata.md defines `timeSeries` as exactly `timeSeriesSyncRid` (required) + `properties` — ours is `time… |
| Derived-properties datasource (api `unsupported`, unsupportedType `derivedProperties`) | partial | **have** | The api page itself calls this member `unsupported` — `A datasource of a kind not yet exposed in the public API` — so the absent datasource row is an encoding artifact of an endpoint we do not serve, and this repo's rec… |
| Data type coherence between datasource schema and property base type on sync | missing | **partial** | The documented outcome — `Incompatible data types for a property will cause the build to fail` — does happen, at value level. `index_object_type` creates `objects.ot_<uuid>` with one column per property typed by `proper… |
| Link type index build (the join-table pair store kept current) | partial | **have** | The claim's core assertion — `nothing BUILDS them ... run_stale_indexes has no link arm` — is false. supabase/migrations/750_a_join_table_is_indexed_alongside_the_objects.sql lines 339-384 patch the LIVE run_stale_index… |
| OSv2 value and size restrictions enforced at index time | missing | **partial** | Two of the page's enumerated restrictions are built, including one the claim itself listed as absent. (1) 'Lat, Long should be a comma-separated string with no parentheses': public.geopoint_valid(text) (632_a_geopoint_i… |
| Funnel pipeline hydration status (OSv2 node green tick, failed job) | missing | **partial** | The pipeline GRAPH is unbuilt, but 'no representation' is false — the green-tick semantics are implemented and reached by four surfaces. apps/web/src/features/objectTypes/indexing.ts:45-48 quotes the page verbatim ('A g… |
| editsOnly as an object-type datasource kind | missing | **have** | Listed as a missing member of the published ObjectTypeDatasource union, but it is built — at a different level of the model, cited, and recorded as a deliberate placement difference. 545_an_edit_only_property_is_permiss… |
| Creating a link type from the object type's link type graph on its Overview page | missing | **partial** | The link type graph itself EXISTS and IS REACHED, built under a different name — `Data Lineage`. `lineage_graph(p_kind, p_id, p_up, p_down)` (cat_functions.txt:506, migration 479_one_graph_over_datasets_and_object_types… |
| Implementing an interface that declares REQUIRED link or action type constraints (wizard steps 3 and 4) | missing | **partial** | The satisfaction half is built AND reached from the web, so `missing` would invite rebuilding what exists. `satisfy_link_constraint(uuid,uuid,uuid,uuid[])` (768_a_concrete_link_satisfies_the_constraint_and_a_constraint_… |
| Search, load and sort objects by interface (Object Set Service against an interface) | missing | **partial** | `object_sets.subject_interface_id` is not an inert column. It carries an FK — `subject_interface_id uuid REFERENCES public.ontology_interfaces(id) ON DELETE CASCADE` (248_object_sets.sql:32) — the CHECK `object_sets_one… |
| Struct-typed shared property types | missing | **partial** | A struct-typed shared property is creatable and reached TODAY, so `missing` would invite re-adding a base type that already saves. `shared_properties_base_type_check CHECK ((base_type = ANY (property_base_types())))` (c… |
| Reading a series' time-value pairs for an object (the time series read path) | partial | **have** | The reachability evidence is false. `time_series_points` IS reached from the web, transitively: `sensor_series()` (supabase/migrations/783_a_sensor_object_type_records_a_series_for_the_object_it_links_to.sql:287-347) se… |
| Media sets as a backing resource for an object type (media set + view datasource, bound to media reference properties) | missing | **partial** | `Only a free-text RID validated by rid_valid() and nothing else` is false on every count. The datasource union has a dedicated media arm: cat_checks.txt:314 `object_type_datasources_one_backing` requires `media_set_rid… |
| Geoshape property: a GeoJSON Geometry string, one of six types, never a Feature/FeatureCollection/GeometryCollection | partial | **have** | Nothing about this is reduced or unreached. `geoshape_valid(text)` (cat_functions.txt:291) is emitted into the REAL per-type column by `index_object_type`: 632 patches the column builder from `format('%I %s', p.property… |
| Allow multiple values — list parameters (primitive lists and object reference lists), i.e. bulk action types | missing | **partial** | The surveyor searched for an is_list/allow_multiple FLAG; ours is a BASE TYPE. `action_type_parameters.base_type` is CHECKed as `base_type = ANY (property_base_types())` (cat_checks.txt, action_type_parameters_base_type… |
| Uploading attachments and media through an action form | missing | **partial** | ``action_type_parameters` has no attachment or upload columns` is false — `base_type` IS the attachment column, and an attachment parameter is created and asserted on in a migration that ran. supabase/migrations/463_the… |
| Latest-version resolution as a choice — `latestVersionResolution` of SEMANTIC_VERSION (default) or PUBLISH_TIME, plus `includePrerelease` | partial | **have** | Nothing about this capability is reduced or unreached — the published rule set is complete, enforced and on the live run path. THE RULES, from `api/v2-functions-v2-resources-queries-execute-query.md`: `By default, this… |
| A function carries a RID, and can be found by it | missing | **partial** | The RID half is genuinely absent, but the findability half is BUILT AND REACHED — and calling the whole thing missing invites rebuilding a search that already ships. WHAT THE PAGE ASKS FOR, `functions/manage-functions.m… |
| File, data, project and project-maximum classification — the CBAC objects that gate discovery, data and project membership | missing | **partial** | The surveyor grepped the English word 'classif'. Foundry's own CBAC page defines these objects AS markings ('Classification markings are configured in categories'), and we built them under the marking vocabulary. (1) DA… |
| Property security markings shown beside a property value | missing | **partial** | The surveyor grepped for 'securityMarking' / 'showSecurityMarkings' — English UI strings. security/property-security-markings.md says the pill 'display[s] the markings and CBAC values configured through object and prope… |
| Subscribing to changes in an object set (react when objects enter/leave a set) | missing | **partial** | The platform half is built AND reached — the surveyor looked only for an OSDK `.subscribe`/WebSocket. `automation_condition_valid` (supabase/migrations/517_an_automation_is_a_condition_and_its_effects.sql:75-76) admits… |
| API filter/comparison vocabulary for searching an object set (SearchJsonQueryV2) | missing | **partial** | A substring grep for the API's spelling cannot prove absence — the concept is built under generate-urls.md's names and roughly a third of the published members map onto arms that exist. `object_set_property_predicate` (… |
| Boolean composition of search criteria (AND / OR / NOT, phrases, nesting) | missing | **partial** | The claim bundles 'nested search terms' with the filter tree, and the search-term half ships and is reached. `search-syntax.md` documents exactly this for the global bar — quotation-mark phrases, 'Logical operators (not… |
| Branch access gated by space and organizations | missing | **partial** | The claim measured a column (`ontology_branches` has no space_id) instead of the access rule. Migration 441 DROPs `ontology_branches.organization_id` (441:89) precisely because a branch reaches its space through its ont… |
| Preview status: index object types on a branch so branch data is viewable | missing | **partial** | The published tab `shows which object types have been indexed, are in progress, or cannot be indexed` (ontologies/review-ontology-proposals.md:44). That readout exists and is reached: `object_type_index_report()` (migra… |
| Build options when merging a proposal (all affected / modified only / none) | missing | **partial** | `merge_proposal writes nothing to builds` is true and irrelevant to whether affected resources get built. The chain exists and is reached end to end: a merged edit lands on `object_types`/`object_type_properties`, which… |
| Text search behaviour: analyzers, wildcards, fuzzy matching, boolean operators | partial | **have** | The `unreached` half is false. WRITE path: `search_index_payload(uuid)` is called by an edge function — D:/project-beacon/supabase/functions/search-index/index.ts:40 `service.rpc('search_index_payload', { p_object_type:… |
| Object View tab settings: conditional visibility, content layout, content type/link badge, cross-section filtering | missing | **partial** | The evidence `no visibility, condition, content-type, layout or filter-set column anywhere in cat_checks.txt` is false — it looked only at `object_view_tabs`, but our object view tab IS a Workshop module, and the tab's… |
| Panel Object Views: object instance panels and object set panels | missing | **partial** | The evidence `ObjectViewPage renders one full-page body` is false. D:/project-beacon/apps/web/src/pages/ObjectViewPage.tsx exports a second entry point deliberately built for panel use — `export function ObjectView({ ty… |
| 'Back home' navigation with hover quick-links to recent and related resources | missing | **partial** | The evidence is a substring grep for the literal string `Back home`, which this repo's own rule says cannot prove absence. Home navigation exists and is reached: apps/web/src/features/ontologyManager/OmaLayout.tsx rende… |
| `Approximate standard deviation` as a missing health check type (named inside the check-type enumeration claim) | missing | **have** | `## Approximate standard deviation` in docs/foundry-reference/mirror/data-health/checks-reference.md:406 is a TOP-LEVEL `##` section, a sibling of `## Status checks` / `## Time checks` / `## Size checks` / `## Content c… |

## What this census does not cover

- **Products this repo does not build** — Notepad, Contour, Carbon, Vertex, Code
  Workbook, Quiver, and the Workshop/Slate authoring internals. Their absence is a
  scope decision, not a gap.
- **Sections absent from the mirror.** 4,123 of 4,818 known pages are on disk, and
  what is missing is missing by the SECTION. A capability documented only in an
  unmirrored section cannot appear here at all.
- **Depth within a `have`.** A capability counted as built may still diverge in
  detail; this census asks whether the mechanism exists and is reached, not whether
  every field matches.
- **Anything evidenced only by a screenshot.** The surveys were instructed not to
  open images, so a capability visible only in a capture is under-counted here.
