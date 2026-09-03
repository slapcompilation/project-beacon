---
verify: strict
---

# Link reading — how Foundry reads a link at read time

**Why this reading exists.** Three gaps sit in our read path and all three are the
same question asked in different places: our join-table links are metadata-only at
read time (`object_set_where` refuses one with `Ontology:LinkFilterBackingUnsupported`),
the Explorer has no authoring UI for a link filter, and the Object View's linked
panel sends the reader to the far type's whole explorer instead of to this object's
linked rows. This reading is what the documentation says about reading links —
the wire shape, the surfaces, and what runs underneath.

**There is no `explore/` section in the mirror.** The task named one; the mirror
has `object-explorer/` and there is no `explore` directory anywhere under
`docs/foundry-reference/mirror/`. Everything that section would have held is under
`object-explorer/`, and I read it there.

**`search around` is 294 occurrences in 100 files.** Reading all of them was not
the task and I did not do it. I read every page where the phrase describes reading
or traversing a link, and I say at the end which sections I left closed.

**Pages read in full.** The API wire shape:
`api/v2-ontologies-v2-resources-linked-objects-list-linked-objects`,
`api/v2-ontologies-v2-resources-linked-objects-get-linked-object`,
`api/v2-ontologies-v2-resources-linked-objects-linked-object-basics`,
`api/v1-ontology-resources-objects-list-linked-objects`,
`api/v1-ontology-resources-objects-get-linked-object`,
`api/v2-ontologies-v2-resources-object-types-list-outgoing-link-types`,
`api/v1-ontology-resources-object-types-list-outgoing-link-types`,
`api/v2-ontologies-v2-resources-object-types-get-outgoing-link-types-by-object-type-rid-batch`.
The object-set shape:
`api/v2-ontologies-v2-resources-ontology-object-sets-create-temporary-object-set`
(the `ObjectSet` union and the `where` union enumerated member by member) and the
headers and responses of
`api/v2-ontologies-v2-resources-ontology-object-sets-load-object-set` and
`api/v2-ontologies-v2-resources-ontology-object-sets-aggregate-object-set`.

The engine: `object-backend/overview`, `ontologies/oss-limitations`,
`ontologies/query-compute-usage`, `object-databases/object-storage-v1`,
`object-backend/osv1-osv2-migration`.

The link's backing: `object-link-types/link-types-overview`,
`object-link-types/create-link-type`, `object-link-types/link-type-metadata`,
`object-link-types/edit-link-types`.

The surfaces: `object-views/standard-object-views`, `object-views/core-object-views`,
`object-views/overview`, `object-views/widgets-properties-links`,
`object-views/widgets-visualization`, `object-explorer/pivot-linked`,
`object-explorer/filter-results`, `object-explorer/search-objects`,
`object-explorer/explore-charts`, `object-explorer/generate-urls`,
`object-explorer/analyze-sql`, `workshop/widgets-links`,
`quiver/objects-import-linked`, `quiver/card-switch-to-linked-object-set`,
`map/integrate-searcharounds`, `vertex/explore-object-relationships`,
`functions/api-objects-links`, `functions/api-object-sets`.

Read for one fact each and **not quoted below**, so nothing here rests on them:
`object-views/widgets-layout` (the Linked Objects condition),
`action-types/use-actions` (the section name), `object-indexing/faq` and
`object-indexing/funnel-streaming-pipelines` (whether a many-to-many link takes a
stream datasource), `object-link-types/metadata-typeclasses` (the `vertex`
link-merge type classes), `ontology/applications`, `map/core-concepts`,
`map/control-panel`, `functions/optimize-performance`,
`object-link-types/derived-properties` — that last already has its own reading and
I did not re-read it whole.

**Courses.** Grepping the extracted lessons for the phrase returns one
line, in `docs/foundry-deep-dives/text/04-workshop/introduction.txt`. Grepping for
a linked object returns three files. I read the traversal section of
`docs/foundry-deep-dives/text/01-ontology/fresh-air-operations.txt` and
`docs/foundry-deep-dives/text/01-ontology/create-a-link-type.txt` in full, and
quote the first.

## Images

**The images I opened, twenty-one of them, and what each is.** I list every one by
name; there is no rounding up here.

From the current-generation Foundry captures:
`object-views/images/linked-objects-component.png`,
`object-views/images/core-object-view-panel.png`,
`object-views/images/standard-full-and-panel-object-view.png`,
`object-explorer/images/OE_search_results_search_around.png`,
`workshop/images/links_example.png`.

From the older Blueprint-blue Object Explorer and Object View generation:
`object-explorer/images/charts_cluster_map.png`,
`object-explorer/images/pivot_flights.png`,
`object-explorer/images/has_link.png`,
`object-explorer/images/linked_to_property.png`,
`object-explorer/images/linked_to_object.png`,
`object-explorer/images/charts_linked_property_charts.png`,
`object-views/images/widgets_hu-links.png`,
`object-views/images/widgets_linked-object-view-without-sidebar.png`,
`object-views/images/widgets_linked-object-view-with-sidebar.png`,
`action-types/images/integrate_actions_object_explorer_object_view_linked_objects_view_section.png`.

Diagrams and other applications: `object-backend/images/osv2-arch.png`,
`object-backend/images/osv1-arch.png`, `ontologies/images/oss-execution-flow.png`,
`map/images/integrate-objects-searcharound-linkmerge-example.png`,
`map/images/oma-capabilities-link-merge.png`,
`vertex/images/explore_objects_4.jpg`.

**Pages whose every image I opened**, so the claim is checkable:
`object-explorer/pivot-linked`, `object-views/standard-object-views`,
`object-views/core-object-views`, `object-backend/overview`,
`ontologies/oss-limitations`. Every one of the API pages above carries no image at
all, as `api/` pages never do.

**Images I skipped, by name, and they are my omission and nobody else's.** From
`object-explorer/filter-results` I did not open `explore_search.png`,
`explore_search_filtered.png`, `explore_keyword_property.png`,
`new_search_term.png`, `nested_search_terms.png` — five of its eight, all about
keyword and property filtering rather than links. From
`object-explorer/search-objects` I did not open
`OE_search_results_general_annotated.png` or
`OE_search_results_sidebar_annotated.png`. From `object-explorer/explore-charts` I
opened two and left twenty-six closed, among them `charts_add_linked_property.png`,
which is the picker that adds a chart on a linked property and which I should have
opened; the rest are chart-type galleries. From
`object-views/widgets-properties-links` I left `widgets_hu-properties.png`,
`widgets_hu-properties-oma.png`, `widgets_property-cards.png`,
`widgets_property-cards-config.png` and `widgets_hu-edits-history.png` closed. From
`object-views/widgets-visualization` I left `widgets_timeline.png` and
`widgets_hu-grouped-events-table.gif` closed. From `object-views/overview` I left
`overview-full-object-view.png` and `overview-panel-object-view.gif` closed. From
`map/integrate-searcharounds` I left `integrate-objects-linkmerge-arc-example.png`
and `oma-capabilities-link-merge-incoming-outgoing.png` closed. From
`vertex/explore-object-relationships` I opened one of fourteen. I opened none of
the nine on `object-link-types/create-link-type`, none of the eight on
`object-link-types/edit-link-types`, none of the three on
`object-databases/object-storage-v1`, none of the ten on
`object-backend/osv1-osv2-migration`, none of the four on
`object-explorer/analyze-sql`, none of the two on `quiver/objects-import-linked`,
none of the four on `object-views/widgets-layout`, four of the five on
`action-types/use-actions`, and five of the six on `workshop/widgets-links`.

