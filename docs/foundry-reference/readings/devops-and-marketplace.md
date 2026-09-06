---
verify: strict
---

# Foundry DevOps and Marketplace — how a workflow ships

Two sections that were **wholly absent from the mirror** until 2026-09-06 —
`foundry-devops` (11 pages) and `devops` (3) — plus `marketplace` (9), which
was already on disk. They are one product read from two ends: DevOps is where
a builder packages resources into a **product**, Marketplace is the storefront
where an installer installs it.

**Why now.** The board carried "marketplace mirror fetch" as a residual behind
the usage ledger, and the drift backlog surfaced its edge: `foundry-rules/marketplace`
changed upstream to say the `Rule` and `Proposal` objects cannot be packaged.
A sentence about what Marketplace cannot carry is worth little without the
pages that say what it can.

**What I read, counted rather than asserted.** All 14 newly mirrored pages
whole: `devops/{overview,core-concepts,_index}` and
`foundry-devops/{overview,_index,create-products,manage-products,folder-tracking,input-presets,manage-store-permissions,manage-store-tags,package-multiple-products,export-import-products,supported-resources}`.
`devops/_index` is byte-identical to `devops/overview`, and `foundry-devops/_index`
to `foundry-devops/overview` — two more double-mirrored slugs. The nine
`marketplace/` pages were **not** re-read here; this reading is the builder's
end, and the installer's end is quoted only where a DevOps page points into it.

**Images: 2 of 54 parsed**, both because they carry model shape the prose
leaves implicit — `foundry-devops/images/inputs-and-outputs.png` and
`foundry-devops/images/folder-structure.png`. The other 52 are step-by-step
captures of a packaging UI this repository does not build and are named as
unparsed rather than silently skipped: the store and draft views
(`select-store`, `store-overview`, `creation-landing-page`,
`add-outputs-selector`, `output-information-panel`, `move-to-output`,
`bulk-move-to-output`, `move-to-output-not-supported`,
`input-information-panel`, `group-by-folder`, `group-by-linked-products`,
`linked-products-main-packaging`, `documentation`, `settings`,
`review-and-publish`, `product-limits-error`, `product-packaging-limits`,
`unsupported-resource`), the product and version views (`published-products`,
`product-overview`, `product-version-table`, `start-new-version`,
`version-page`, `set-release-channel`, `deprecate-product`,
`recall-version-product-table`, `recall-version-product-version`), folder
tracking (`configure-folder-tracking`, `folder-tracking-edit`, `refresh-all`,
`edit-details-panel`, `stale-overrides`, `migrate-to-folder-tracking`,
`migrate-to-folder-tracking-page`, `migrate-to-folder-tracking-page-2`,
`disable-folder-tracking`), presets (`input-preset-source`,
`input-preset-override`, `input-preset-installation`, `input-preset-api-name`),
groups (`add-products-to-group`, `linked-products-graph`,
`graph-add-remove-products`, `graph-broken-links`, `publish-draft-group`),
tags (`store-page-with-filters`, `configure-categories-and-tags-on-store`),
export/import (`product-export`, `product-export-zoomed`, `product-import`),
and `marketplace-storefront`.

---

## 1. Four nouns, and they are not the ones we have

`devops/core-concepts` exists because the vocabulary is specialised, and it
says so:

> "This page describes the core concepts that underpin Foundry DevOps and Foundry Marketplace. We recommend that you read this page before proceeding since Foundry DevOps and Marketplace use specialized terminology (such as "[product](#product)")."

— `devops/core-concepts.md`

**Product** — a collection of resources made available to install:

> "In Foundry DevOps, "products" are collections of Foundry resources that a product builder has made available to install."

— `devops/core-concepts.md`

> "Each product has outputs, or *content*, that are produced when the product is installed. Products may require that installers map *inputs* in order to produce output content."

— `devops/core-concepts.md`

**Product version** — a new one per change, and the installer chooses:

> "Product builders [create](/docs/foundry/foundry-devops/create-products/) and [publish new versions](/docs/foundry/foundry-devops/manage-products/) of products every time they want to adjust existing product content or add new product content."

— `devops/core-concepts.md`

**Store** — a collection of products, local or remote:

> "Stores are collections of products; these products typically have a shared purpose. Product builders can [publish new products to stores](/docs/foundry/foundry-devops/create-products/). Stores that appear on your Foundry instance may be local (for instance, produced by a builder within your organization who works on your Foundry instance) or remote (for example, the *Foundry Store* that is available to all Foundry users and maintained by Palantir)."

— `devops/core-concepts.md`

**Installation** — the thing an installer creates by satisfying the inputs:

> "An [installation](/docs/foundry/marketplace/installations/) is created when an installer fulfills the required inputs (if any) for a product. Each product can be installed multiple times."

— `devops/core-concepts.md`

and the two reasons a product is installed more than once are the shape of a
fleet — per audience, and per environment:

> "You need to create an installation for different development environments. For example, you might install a ticket management product into a pre-production [space](/docs/foundry/security/orgs-and-spaces/) and [ontology](/docs/foundry/ontologies/ontologies-overview/), and again into a production space and ontology, each with their own input data and environment-specific settings like [release channels and upgrade windows](/docs/foundry/marketplace/installations/#installation-settings)."

— `devops/core-concepts.md`

**The example product types are our own phases, listed back.** An Ontology
("a comprehensive standard industry ontology or an ontology fragment"), a Use
Case (Workshop plus functions), a Pipeline, a Model. So a product is not a new
kind of resource — it is a *packaging of the resources we already build*, which
is why this section can be read after them rather than before.

## 2. Inputs are outside the box — what the diagram says

`foundry-devops/images/inputs-and-outputs.png` draws a product as a bordered
box with a package glyph in the corner. **Outputs sit inside it**, blue, with
dashed arrows running between them — one output feeding another. **Inputs sit
outside it**, orange, each with a dashed arrow into an output. So the product's
boundary is exactly the set of outputs, and an input is a *hole in the
boundary*: a dependency the product declares and the installer fills.

The prose gives the rule for which side a resource belongs on:

> "As a general rule, if you want installers to provide their own version of a resource, such as their own [dataset](/docs/foundry/data-integration/datasets/) or object type, then you should list that requirement as an input. If you want your product to instead provide a resource for your installers, then you should promote the input to be an output."

— `foundry-devops/create-products.md`

> "If you iteratively promote all inputs to outputs, then users who install your product will not need to map anything during installation."

— `foundry-devops/create-products.md`

**Inputs are discovered, not declared.** The builder adds outputs and the
platform computes the frontier:

> "DevOps automatically surfaces output dependencies as **Inputs** as you add outputs to your draft product. Users who install your finished product must provide resources to satisfy each input."

— `foundry-devops/create-products.md`

> "DevOps automatically identifies resource dependencies, so you should add the furthest downstream resources first. For example, if you want to package a [Workshop application](/docs/foundry/workshop/overview/) and four [object types](/docs/foundry/object-link-types/object-types-overview/), you should only add the Workshop application."

— `foundry-devops/create-products.md`

That is a dependency closure over the resource graph, and **we already have
the graph it would walk**: `dataset_inputs` declares derivation, `job_specs`
name their inputs, `object_type_datasources` bind a type to a dataset,
`action_type_rules` name their object and link types, `function_versions.edits`
name what a function writes, and `workshop_widgets`/`workshop_variables` name
the object sets a module reads. A product draft is a walk over exactly those
edges, and the instruction to add the furthest downstream resources first is what makes the walk
terminate at the leaves the installer must supply.

Some inputs can never be promoted:

> "You cannot move certain input types, such as [parameters](/docs/foundry/quiver/cards-parameters/) or [groups](/docs/foundry/platform-security-management/manage-groups/), to outputs since DevOps requires their configuration for installation."

— `foundry-devops/create-products.md`

## 3. What may be packaged, and what may not

> "The vast majority of Foundry resource types can be included as outputs when [creating a product](/docs/foundry/foundry-devops/create-products/)."

— `foundry-devops/supported-resources.md`

> "If a resource is unsupported, the resource will show in the draft with an error. Unsupported resources must be removed from the draft before publishing."

— `foundry-devops/supported-resources.md`

The named exclusions are three, and the page says the list is partial:

> "* [Data Connection sources](/docs/foundry/data-connection/core-concepts/#sources)
> * [Code Workbook workbooks](/docs/foundry/code-workbook/core-concepts/#workbooks)
> * [Fusion sheets](/docs/foundry/fusion/sheets-overview/)"

— `foundry-devops/supported-resources.md`

**The per-resource constraints live on each resource's own page, not here** —
"refer to the resource's Marketplace documentation" — which is why the drift
backlog found the Rules constraint on `foundry-rules/marketplace` rather than
in this section, and why a `marketplace-*.md` page exists per product area.
That is the shape to expect: a *packaging* section that defers the rules to
the *resource* sections.

**A dataset is three different outputs depending on how it is packaged**, and
only one of them reads rows:

> "Only the **Include with static data** packaging option reads the dataset's files. If you do not need the dataset's rows in the product, choose **Include dataset definition only** or **Include with transform or pipeline** instead; neither option requires the **Download** operation."

— `foundry-devops/manage-store-permissions.md`

## 4. Versions, channels, recall — a release model, not a save

Release channels are the part with real semantics, and they are **hierarchical
rather than exclusive**:

> "Release channels are hierarchical rather than mutually exclusive."

— `foundry-devops/manage-products.md`

> "* **Release:** The installation receives the versions tagged as **Release**, **Pre-Stable**, or **Stable**.
> * **Pre-Stable:** The installation receives the versions tagged as **Pre-Stable** and **Stable**.
> * **Stable:** The installation receives the versions tagged as **Stable**."

— `foundry-devops/manage-products.md`

So a channel is a *floor*, not a label: tracking Release admits everything,
tracking Stable admits only the most conservative tag. The default is stated —
"by default, all installations are set to track the **Release** release
channel".

Withdrawal has two verbs and neither is deletion:

> "To deprecate a product, select **Deprecate** from the dropdown menu next to the **Start new version** button on the product overview page to hide the product from the storefront. Hard deletion of products is not currently supported."

— `foundry-devops/manage-products.md`

> "For local Marketplace stores, this action will prevent new manual installations, upgrades, and automatic upgrades from installing the recalled version. If you have already installed a recalled version, existing installations will not be affected."

— `foundry-devops/manage-products.md`

**Recall is forward-only.** It changes what may be installed next and never
touches what is installed — the same shape as our own immutability rules, and
the reason a fleet is auditable at all.

## 5. Folder tracking: the product as a query over the filesystem

A product's contents can be a *standing query* rather than a list:

> "Tracking a source folder allows you to automatically package all resources within a Compass project or folder. Instead of manually selecting and maintaining individual resources, you can designate a folder as the source. DevOps will automatically discover and include the relevant resources it contains every time you release a new version."

— `foundry-devops/folder-tracking.md`

> "Every time you **Create new version** of your published product, the latest changes from the project will be re-synced to reflect resources that have been removed or added to the product."

— `foundry-devops/folder-tracking.md`

with an escape at the resource level, and a name for the escape going stale:

> "Overridden resources are treated as manually added outputs, and continue to persist in new versions. You can remove the override at any time, which will revert the output to track the source folder with defaults."

— `foundry-devops/folder-tracking.md`

> "Strict folder tracking enforces that all resources in a product must exist within the source folder. When enabled, you cannot manually add outputs, and all resources must be discovered from the tracked folder."

— `foundry-devops/folder-tracking.md`

**This is the same tension the ontology's own linter has** — a set defined by a
rule, plus hand-made exceptions, plus a way to find exceptions that no longer
differ from the rule ("stale overrides"). Worth naming because we solved it
once already: `ontology_violations()` blocks, `ontology_warnings()` advises,
and the stale-override cleanup is a warning, not an error.

`foundry-devops/images/folder-structure.png` draws the setting as two panels,
ON and OFF: ON nests items under folder glyphs, OFF lists them flat under the
root. The prose adds the boundary the picture cannot:

> "DevOps packages folders up until the lowest common ancestor, which on installation will be replaced by the installation project."

— `foundry-devops/create-products.md`

## 6. Presets: a preset is a locator, not a value

> "**Presets:** Define a set of allowed values for an input. If a preset is made mandatory, installers must choose from the provided options and custom values are not allowed."

— `foundry-devops/input-presets.md`

The load-bearing sentence is about how a preset survives leaving the
enrollment it was authored in:

> "Specific input types use locators (like API names) to ensure presets and defaults are functional across environments and enrollments. For example, object type presets use their API name, to find the corresponding object type in the target ontology during installation."

— `foundry-devops/input-presets.md`

> "If the target installation environment does not have a resource satisfying the preset (for example, no object type with the required API name or no dataset with the required RID), then the preset will not be available for selection."

— `foundry-devops/input-presets.md`

**An api_name is portable and a RID is not** — the same split `rid-grammar.md`
found from the other side, now with a consequence: a product that names object
types by api_name installs anywhere the api_names match, and one that names
datasets by RID installs only where those RIDs exist. That is the strongest
argument yet for the api_name being the ontology's real identifier.

## 7. Operations, enumerated — the part that touches what we build

`manage-store-permissions` prints an operation vocabulary, and per CLAUDE.md's
enumeration rule this page is the list:

> "To view a local Marketplace store in either DevOps or Marketplace, you need to have the `marketplace:read-local-marketplace` operation, which is normally granted with the `Viewer` role."

— `foundry-devops/manage-store-permissions.md`

> "To install products from either a local or remote store, you must be able to view the store and have the `marketplace:install-from-local-marketplace` operation, which is normally granted with the `Viewer` role."

— `foundry-devops/manage-store-permissions.md`

> "For every resource selected as an input to this installation, you must have the `marketplace:use-resource-as-input` operation, which is also normally granted with the `Viewer` role."

— `foundry-devops/manage-store-permissions.md`

> "Additionally, the locations where you can install, typically the Space and Ontology, require the `marketplace:install-in` operation, which is usually granted with the `Editor` role."

— `foundry-devops/manage-store-permissions.md`

> "To create a local store, you must have the `marketplace:create-local-marketplace` operation in a Project or folder, which is usually granted with the `Editor` role."

— `foundry-devops/manage-store-permissions.md`

> "To create or edit products in a local store, you must have the `marketplace:create-block`, `marketplace:edit-block-set`, and `marketplace:upload-attachment` operations, which will usually be granted to the `Editor` role."

— `foundry-devops/manage-store-permissions.md`

> "To export products from a local store, a user must have the `marketplace:export-block-set` operation, which will usually be granted to the `Owner` role."

— `foundry-devops/manage-store-permissions.md`

> "To import products to a local store, a user must have the `marketplace:import-blockset-with-provenance` operation, which will usually be granted to the `Owner` role."

— `foundry-devops/manage-store-permissions.md`

> "To edit tags on a local store, a user must have the `marketplace:edit-local-marketplace` operation, which will usually be granted to the `Editor` role."

— `foundry-devops/manage-store-permissions.md`

**Eleven `marketplace:` operations, and one from another namespace.** The last
is the one that matters beyond this section, because it is a rule about
*roles* rather than about Marketplace:

> "Enrollments that restrict downloads often customize their [role set](/docs/foundry/platform-security-management/manage-roles/#role-sets) to remove download operations, including `foundry-data-proxy:get-files`, from the default roles and grant them through a dedicated role instead—for example, an `Exporter` role. On such enrollments, the `Owner` role alone does not include the download operation, so an owner who has not also been granted the download-enabling role cannot package a dataset as an output."

— `foundry-devops/manage-store-permissions.md`

> "Decoupling the ability to export raw data from resource ownership upholds the principle of least privilege and supports centralized [download controls](/docs/foundry/security/download-controls/). As a result, the `Owner` role does not necessarily include export or download permissions on enrollments that restrict downloads."

— `foundry-devops/manage-store-permissions.md`

**This is a second, independent witness for the correction the drift backlog
made to `role_rank`.** `security/projects-and-roles` now says roles are
"independent sets of operations rather than a strict hierarchy"; here is the
worked example of an `Owner` who cannot do what a lesser role can. Our
`role_rank()` remains right for the default set we ship and wrong the moment a
customized role set exists — recorded there, confirmed here.

**A store is a Compass resource and inherits its project's permissions**, which
is a shape we already have:

> "A local Marketplace store can be found in either a Project or folder and will inherit the permissions of the Project or folder in which it is situated."

— `foundry-devops/manage-store-permissions.md`

> "New stores are saved to a project and inherit the permissions of that project. Specifically, anyone with edit access to a store's project can create new products and edit existing products in that store, and anyone with view or edit access to the store's project can install products from that store."

— `foundry-devops/create-products.md`

## 8. Scale, and the numbers that are actually stated

> "A product can contain a combined total of 15,000 inputs and outputs, including nested resources such as dataset columns and object type properties."

— `foundry-devops/create-products.md`

> "At 75% of the limit or above, a **Product limits** counter appears in the bottom left and a warning appears in the **Draft status** panel. At 100% of the limit, the warning becomes a blocking error, and you must remove outputs or refactor your product before you can continue."

— `foundry-devops/create-products.md`

**The unit is the expansion, not the count of things added** — "the relevant
number is not the count of resources you added, but the count of inputs and
outputs those resources expand into". A packaged object type costs one plus its
properties. That is the same accounting our own index build does, and the same
reason 70 datasources per object type is a limit worth respecting.

## 9. Export is unencrypted and signed, which is a policy not a feature

> "Marketplace products may contain sensitive data, and the exported file **is not encrypted**. Sensitive data can include datasets, media sets, models, and metadata including names, descriptions, and schemas."

— `foundry-devops/export-import-products.md`

> "Marketplace products are exported as a file, which should only be used for short-lived transport and not for permanent storage. We hold the right to introduce breaking changes to the format of this file, making it unable to be imported. It is the exporter's responsibility to verify that the product is allowed to be exported outside of the platform, and to ensure that it is handled securely afterward. The exported file is code signed; any changes to the file in transit will make the file not importable."

— `foundry-devops/export-import-products.md`

Three properties in one paragraph: **not encrypted**, **not an archive
format**, **signed against tampering**. A clone that ever grows an export must
carry all three or none — signing without the "short-lived transport" framing
would imply a durability the format does not have.

---

## Decisions

**Nothing is built from this reading.** It is a floor plan, and the Decisions
below are about what a build would have to be if one is ever asked for. None
has been acted on.

1. **A product is a set of OUTPUTS with a computed input frontier**, not a
   list of resources. The diagram is explicit — outputs inside the boundary,
   inputs outside it — and the prose derives inputs from the dependency walk.
   Any build starts from the walk, over the edges we already have
   (`dataset_inputs`, `job_specs`, `object_type_datasources`,
   `action_type_rules`, `function_versions.edits`, the Workshop tables), not
   from a new join table listing membership.
2. **Store, product, version, installation are four resources, not one with a
   kind column.** A store lives in a project and inherits its permissions (so
   it is a Compass resource like every other); a product belongs to a store; a
   version belongs to a product and is immutable once published; an
   installation names a product version, a space, an ontology and a mapping
   from inputs to local resources.
3. **A release channel is a floor, not a tag set.** Release ⊇ Pre-Stable ⊇
   Stable, and an installation tracking a channel receives every version at or
   above it. Modelling it as an enum with an ordering is faithful; modelling it
   as a many-to-many label is not.
4. **Deprecate and recall are forward-only and never delete.** "Hard deletion
   of products is not currently supported"; a recalled version leaves existing
   installations alone. Both fit the immutability the migrations already use.
5. **Presets are locators.** An object-type preset stores an api_name and
   resolves at install time; a dataset preset stores a RID and only resolves in
   the enrollment that has it. Any build stores the locator and the kind, never
   a resolved id.
6. **Folder tracking is a standing query plus overrides**, and the third piece
   is the one that is easy to forget: a way to find overrides that no longer
   differ from the query. That belongs in `ontology_warnings()`'s half of the
   ladder — advisory, never blocking a publish.
7. **The eleven `marketplace:` operations are an enumeration to reuse, not to
   invent.** If a store is ever built, its operation names come from
   `manage-store-permissions` verbatim, and the workflow catalogue gains them
   rather than a parallel vocabulary.
8. **`foundry-data-proxy:get-files` is the second witness that roles are sets,
   not ranks** — an `Owner` who cannot package a dataset. It confirms the bound
   the drift backlog put on `role_rank()` and should be cited there if a
   customized role set is ever built.

## Questions

1. **Where does an installation's edit history live?** A product installs
   object types, actions and datasets that our own tables treat as
   user-authored. Whether an installed resource is marked as
   installation-owned — and what happens when a user edits one and an upgrade
   arrives — is not on these pages; `marketplace/installations` and
   `marketplace/upgrades` are the pages to read next, and they are on disk.
2. **What is a "block"?** Three operations name it (`marketplace:create-block`,
   `edit-block-set`, `import-blockset-with-provenance`) and no page in either
   section defines it. It reads as the internal name for a product or a product
   version; the api/ corpus may settle it.
3. **Do linked products form a DAG the platform enforces?** "DevOps guarantees
   that linked products are calculated in the correct dependency order" implies
   a topological sort and therefore a cycle rule, which no page states.
4. **Is a store's Maven coordinate load-bearing outside Apollo?** The four-part
   coordinate is precisely specified, and its only stated consumer is
   "connected Apollo hubs" — a section we do not mirror.
5. **What does an installation do about markings?** Installing needs "access to
   at least one Organization Marking present on the store", but whether the
   installed outputs inherit the store's markings, the destination project's,
   or neither is not stated here.