**Capture era, before anything is measured.** The mirror carries at least three
generations here and they disagree. `linked-objects-component.png`,
`core-object-view-panel.png`, `standard-full-and-panel-object-view.png`,
`OE_search_results_search_around.png` and `links_example.png` are the
current-generation shell: rounded cards, teal object-type glyphs, indigo accents.
`has_link.png`, `linked_to_property.png`, `linked_to_object.png`,
`charts_cluster_map.png`, `pivot_flights.png`, `charts_linked_property_charts.png`,
`widgets_hu-links.png`, both `widgets_linked-object-view-*` and
`integrate_actions_object_explorer_object_view_linked_objects_view_section.png` are
the older square-tabbed Blueprint-blue generation. `oma-capabilities-link-merge.png`
is the Ontology Manager's older era — its left rail carries an `Overview` row and no
`Resources` block, which is CLAUDE.md's marker for the pre-OMA capture set. **I took
no pixel measurements from any of them**; nothing in this reading needs one, and the
mixed eras are exactly the case where a measurement would be wrong.

---

## 1. The wire shape: two endpoints, and what they return

Foundry publishes exactly two per-object linked-object endpoints, in both API
versions. The list:

> `GET /api/v2/ontologies/{ontology}/objects/{objectType}/{primaryKey}/links/{linkType}`

— `api/v2-ontologies-v2-resources-linked-objects-list-linked-objects.md`

> Lists the linked objects for a specific object and the given link type.

— `api/v2-ontologies-v2-resources-linked-objects-list-linked-objects.md`

And the singular:

> `GET /api/v2/ontologies/{ontology}/objects/{objectType}/{primaryKey}/links/{linkType}/{linkedObjectPrimaryKey}`

— `api/v2-ontologies-v2-resources-linked-objects-get-linked-object.md`

> Get a specific linked object that originates from another object.

— `api/v2-ontologies-v2-resources-linked-objects-get-linked-object.md`

> If there is no link between the two objects, `LinkedObjectNotFound` is thrown.

— `api/v2-ontologies-v2-resources-linked-objects-get-linked-object.md`

**The traversal is addressed by the link's API name, not by the far object type.**
Both endpoints take four path parameters and the fourth is the link:

> The API name of the link that exists between the object and the requested objects. To find the API name for your link type, check the **Ontology Manager**.

— `api/v2-ontologies-v2-resources-linked-objects-list-linked-objects.md`

The whole conceptual page for the resource is one sentence:

> A Linked Object describes a object that is linked to another object.

— `api/v2-ontologies-v2-resources-linked-objects-linked-object-basics.md`

(The typo is Palantir's. `api/v2-ontologies-v2-resources-linked-objects.md` carries
the identical sentence under the identical title — the resource index and its basics
page are the same file.)

### 1.1 What comes back is a page of whole objects, not link rows

`ListLinkedObjectsResponseV2` has two fields: `data`, a list of `OntologyObjectV2`,
and `nextPageToken`. `OntologyObjectV2` is a bare map of property API name to
property value — the far object, with its properties, and no link-side fields
whatsoever. There is no edge object on the wire. In v1 the element is
`OntologyObject`, which wraps the same map in a `properties` field and adds a
required `rid`.

Paging is by token, and the page size is advisory:

> Each page may be smaller or larger than the requested page size. However, it is guaranteed that if there are more results available, at least one result will be present in the response.

— `api/v2-ontologies-v2-resources-linked-objects-list-linked-objects.md`

And the read is explicitly not a snapshot by default:

> Note that this endpoint does not guarantee consistency. Changes to the data could result in missing or repeated objects in the response pages.

— `api/v2-ontologies-v2-resources-linked-objects-list-linked-objects.md`

v2 adds a `snapshot` query parameter to opt into consistency, plus `select`,
`orderBy`, `excludeRid`, `branch`, `sdkPackageRid` and `sdkVersion`. v1 has
`properties` where v2 has `select`, has `orderBy`, and has none of the rest — but v1
has one thing v2 does not:

> This endpoint supports filtering objects.

— `api/v1-ontology-resources-objects-list-linked-objects.md`

That line is absent from the v2 page. Both versions state the same storage-backed
ceiling:

> For Object Storage V1 backed objects, this endpoint returns a maximum of 10,000 objects. After 10,000 objects have been returned and if more objects are available, attempting to load another page will result in an `ObjectsExceededLimit` error being returned. There is no limit on Object Storage V2 backed objects.

— `api/v2-ontologies-v2-resources-linked-objects-list-linked-objects.md`

**No count.** `ListLinkedObjectsResponseV2` has no `totalCount`. `LoadObjectSetResponseV2`
does — it carries a required `totalCount` and a `computeUsage` — so the count
badges the surfaces show (see §4) cannot be coming from the per-object list
endpoint. That is inference from the two response shapes; no page says where a
badge's number comes from.

### 1.2 What the metadata endpoint publishes about a link, and what it withholds

`GET /api/v2/ontologies/{ontology}/objectTypes/{objectType}/outgoingLinkTypes`
returns a page of `LinkTypeSideV2`. Seven fields: `apiName`, `displayName`,
`status`, `objectTypeApiName`, `cardinality` (one of `ONE`, `MANY`),
`foreignKeyPropertyApiName`, `linkTypeRid`. The v1 `LinkTypeSide` is the same
without `linkTypeRid`. `api-link-type.md` in this directory already reads this shape
in detail and I did not repeat it here.

What matters for a *reader* is the object's own doc comment:

> `foreignKeyPropertyApiName` is the API name of the foreign key on this object type. If absent, the link is either a m2m link or the linked object has the foreign key and this object type has the primary key.

— `api/v2-ontologies-v2-resources-object-types-list-outgoing-link-types.md`

That sentence is load-bearing for our arc. **The public API does not tell a client
how a link is backed.** An absent `foreignKeyPropertyApiName` collapses two
different backings — many-to-many, and foreign-key-on-the-other-side — into one
indistinguishable state. A client cannot branch on backing, which means the read
behaviour cannot be allowed to differ by backing: the traversal is addressed the
same way and returns the same shape either way. The batch variant carries the
identical sentence, so it is not a one-page slip:

> Gets outgoing link types for a batch of object types, identified by their RIDs.

— `api/v2-ontologies-v2-resources-object-types-get-outgoing-link-types-by-object-type-rid-batch.md`

## 2. `searchAround` is an ObjectSet constructor, and there is no link predicate in `where`

The `ObjectSet` union in `CreateTemporaryObjectSetRequestV2` has fifteen members. I
enumerated them from the page rather than trusting a summary: `searchAround`,
`static`, `intersect`, `withProperties`, `interfaceLinkSearchAround`, `subtract`,
`nearestNeighbors`, `union`, `asType`, `methodInput`, `reference`, `filter`,
`interfaceBase`, `asBaseObjectTypes`, `base`.

`searchAround` has exactly two fields — a nested `objectSet` and a `link`:

> The name of the link type in the API. To find the API name for your Link Type, check the **Ontology Manager** application.

— `api/v2-ontologies-v2-resources-ontology-object-sets-create-temporary-object-set.md`

Its interface sibling takes an `interfaceLink` instead:

> The name of the interface link type in the API. To find the API name for your Interface Link Type, check the Ontology Manager.

— `api/v2-ontologies-v2-resources-ontology-object-sets-create-temporary-object-set.md`

**The `where` union on `filter` has twenty-six members and not one of them mentions
a link.** In alphabetical order as I extracted them: `and`, `contains`,
`containsAllTerms`, `containsAllTermsInOrder`,
`containsAllTermsInOrderPrefixLastTerm`, `containsAnyTerm`,
`doesNotIntersectBoundingBox`, `doesNotIntersectPolygon`, `eq`, `gt`, `gte`, `in`,
`intersectsBoundingBox`, `intersectsPolygon`, `interval`, `isNull`, `lt`, `lte`,
`not`, `or`, `regex`, `relativeDateRange`, `startsWith`, `wildcard`,
`withinBoundingBox`, `withinDistanceOf`, `withinPolygon`. All twenty-six address a
property, via `field` or `propertyIdentifier`.

So in the public API a link is not something you filter *by*; it is something you
*follow*, producing a new set. Filtering by a link is composed:
`intersect(base, searchAround(otherSet, link))` and its negation with `subtract`.
That is a structural finding and it bears directly on our
`Ontology:LinkFilterBackingUnsupported` — see §7.

The same `ObjectSet` union is the request body of `loadObjects` and of `aggregate`,
so the same `searchAround` node can be loaded as a page of objects or reduced to a
count without loading anything. `aggregate` and `loadObjects` both accept
`executeInMemoryOnly`:

> If true, the request fails with an error when it cannot be computed in-memory. Use this to opt into fast failure on requests that would otherwise require heavier computation. Defaults to false.

— `api/v2-ontologies-v2-resources-ontology-object-sets-load-object-set.md`

One more thing the `withProperties` member says about traversal, in the doc comment
on the `get` selection operation:

> Gets a single value of a property. Throws if the target object set is on the MANY side of the link and could explode the cardinality. Use collectList or collectSet which will return a list of values in that case.

— `api/v2-ontologies-v2-resources-ontology-object-sets-create-temporary-object-set.md`

## 3. What actually runs: an index, a service, and a semi-join

The read path never touches a dataset. `object-backend/overview` names the service
that serves reads:

> The Object Set Service (OSS) is the service responsible for serving reads from the Ontology; OSS allows other Foundry services and applications to query objects data from the Ontology, enabling searching, filtering, aggregating, and loading of objects.

— `object-backend/overview.md`

and the service that fills the store it reads:

> Funnel reads data from Foundry datasources (such as datasets, restricted views, and streaming datasources) and user edits (from Actions) and indexes these data into object databases.

— `object-backend/overview.md`

**`osv2-arch.png` is the strongest single piece of evidence in this reading, and it
is a picture, not a sentence.** Two dashed regions, `Dataset Layer` and
`Object Layer`, with an `Ontology Metadata Service` band across the top of both.
Inside the dataset layer: a green `Person Object type` glyph joined to a stack of
`Datasets` by a pill reading `Map entity to data`, and the datasets feeding a funnel
glyph labelled `Object Data Funnel`. One arrow leaves the funnel, labelled
`Indexing`, and crosses into the object layer. Inside the object layer: a dashed
teal box `Object Databases` holding three database-cylinder stacks labelled `OSv2`,
`OQL` and an ellipsis; that box has a double-headed arrow to `Object Set Service`,
which has a double-headed arrow to a pill reading `Object searches, loads,
aggregations` and thence to a user glyph. Below, `Object Set Service` connects down
to `Functions on Objects`, which connects to `Actions`, fed by a pill `Execute
actions` from a user; `Functions on Objects` also reaches a pill `Execute
functions`. A long line runs from `Actions` along the bottom, labelled `User edits`,
back into the `Object Data Funnel`.

> Object searches, loads, aggregations
> — object-backend/images/osv2-arch.png

**What it adds that the prose does not: there is no arrow at all from `Datasets` to
`Object Set Service`.** Every read edge in the diagram terminates at an object
database. A dataset reaches a reader only by being indexed first. The prose says
Funnel indexes and says OSS serves reads; only the diagram shows that these are the
*only* two paths and that they are in series.

`osv1-arch.png` is the same figure for the legacy backend and differs in three ways
worth recording: there is no Funnel, the `Indexing` arrow runs straight from
`Datasets` into a single cylinder stack labelled `Object Database` inside a dashed
box `OSv1 (Phonograph)`, and there is an extra user path that bypasses OSS entirely,
a pill reading `Object edits, searches, loads, aggregations` wired directly to the
object database.

> Object edits, searches, loads, aggregations
> — object-backend/images/osv1-arch.png

That bypass is the thing the migration page later calls incompatible usage.

### 3.1 The join OSS performs

`ontologies/oss-limitations` names the operation exactly:

> OSS implements Search Around operations using a left-semi join, which returns only the objects from the result set that have matching links, without duplicating data from the starting set.

— `ontologies/oss-limitations.md`

A left-semi join is set-valued and deduplicating: N starting objects that all link
to the same far object yield that far object once. This is the single most
important read-time semantic in this reading, and it is stated in exactly one page.

The execution strategy is tiered:

> Pushdown to storage layer: For simple queries, OSS pushes operations directly to the storage layer to take advantage of indexed data structures. This is the fastest execution path and requires minimal compute overhead.

— `ontologies/oss-limitations.md`

> Certain advanced features (derived properties, intermediary link types, interface Search Arounds) require Spark execution regardless of size

— `ontologies/oss-limitations.md`

`oss-execution-flow.png` draws the decision. A rounded start node `Query Received`
flows into a diamond `Simple filter or aggregation?`. The `Yes` edge drops to a
green box `Pushdown to storage layer / OSv2` with two ticks, `Fastest execution` and
`Lowest compute cost`. The `No` edge goes to a rectangle `Evaluate object set size
for each data loading operation`, then to a second diamond `Object set size` whose
two edges are labelled `≤ 100k objects` and `> 100k objects`. The first goes to a
yellow box `In-memory execution / OSS` with ticks `Fast performance` and `Moderate
compute cost`; the second to a red box `Spark-based execution / Distributed compute`
with a tick `Handles large scale` and two warning marks, `Higher latency` and
`Higher compute cost`. All three converge on a rounded terminal reading
`Result returned`, which itself carries a limits block.

> Result returned
> Limits:
> • Max 10M objects for Search Arounds
> • Max 100k for .all/.allAsync
> — ontologies/images/oss-execution-flow.png

What the diagram adds: the size test is applied **per data loading operation**, not
once per request, and the pushdown branch is taken only for a simple filter or
aggregation — a search-around never reaches it. Neither point is in the bullet list
above the image.

Compute is priced by query type, and a search-around costs more than a base read:
2 compute-seconds for a base query against 5 for a search-around, per the table in
`ontologies/query-compute-usage`. That page also gives the only prose definition of
the operation as a *filter*:

> Search Around query: Takes an incoming object set and runs a secondary filter on another object set based on a certain property of the incoming set.

— `ontologies/query-compute-usage.md`

I flag that as a wording tension with the semi-join sentence rather than a
contradiction: both describe a set-valued operation, but the compute page's phrasing
would let a reader think of it as a predicate on the starting set. `oss-limitations`
is the page that describes the mechanism, and it wins.

## 4. Where the join dataset sits at read time: indexed, not queried live

`link-types-overview` states the backing rule:

> Links are created and displayed in user applications by adding backing datasources to the object types referred to in the link type in the Ontology Manager. In the case of link types where object types are related with a many-to-many cardinality, datasources back the link types themselves.

— `object-link-types/link-types-overview.md`

`link-type-metadata` says what is in that datasource:

> In a many-to-many cardinality link type, a table containing pairs of primary keys defines the links between two objects. These link types require a join table to be specified, along with mapping these keys that tell applications which columns in the join table refer to the primary keys of which object types in the link type.

— `object-link-types/link-type-metadata.md`

And `create-link-type` names the three relationship types the wizard offers —
`Object type foreign keys` for one-to-one and many-to-one, `Join table dataset` for
many-to-many, `Backing object type` for object-backed links — and says of the middle
one:

> In a many-to-many cardinality, select a datasource that includes all combinations of links between the primary key of the first object type (`Aircraft` in our example) and the second object type (`Flight` in our example).

— `object-link-types/create-link-type.md`

**Nothing in `object-link-types/` says a join dataset is read at traversal time.
Four other pages say it is indexed first.**

The legacy backend is explicit that a link type's datasource goes through the same
registration and reindex a datasource for an object type does:

> When a backing datasource is initially added to an object type or link type, the datasource must be registered in Phonograph. Data must be registered in Phonograph before it can be queried by or displayed in user applications.

— `object-databases/object-storage-v1.md`

> When updates are made to data in the backing datasource or when schema changes are made to the definition of an object type or link type, a sync will begin that reindexes the updated data into Phonograph. Once this sync, often referred to as a reindex, is complete, the updated data and schema will appear in user applications.

— `object-databases/object-storage-v1.md`

`edit-link-types` says what happens to readers while that reindex runs:

> Changes that require Object Storage v1 (Phonograph) to unregister and reregister the backing datasource of a link type will make the links of that type **unavailable** in user applications during that reindex time; these changes are described below.

— `object-link-types/edit-link-types.md`

> For example, if a link type is used in a search around in a Workshop application, that Workshop application will be broken until the reindex completes.

— `object-link-types/edit-link-types.md`

A search-around breaking while a *dataset* is being reindexed is only possible if
the traversal reads the index rather than the dataset. That sentence settles the
question on its own.

The current backend keeps the arrangement. The migration is defined over object
types and join-table link types together:

> The architecture changes necessary for the [improvements](/docs/foundry/object-backend/overview/) in Object Storage v2 (OSv2) require a migration of object types and many-to-many link types with join tables in Object Storage v1 (Phonograph) to Object Storage v2 (OSv2).

— `object-backend/osv1-osv2-migration.md`

> To start the migration, navigate to the **Datasources** tab of your object type or many-to-many link type with a join table, and go to the **Indexing Metadata** section.

— `object-backend/osv1-osv2-migration.md`

A join table therefore has an `Indexing Metadata` section, a Funnel pipeline and a
sync status, exactly as an object type does.

**The one place a join dataset is read directly is a separate, non-object read
path.** Object Explorer's SQL scratchpad:

> To query a many-to-many link type, you can use the link type…

— `object-explorer/analyze-sql.md`

> Analyze using SQL works by querying the backing datasource or the materialization of an Ontology entity.

— `object-explorer/analyze-sql.md`

and it is fenced off from the object read path by three constraints on the same
page: queries cannot mix tabular sources and Ontology inputs, each query returns a
maximum sample of 1,000 rows, and it uses Contour's compute backend. It is analysis,
not traversal.

## 5. The per-object surface: what the Linked objects component shows

`standard-object-views` and `core-object-views` are byte-identical after their
source comment — the same page mirrored under two slugs. Either says:

> The **Linked objects** component enables you to traverse across [linked objects](/docs/foundry/object-link-types/link-types-overview/) directly within the standard Object View.

— `object-views/standard-object-views.md`

and lists four capabilities:

> View linked objects grouped by link type.

— `object-views/standard-object-views.md`

> Preview properties of linked objects inline without leaving the current view.

— `object-views/standard-object-views.md`

> Open a subset of linked objects in a new tab for further exploration.

— `object-views/standard-object-views.md`

> Preview a selected linked object in the side panel of the standard Object View.

— `object-views/standard-object-views.md`

That is the whole prose. The screenshot carries far more.

The section overview states that links are part of what an Object View is for:

> They provide a central hub for all information related to an object and include key information about the object, including property data, object links, and related applications.

— `object-views/overview.md`

### 5.1 `linked-objects-component.png`, field by field

A card headed by a double-headed-arrow glyph and the words `Linked objects`, with
two view-mode toggle buttons at the far right — a rows icon, selected and blue, and
a grid icon. Under the header a context row: a back arrow, an object-type glyph, the
words `Arriving Route`, a count pill `1,227`, and an up/down sort control.

The left column lists four link entries, each with a link glyph, an object-type
glyph, a name and a count badge:

> Departure Airport 177
> Destination Airport 133
> Flight 1,612,101
> Route Alert 14
> — object-views/images/linked-objects-component.png

`Departure Airport` is selected — blue text on a pale blue row. Two glyph shapes
appear in that column: `Departure Airport` and `Destination Airport` carry one shape,
`Flight` and `Route Alert` carry another. I read that as a cardinality distinction;
no caption says so, so it is inference.

The right pane is a search box reading `Search…`, a control at the top right reading
`Open 177 in` with a dropdown caret, and a table of the far objects with the far
type's properties as columns: `Title`, `Geopoint`, `Airport`, and a fourth clipped
at `Airport Id`. Nine rows are visible, each a blue link title with two leading
glyphs:

> Lehigh Valley International "40.6525,-75.4402778" ABE 10135
> — object-views/images/linked-objects-component.png

> Hartsfield-Jackson Atlanta International "33.6366667,-84.4277778" ATL 10397
> — object-views/images/linked-objects-component.png

And along the bottom, a breadcrumb of the traversal so far, each hop with its own
count and the last one bold:

> Delta Air Lines Inc. › Flights 480,644 › Arrival Airport 133 › Arriving Route 1,227
> — object-views/images/linked-objects-component.png

**What this adds that the prose does not, and it is most of the answer to our third
gap:**

1. The panel shows **this object's linked rows**, in a table, with the far type's
   properties as columns. It is not a link to the far type's explorer.
2. Every link entry carries a **count**. The panel therefore issues one count per
   link before anything is loaded.
3. Traversal is **multi-hop and stateful**. The breadcrumb records each hop and its
   count; the back arrow returns one hop. The prose says nothing about either.
4. The counts confirm §3.1's semi-join arithmetic on real numbers: 480,644 flights
   collapse to 133 arrival airports, which expand to 1,227 arriving routes, from
   which `Departure Airport` yields 177. A per-row expansion could not produce 133
   from 480,644. **The unit of traversal is a deduplicated set.**
5. The same far object type appears twice in the left list under two different names
   — `Departure Airport` and `Destination Airport` are both Airport. Grouping is by
   link side, not by far type. This is the two-separately-named-ends fact, visible
   only in the image.
6. `Open 177 in` hands the current linked set to another application, and its number
   tracks the selected link, not the panel.

### 5.2 The panel form factor, `core-object-view-panel.png`

A narrow column. Header: an object glyph, `Spirit Air Lines`, subtitle
`[Example] Carrier`, and at the right a cube glyph with `Core` and a caret — the
view selector. Below, a card headed by the same double-arrow glyph and
`Linked objects`. Under it a row naming the current object, `Spirit Air Lines`.
Under that an expandable row: link glyph, object glyph, `Aircraft` in blue, a count
pill `216`, an expanded chevron. Inside the expansion: `Search…`, `Open 216 in`
with a caret, and a list of titles.

> N507NK | Airbus A-319-PSGR
> — object-views/images/core-object-view-panel.png

> N935NK | Airbus A-320-PSGR
> — object-views/images/core-object-view-panel.png

What it adds: in the panel the component is an accordion **rooted at the current
object**, and the count is per (object, link). The full and panel forms differ in
layout and not in what they resolve.

`standard-full-and-panel-object-view.png` shows both side by side for a
`Yellowstone National Park` object and fixes the ordering in the panel: a
`Prominent` card with media, map and time-series tabs, then a two-cell statistic row
(`1872-…` labelled `Anniversary`, `WY` labelled `State`), then a `Properties` card
(`Latitude 44.6`, `Name Yellowstone National Park`, `Longitude -110.5`), then the
`Linked objects` card. Both panes carry a red-outlined callout reading
`Switch to configured view`.

> Switch to configured view
> — object-views/images/standard-full-and-panel-object-view.png

## 6. The configured widgets, and the one that is not the standard component

`widgets-visualization` describes the Linked Object View widget:

> This widget is mainly used to display a *table* view of all Linked Objects of a certain type along with their relevant properties. The table also supports selection of subset of linked objects to open in other Foundry apps or perform configured Object Actions.

— `object-views/widgets-visualization.md`

Its data configuration reaches past one hop:

> Choose either an object type either via a direct link or through a transitive link using an intermediate object type.

— `object-views/widgets-visualization.md`

`widgets_linked-object-view-without-sidebar.png` shows it: a header with a table
glyph and the words `Linked Objects View`, a right-aligned `4.30k results`, a filter
button (pressed), a list/detail button and an overflow button. The table has a
select-all checkbox in the indeterminate state and eight visible columns —
`TITLE`, `ARRIVAL CITY`, `DEPARTURE CITY`, `SCHEDULED ARRIVAL TIME`,
`SCHEDULED DEPARTURE TIME`, `AIRCRAFT REGISTRATION`, `TYPE`, and a clipped
`ARRIVAL A…` — each with a drag handle. Thirteen rows, three of them checked.

> 4.30k results
> — object-views/images/widgets_linked-object-view-without-sidebar.png

`widgets_linked-object-view-with-sidebar.png` is the same widget with the advanced
filter sidebar open: `44 results`, a `Keyword` box reading `Type and hit Enter…`, a
blue `+ Add filter` button, and three collapsed or expanded filter rows.

> Departure City is Chengdu OR Guangzhou OR London OR Singapore
> — object-views/images/widgets_linked-object-view-with-sidebar.png

The expanded third row is `Scheduled Arrival Time`, a histogram over 2012–2017 with
a selected band, a `Relative` toggle in the off position, a `Range` selector and two
date inputs `2013-07-04` and `2016-10-24`. **What this adds: the linked set is
itself filterable on the far type's properties, inside the card, and the result
count is recomputed** — 4.30k in one capture, 44 in the other. The prose mentions
basic and advanced search but shows neither shape.

The Links widget is a different thing — a tree rather than a table:

> The **Links** widget displays an object's links in a tree view, with the ability to traverse through Links and navigate to Linked Objects.

— `object-views/widgets-properties-links.md`

and it is deliberately unfiltered:

> This widget is currently not affected by filters. Links displayed are always *all* Objects linked to the current Object.

— `object-views/widgets-properties-links.md`

`widgets_hu-links.png` shows the tree, and it carries a fact no sentence on the page
does: **the tree's group headers are the link type's kebab-case ID, not a display
name.** A chain glyph and the word `Links` head the card. The first group header
reads `flight-origin-airport-links:` and under it a collapsible row
`24,218 Flights` with an overflow menu at the far right. Expanding one flight
reveals three further group headers with their own objects.

> flight-origin-airport-links:
> — object-views/images/widgets_hu-links.png

> flights-aircraft:
> — object-views/images/widgets_hu-links.png

> flight-destination-airport-link:
> — object-views/images/widgets_hu-links.png

> flight-to-pfrs:
> — object-views/images/widgets_hu-links.png

At the bottom of the group a grey bar reads `...and 24,213 more objects` — five
titles rendered out of 24,218.

> ...and 24,213 more objects
> — object-views/images/widgets_hu-links.png

`integrate_actions_object_explorer_object_view_linked_objects_view_section.png`
shows the older Object View shell around the same widget and adds three things. The
Object View's tab strip reads `Overview`, `Properties`, `flight-to-pfrs` with a
count badge `5`, `Testing conditional container - PFR analysis`, `New Tab` — so a
configured tab can be named for a link ID and carry that link's count. The widget
header reads `flight-to-pfrs` with `5 results`, a search box `Type and hit Enter…`,
a card/list toggle, an overflow button and a filter button. And the overflow menu,
opened over one selected row, is headed by the selection and lists action types
first:

> For 1 PFR selected:
> — action-types/images/integrate_actions_object_explorer_object_view_linked_objects_view_section.png

> Update aircraft registration
> Re-register one or more PRFs
> — action-types/images/integrate_actions_object_explorer_object_view_linked_objects_view_section.png

then `Open in`, `Open in Quiver`, `Open in Contour`, `View backing dataset`,
`Explore data lineage`, `Add to list`, `Add to favorites`, `Export as Excel`,
`Copy object IDs`, `Report issue`. The table's `TYPE` column renders `fault` in a
red pill and `warning` in an amber pill — conditional formatting on a linked
object's property.

Workshop's Links widget is the same idea in another application, and
`links_example.png` adds the paging line the Object View tree omits:

> Viewing 10 of 23,814  Show more
> — workshop/images/links_example.png

with per-link count badges at every level: `Departure Airport 1` at the root,
`Flight 23,814`, `Aircraft 132`, `Airport Gate 78`, `Flight Alert 4` under the one
expanded airport, and a second root group `Flight 1`.

> Aircraft 132
> — workshop/images/links_example.png

**One constraint on showing a linked object's properties as if they were the
current object's**, from the Properties widget:

> Displaying properties of a Linked Object is possible only if the Current Object is linked to only one object, which is possible either (1) in a one-to-one relationship; (2) in a many-to-one relationship…

— `object-views/widgets-properties-links.md`

and the complement, from Property Cards:

> When displaying a linked object, the card can show aggregations of any object linked to the current object in a one-to-many or many-to-many relation.

— `object-views/widgets-properties-links.md`

So: a MANY side is aggregated, a ONE side is inlined. That is the same rule the API
states with `get` throwing on the MANY side (§2), arrived at from the UI end.

## 7. Object Explorer: the link filter that exists, and the pivot

### 7.1 There is a link filter, and it has three forms

> In the same way that filters can be applied directly on current object properties, one can filter objects based on their relations. To choose a relation for filtering, select in the left panel of the search menu.

— `object-explorer/filter-results.md`

> To search for objects that have a particular link, select the "Has Link" option, highlighted below as "Has Flight Delay Event". This filter can be used to show either objects that have the associated link, or objects that do not have the associated link.

— `object-explorer/filter-results.md`

> To search for objects whose linked objects have a specific property, select the relation in the left side of the search menu panel. From there, choose a property type to filter.

— `object-explorer/filter-results.md`

> It is also possible to search for objects that have links to other specific objects. For example, after selecting a link choose the option "Filter by Airline". This opens a filter for links to specific objects. Linked objects are displayed by their title in the resulting listogram.

— `object-explorer/filter-results.md`

`has_link.png` shows the menu that authors all three and it is the single most
useful image for our second gap. A search box across the top reading
`Search properties to add a chart or filter…`. A left panel whose first row is the
main object type, `[Example Data] Flight`, then a section header
`LINKED OBJECT TYPES`, then a scrolling list of relations: `Airline`,
`Flight Delay Event` (selected, blue, with a right chevron),
`Time Series Flight Sensor`, `Aircraft`, `[Example Data] Delay`,
`[Example Data] Flight Alert`. A right panel for the selected relation whose first
two rows are the two link-shaped filters, then a `PROPERTIES` header, then the far
type's properties:

> LINKED OBJECT TYPES
> — object-explorer/images/has_link.png

> Has Flight Delay Event?
> Filter by Flight Delay Event?
> PROPERTIES
> Arr Delay
> Arr Delay Group Description
> — object-explorer/images/has_link.png

`linked_to_object.png` is the same menu with `Airline` selected and the same two
rows above the properties:

> Has Airline?
> Filter by Airline?
> — object-explorer/images/linked_to_object.png

and `linked_to_property.png` is the same menu scrolled to Aircraft's properties,
with `Manufacture Year` highlighted:

> Capacity In Pounds
> Carrier Code
> Display Name
> Manufacture Year
> — object-explorer/images/linked_to_property.png

**What the three images add: one menu, keyed by relation, offering exactly three
kinds of filter per relation** — a presence filter (`Has X?`), a
filter-by-specific-objects (`Filter by X?`), and a filter on any property of the far
type. The prose describes all three but never shows that they are one control, nor
that the left list is headed `LINKED OBJECT TYPES` while the prose calls its entries
relations.

### 7.2 The wire form of the link filter

`generate-urls` prints the serialised filter set, and a link filter is a peer of a
property filter:

```json
{
  "type": "linkFilter",
  "objectType": "google-reviews",
  "linkType": "restaurant-to-review",
  "value": {
      "type": "presenceFilter",
      "matchType": "MUST_HAVE"
  }
}
```

with a hard cardinality rule stated as a callout:

> You can have many *PROPERTY* filters, but only 1 *LINK* filter.

— `object-explorer/generate-urls.md`

Note the `linkType` value there is a kebab-case ID — the same form the Links
widget's tree headers use — and not the camelCase API name the public API's
`searchAround.link` takes. Object Explorer's URL grammar and the public API's object
set grammar are two different vocabularies for the same traversal.

### 7.3 Charts on a linked property, and the pivot

> To filter on properties of linked objects, select a linked object type from the left hand side of the search menu.

— `object-explorer/explore-charts.md`

> In the exploration view, the chart header will indicate that it is filtering on the properties of a linked object.

— `object-explorer/explore-charts.md`

`charts_linked_property_charts.png` shows what that indication is, and the prose
does not describe it: a chart on a linked property is titled with a **two-part
path**, the far type's glyph and name, a chevron, and the property. Four cards are
visible — `Actual Elapsed Time` (grouped by `Operating Carrier`, a statistics table
with `SUM`, `AVERAGE`, `MIN`, `MAX` and one row `DL 903,105 120.30 37 641`),
`Origin City Name` (a listogram with a filter banner and one row
`Atlanta, GA 7,537`), and the two linked ones:

> Aircraft › Acquisition Date
> — object-explorer/images/charts_linked_property_charts.png

> Airline › Total Miles
> — object-explorer/images/charts_linked_property_charts.png

The pivot is the other direction — changing which type the exploration is about:

> While performing an exploration, it is possible to shift the main object type of your exploration to any linked object type.

— `object-explorer/pivot-linked.md`

> From here, we now want to **pivot** to the associated **Departing Flights**. We can do so by clicking on this option in the “Linked Objects” section in the bottom-right.

— `object-explorer/pivot-linked.md`

> It is possible to pivot through multiple links, thus allowing you to flexibly explore across the ontology.

— `object-explorer/pivot-linked.md`

`charts_cluster_map.png` shows the affordance the prose points at. It is an
exploration of `[FRP] Airport`, `353 Results`, tabs `Explore` and `Results`, a
`Custom layout` selector, `Open in` and `Export` menus, `Share` and `Save`, and an
`Explorations` and `Lists` pair at the top right. A cluster map is the main chart, a
`Results 353` preview column with a `Sort by` control and a `View all results`
link runs down the right, and at the bottom right of that column sits a small card:

> Linked objects
> Departing Flight
> Arriving Flight
> — object-explorer/images/charts_cluster_map.png

Two entries, one far type, two link names. `pivot_flights.png` is the state after
clicking one, and it carries the fact I care about most for our first gap: **the
previous exploration's filters survive the pivot as link-scoped filter chips.** The
exploration is now `[FRP] Flight`, `2,071,560 Results`, and the search bar holds two
chips, each prefixed by a chain glyph and the link name:

> Origin Airport › Airport Location is bounded by any of 41 geographic areas
> — object-explorer/images/pivot_flights.png

> Origin Airport › Number Of Carriers is between 9 and 17
> — object-explorer/images/pivot_flights.png

So a filter on a far type's property, addressed through a named link, is a
first-class chip in the search bar — the exact authoring surface our Explorer does
not have. No sentence on either page says the chips look like this.

### 7.4 Search-around from a single search result

> For matches on individual objects (**2** in the image above), hovering over the result gives you options for starting an exploration of objects across a particular link to that individual result.

— `object-explorer/search-objects.md`

`OE_search_results_search_around.png` shows it, in the current-generation shell. A
section header with a pin glyph, `[EXAMPLE DATA] AIRPORT` and a badge `1`, a
right-aligned `Explore 1 [Example Data] Airport` link, a description line, one
result card, and `View all objects` below. The card's title and property chips:

> [SFO] San Francisco International + San Francisco, CA
> Airport: SFO • Runways (Derived): SFO-1 • Runways (Derived): SFO-2
> — object-explorer/images/OE_search_results_search_around.png

Two hover buttons sit at the card's right, a chain and a star; the chain is pressed
and has opened a popover with a filter box and six entries, each with its own glyph:

> Select a type below or type to filter
> Flight Model Features
> [Example Data] Runways
> Arriving Flights
> [Example Data] Departing Routes
> [Example Data] Arriving Routes
> Departing Flights
> — object-explorer/images/OE_search_results_search_around.png

`Arriving Flights` and `Departing Flights` are two entries for one far type, so the
list is keyed by link side — inference from the pair, as no caption says so. The
`Runways (Derived)` chips are a second, incidental finding: a derived property is
rendered in a search result's chip row.

## 8. The same operation in the other applications

**Quiver** gives the cleanest statement of the unit:

> Also referred to as “performing a search around”, this operation uses links between objects defined in the Ontology to bring additional objects to the analysis.

— `quiver/card-switch-to-linked-object-set.md`

> If you begin with a set of objects of type `A` and create a linked object set of type `B`, you will return all objects of the correct type (type `B`) that have a relation defined between them and the selected objects of type `A`. These object sets do not have to be the same size, and the linked object set may be smaller or larger than the starting object set.

— `quiver/card-switch-to-linked-object-set.md`

The card's declared input type is an object set and its declared output type is an
object set. And Quiver draws the distinction our Object View panel needs, between
switching and joining:

> If you would like to perform a join to linked objects rather than a switch to linked objects, you can use the Join to linked objects transform in the transform table…

— `quiver/objects-import-linked.md`

> The result is a single row that contains properties from both the original tea tasting as well as the linked tea batch.

— `quiver/objects-import-linked.md`

with a scale ceiling attached to the join and not the switch:

> This card is only available if the input object set is less than 50k objects.

— `quiver/objects-import-linked.md`

**Functions** generates two different shapes depending on whether you start from an
instance or a set:

> When accessing the `1` side of a link, the generated field is of the `SingleLink` type.

— `functions/api-objects-links.md`

> When accessing the `many` side of a link, the generated field is of the `MultiLink` type. You can access an Array of linked objects using the `all()` or `allAsync()` methods. If there are no linked objects, these methods will return an empty Array.

— `functions/api-objects-links.md`

> You can traverse links as an `ObjectSet` to avoid loading linked object instances in the memory. When links are created in the Ontology, APIs will be generated on an object set of this type to "search around" to other linked object sets.

— `functions/api-objects-links.md`

> If you operate on a single instance of an object and search around from there, you will get a `MultiLink<objectType>`. You cannot convert this `MultiLink` to an `ObjectSet`; you must convert the object instance to an object set to pivot to other object sets.

— `functions/api-objects-links.md`

and the depth is capped:

> Note that for performance reasons, the number of Search Around operations you can conduct in a single search is currently limited to 3. If you attempt to run a search with more than three levels of Search Around depth, the search will fail at runtime.

— `functions/api-object-sets.md`

**Map and Vertex** add the intermediary-object concept. An object type can be
configured to be skipped:

> This means that the object type itself will never appear in the Search Around list, but its transitive links will.

— `map/integrate-searcharounds.md`

`oma-capabilities-link-merge.png` shows the Ontology Manager configuration, in the
older OMA capture era. A left rail with `Back home`, the object type `Delivery` and
`48,220 objects` beneath it, an overflow control, and nav rows `Overview`,
`Properties (14)`, `Security`, `Datasources`, `Capabilities` (selected). Top bar: a
cube glyph, an `Ontology` dropdown, tabs `Archetypes` and `Ontology`, and a search
box reading `Search…` with `Ctrl + K`. The right pane is a `Base Types` section with
three rows, `Time Series` and `Event` unchecked and `Geospatial` expanded, and the
Search Around configuration sits inside the Geospatial expansion:

> Search Around – configure specific Search Around behavior for the Vertex and Map applications
> — map/images/oma-capabilities-link-merge.png

> Link merge always
> Treat this Object Type as a Relation — skip over it when link-traversing
> — map/images/oma-capabilities-link-merge.png

with a two-segment `Off | On` toggle set to On, and two list fields each with an
`+ Add new entry` button:

> Incoming links to merge
> Relations ending at this Object Type, to be skipped over when link-traversing.
> — map/images/oma-capabilities-link-merge.png

> Outgoing links to merge
> Relations starting at this Object Type, to be skipped over when link-traversing.
> — map/images/oma-capabilities-link-merge.png

`integrate-objects-searcharound-linkmerge-example.png` shows what the merge produces
in the menu — a toolbar of round buttons with the search-around glyph active, and a
popover headed by the selected type and its selection count, listing entries with
reachable-object counts:

> DISTRIBUTION CENTER (8)
> Region 6
> Supplier (via Inbound Delivery) 48220
> Customer (via Delivery) 48220
> — map/images/integrate-objects-searcharound-linkmerge-example.png

**What that adds: the merged entry is named `<far type> (via <intermediary>)` and
carries the same kind of count an ordinary entry does.** The prose gives the naming
pattern for one example; the image shows it beside an unmerged entry (`Region`), so
the two forms coexist in one list.

Vertex is the same operation with a filter builder attached:

> The total number of objects of each type is shown within the dropdown list.

— `vertex/explore-object-relationships.md`

`explore_objects_4.jpg` shows that dropdown. A right-click menu over one selected
node offers `Search Around`, `Open linked events`, `Open series`, `Edit styling`,
`Select all`, `Select all "[example data] airports"`, `Invert selection`,
`Select linked objects`, `Filter selected objects`, `Open in…`,
`View data lineage`, `Delete selection`; the `Search Around` submenu is headed by
the selected type and lists five entries, each with a count and a filter button:

> [EXAMPLE DATA] AIRPORT
> [Example Data] Arriving Flight 102064
> [Example Data] Arriving Route 87
> [Example Data] Departing Flight 102057
> [Example Data] Departing Route 86
> [Example Data] Runway 4
> — vertex/images/explore_objects_4.jpg

Arriving and Departing Flight have different counts (102064 against 102057), which
is direct evidence the counts are computed per link side rather than per far type.

Two more Vertex sentences matter for a link filter:

> The next link in the Search Around will take the resulting object set from the previous link as its starting object set.

— `vertex/explore-object-relationships.md`

> Once you have filtered your object set, you can choose to add this to your graph immediately, or continue building a multi-step Search Around across multiple objects using the **Add link** button.

— `vertex/explore-object-relationships.md`

> Once a filter has been applied, the starting object set will be filtered to those objects connected to the filtered resulting object set.

— `vertex/explore-object-relationships.md`

That last one is a link filter expressed as a traversal run backwards, which is
exactly the composition §2 says the API forces.

**The course** names the operation for a user and adds one thing no mirrored page
does — that it is undoable:

> When you are exploring an object set, you can use the Linked objects entries in the lower right to switch to all of the linked objects according to some relationship link.
> — docs/foundry-deep-dives/text/01-ontology/fresh-air-operations.txt

> This process of traversing links from one object set to another is often called pivoting from one object set to another.
> — docs/foundry-deep-dives/text/01-ontology/fresh-air-operations.txt

> Undo the pivot that you just did by clicking the Undo arrow in the top left of the screen
> — docs/foundry-deep-dives/text/01-ontology/fresh-air-operations.txt

`explore-charts` corroborates the undo from the other side, listing
`Pivoting the exploration to a linked object type` among the five undoable actions.

## 9. Contradictions and duplicates found by grepping the corpus

**One real disagreement, on the search-around limit.** `object-backend/overview`,
listing what OSv2 enables:

> By default, the Search Around limit is 100,000 objects. If your use cases require a higher scale Search Around of over 100,000 objects, contact Palantir Support for instructions on how to enable this.

— `object-backend/overview.md`

`ontologies/oss-limitations`, on the same backend:

> Spark-based execution: When a Search Around operation involves more than **100,000 objects**, OSS automatically transitions to Spark-based distributed compute.

— `ontologies/oss-limitations.md`

> Search Around result limits: The result set from a Search Around operation (the "leaf" object set being loaded from a single datasource) cannot exceed **10 million objects** per individual Search Around operation.

— `ontologies/oss-limitations.md`

One page calls 100,000 a limit you contact Support to raise; the other calls it the
threshold at which the engine silently changes strategy, and puts the hard limit at
10 million. `functions/api-object-sets` sides with the second:

> When performing a search around from object set A to object set B in Object Storage v2, the resulting object set B cannot have more than 10 million object instances, or an error will be thrown. For Object Storage v1, the limit is 100,000 object instances.

— `functions/api-object-sets.md`

Two pages against one, and the two agree on a mechanism while the one states a bare
number — but counting sources is not the tie-break here (CLAUDE.md's own rule). What
resolves it is that `object-backend/overview`'s sentence sits in a bullet list of
OSv2 *improvements over OSv1*, where 100,000 was OSv1's real ceiling. I read it as
stale rather than wrong, and I have not built anything on either number.

**Two byte-identical duplicate pairs.** `object-views/core-object-views.md` and
`object-views/standard-object-views.md` are identical after the source comment;
`object-backend/_index.md` and `object-backend/overview.md` likewise. Both counted
as separate pages in `MAP.md`. And `api/` mirrors every v2 page three times — flat
as `v2-…`, flat as `…` without the prefix, and nested under `api/v2/` — with only
the source-URL comment and the mirror date differing. That is not a contradiction,
but it means an api grep returns triples and a count of matching pages is a count of
mirror paths, not of documents.

**Two vocabularies for one traversal**, in the sense CLAUDE.md's table means:

| concept | Object Explorer / Object View | public API / OSDK |
|---|---|---|
| naming a link in a filter | kebab-case ID, `restaurant-to-review`, `flight-to-pfrs` | camelCase API name, `searchAround.link` |
| the operation | pivot, Has Link, Filter by X | `searchAround`, `intersect`, `subtract` |
| the unit | a section, a card, a tab with a count badge | a page of `OntologyObjectV2` with a `nextPageToken` |

**No page anywhere says the standard Object View's linked panel navigates to the far
type's explorer.** `grep -rn "Linked objects" docs/foundry-reference/mirror/`
returns thirteen files and every one of them describes in-place display. The nearest
thing to navigation is `Open 177 in` in the screenshot and this, which is an opt-in
button in a Workshop widget:

> **Enable exploration on link types:** At each link type level, enable a button to allow viewing the link type in Object Explorer.

— `workshop/widgets-links.md`

## 10. What the pages settle about our three gaps

I am not proposing schema or code; this section only records which of our three
gaps the documentation decides and which it leaves open.

**Gap 1 — join-table links are metadata-only at read time.** Decided against us.
Foundry indexes a join table exactly as it indexes an object type's dataset
(§4: registration, reindex, `Indexing Metadata`, Funnel, streaming support), reads
it only through the object database (§3, `osv2-arch.png`), and the public API
deliberately does not let a client tell a many-to-many link from a foreign-key link
(§1.2). Reading a many-to-many link is not a different operation in Foundry; it is
the same operation over an index that has one more input.

**Gap 2 — no linkFilter authoring UI.** Decided, and the shape is fully specified.
`has_link.png` is the control: one menu keyed by relation, three filter kinds per
relation, the far type's properties listed underneath. `generate-urls` gives the
serialised form and the one-link-filter ceiling. `pivot_flights.png` gives the chip.
Note that our `Ontology:LinkFilterBackingUnsupported` has no counterpart anywhere in
the mirror — the phrase appears in no page, and by §1.2 Foundry could not raise such
an error without exposing a distinction it deliberately hides.

**Gap 3 — the Object View's linked card.** Decided. Four prose bullets and two
screenshots all say the card shows this object's linked rows in place, grouped by
link, with a count per link, the far type's properties as columns, a search box, a
sort control, a traversal breadcrumb and a hand-off menu. Nothing in the corpus
supports a jump to the far type's explorer as the card's behaviour.

---

## Decisions I had to make

- **`explore/` does not exist; I read `object-explorer/` instead.** The task named a
  section the mirror has never had. I did not mirror anything new — `MAP.md` and the
  section listing both show `object-explorer/` is the section, and it is complete at
  17 pages per the existing `object-explorer.md` reading.
- **I did not read all 100 pages matching `search around`.** I read the ones where
  the phrase is about reading or traversing a link and left the rest closed, listed
  in the header. Reading Vertex's graph-generation pages and Quiver's timeseries
  cards would have cost the session for nothing this arc uses. This is a scoping
  decision and it may be wrong; `vertex/generate-graph-functions` alone has 36
  occurrences that I have not looked at.
- **Where `object-backend/overview` and `ontologies/oss-limitations` disagree on the
  100,000 figure, I recorded the disagreement and picked neither.** I state a reason
  to think the first is stale (it is in a list of improvements over OSv1, where
  100,000 was the real OSv1 ceiling), but I did not resolve it, because nothing in
  this reading needs a number.
- **I read the two glyph shapes in the left column of `linked-objects-component.png`
  as a cardinality distinction, and marked that as inference.** Nothing captions
  them. The alternative reading — that they distinguish direct from transitive links
  — is equally consistent with one screenshot.
- **I treated `Arriving Flights` / `Departing Flights` in
  `OE_search_results_search_around.png` as link names rather than object type names,
  and said so as inference.** The evidence is that they are a pair for one far type,
  and that Vertex's equivalent list gives the pair different counts. No caption says
  it.
- **I did not carry `object-link-types/derived-properties` into this reading**
  beyond noting it exists, because it already has its own reading and re-summarising
  it here would create a second, drifting account of the same page.
- **I quoted the count badges out of screenshots as evidence for set-valued
  traversal** (480,644 → 133 → 1,227 → 177). That is arithmetic on a screenshot, not
  a sentence, and I have marked it as what it is. The `left-semi join` sentence is
  the citation; the numbers are corroboration.
- **I did not measure a single pixel.** Three capture eras are present in the images
  I opened, and CLAUDE.md's rule is to date a capture before measuring. Nothing this
  arc needs is a dimension, so the cheapest correct choice was to take none.

## Questions I could not answer

1. **How does a join dataset's row become traversable — is the join table indexed as
   its own thing, or denormalised into both object types' indexes?**
   ~~`blocks: the read-path build.`~~ **ANSWERED by a five-angle cross-check,
   2026-09-04** (whole-page reads of `object-indexing/`, `object-backend/`,
   `object-databases/`, the api section enumerated, all 214 course lessons
   grepped, an alternative-vocabulary sweep, and an adversarial pass told to
   refute the pair-structure hypothesis). The page I missed on the first pass
   answers it as clearly as the corpus ever does:

   > "In many-to-many relationships, the Ontology requires the definition of a
   > join table to define all of the links between objects based on their
   > primary keys. These tables are indexed alongside the objects in the
   > Ontology and use ontology volume."

   — `ontologies/volume-usage.md`

   > "In general, look-up tables have a constant size per record and grow
   > linearly in volume with the number of links that are defined."

   — `ontologies/volume-usage.md`

   The join TABLE is the indexed unit, *alongside* — not into — the objects,
   metered per link type at constant size per record, linear in the number of
   links: the cost profile of a pair store. Corroborated structurally by
   independent pages: a link type has its own Phonograph registration, table
   RID, index RID and reindex status (`object-databases/object-storage-v1.md`);
   a join-table m2m link type is its own OSv1→OSv2 migration unit with its own
   Indexing Metadata section, and "Object Storage v2 is enforced for all object
   types and join table link types" (`object-backend/osv1-osv2-migration.md`);
   a link type can sit in a DIFFERENT storage generation than both of its
   object types (`workshop/auto-refresh.md`) — impossible under
   denormalisation; OSv2 tracks a per-link-type edit-offset stream applied to
   live indexed data (`object-edits/how-edits-applied.md`); and links are the
   documented escape from the 100,000-element array cap
   (`object-indexing/data-restrictions.md`), which an on-document key list
   would collide with. The denormalised-key-list hypothesis has ZERO textual
   support anywhere in the corpus — "denormalized" appears only as a user-level
   anti-pattern (`ontology/ontology-structural-guidance.md`). What remains
   inference: that the index's internal layout is literally (sideA pk, sideB
   pk) rows — but the backing join table is defined as exactly those pairs
   (`object-link-types/link-type-metadata.md`) and the materialization keeps
   its columns, so the build takes the pair store as the shape, recorded here.
2. **Where does a per-link count badge come from?** `blocks: the linked-objects
   panel.` The badges are everywhere in the screenshots — `177`, `216`, `23,814`,
   `48220`, `102064` — and `listLinkedObjects` returns no `totalCount`, while
   `loadObjects` does and `aggregate` could produce one. No page says which call a
   surface makes, nor whether the number is exact or estimated. `oss-limitations`
   does say OSS uses size estimation to decide whether to execute a query at all,
   which makes an estimated badge plausible; it does not say the badge is one.
   Searched `api/` for a count endpoint on links and found none.
3. **Does the standard Object View's linked panel page, or cap?** `blocks: the
   linked-objects panel.` The Links widget says five rendered and
   `...and 24,213 more objects`; Workshop's says `Viewing 10 of 23,814  Show more`;
   the Timeline widget says 50 then 100 at a time. The standard component's prose
   and both its screenshots say nothing about a page size or a limit. Searched
   `object-views/` whole for a number.
4. **Is `Ontology:LinkFilterBackingUnsupported` ours alone?** `blocks: nothing`, but
   it should be answered before the linkFilter work.
   grepping the mirror for that identifier returns
   nothing, and the error appears only in our own 475, 484 and 523. Foundry's error
   namespaces in this area are `Phonograph2:DatasetAndBranchAlreadyRegistered`,
   `ObjectsExceededLimit`, `LinkedObjectNotFound`, `PropertiesNotFound` and
   `ObjectsDataFunnel:DecimalPropertyTypeMissingPrecisionOrScale`. So the error is an
   invention of ours, and by §1.2 it names a distinction the public API refuses to
   expose.
5. **v1 says the linked-objects list supports filtering and v2 does not repeat it —
   is that a removal or an omission?** `blocks: nothing.` The v1 page links to a
   Filtering Objects section; the v2 page has no equivalent sentence and no filter
   query parameter, though it gained `snapshot`, `select`, `excludeRid` and `branch`.
   Searched both pages whole and the object-set endpoints, which do carry a filter —
   so a filtered linked read in v2 is presumably composed as
   `filter(searchAround(...))` and issued through `loadObjects`. The pages do not
   say that.
6. **Does the standard Object View's traversal breadcrumb persist, and is it
   shareable?** `blocks: nothing.` The breadcrumb in `linked-objects-component.png`
   is four hops deep with a count at each, which implies a durable object-set
   definition behind it, and `create-temporary-object-set` exists and expires in an
   hour. No page connects the two. Searched `object-views/generate-urls` and
   `object-explorer/generate-urls` for a linked-panel route and found neither.
7. **What is an `intermediary link type`, precisely?** ~~`blocks: nothing.`~~
   **ANSWERED by the same cross-check:** it is the object-backed link.

   > "The object in the middle serves as the intermediary and provides
   > additional metadata about the connection between the two entities, and
   > backs the link."

   — `object-link-types/create-link-type.md`

   So `oss-limitations`' Spark-forcing "intermediary link types" are
   object-backed links — resolving one takes a two-hop probe through the middle
   object's own index, which coherently implies a plain join-table link has a
   faster indexed structure of its own (a point in the pair-store answer to
   question 1's favour).
8. **Does `interfaceLinkSearchAround` behave differently at read time?**
   `blocks: nothing`, but it blocks the interfaces arc if that resumes. It is a
   distinct `ObjectSet` member taking an `interfaceLink` rather than a `link`, and
   `oss-limitations` lists interface Search Arounds among the Spark-forcing features.
   No page describes what it resolves to. `actions-on-interfaces.md` and
   `api-interface-type.md` in this directory may already cover it; I did not check.
