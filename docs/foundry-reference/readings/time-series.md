---
verify: strict
---

# Time series — the ontology slice

**Pages read:** all 42 under `time-series/`, whole, plus
`object-link-types/properties-overview`, the five api endpoint pages under
`ontologies-v2-resources/time-series-properties*` and
`*time-series-value-bank-properties*`, and
`api/v2/ontologies-v2-resources/object-types-get-object-type-full-metadata`.

**Images, counted rather than asserted:** the section references 246 distinct
images (238 through markdown, 8 more through raw `<img>` tags that a
markdown-only grep misses). 243 were parsed. The three that were **not** are the
SVGs — `time-series-setup-tsp-overview-graphic.svg`,
`derived-series-overview-graphic.svg`,
`derived-series-asset-structure-graphic.svg` — because every glyph in them is a
path outline with no `<text>` element and this machine has no rasterizer. That
is an unread debt, not a covered item, and it is mine.

---

## 1. Two components, and a real answer to "what backs it"

> To use your data for time series analysis, you must set up two major components: a time series object type and a time series sync.

> The time series sync is a resource backed by a dataset or a stream that indexes time series data and provides values for time series properties.

CLAUDE.md's third question for anything new is *what backs it*, and the answer
is a dataset. That matters more than usual here: 628 deleted an earlier
`public.time_series_properties` and said why — it registered "a raw
`source_table` plus an `entity_column`, a `time_column` and a `value_column` — a
table name in a column, which is the generic-table shape this repository has
deleted three times". A sync is a resource over a *registered* dataset with a
named column mapping, which is the opposite of that.

## 2. What a time series property is, and what it is not

Not a new property. An existing string column, set as one:

> Each series ID column in the time series object type backing dataset maps to one TSP.

> A foreign key in the time series object type used to fetch values from a time series sync. Typically, the series ID is distinct within the time series object type backing dataset and has a one-to-many relationship with its corresponding rows in the time series sync.

The Ontology Manager's dialog says the same in its own words — select a `string`
property that contains the series IDs — and the page states one refusal
outright:

> The primary key property of an object type cannot be selected as the time series property.

**That refusal was already ours.** `primary_key_eligibility('time_series')` has
returned `'no'` since 408, because `properties-overview`'s table — the page that
ENUMERATES the twenty-two base types, and the one `vocabulary.test.ts` parses —
marks Time Series *No* under both *Valid as title key?* and *Valid as primary
key?*. Verified before building rather than rebuilt.

## 3. The sync's schema, and two enumerations that disagree

The glossary says a sync should "contain exactly the following columns" and
lists three; `time-series-syncs` lists four. Both are quoted, and the
disagreement is resolved rather than averaged:

| Column | Type | |
|---|---|---|
| seriesId | `string` | required |
| timestamp | `timestamp` or `long` | required |
| value | `double`, `integer`, `float` or `string` | required |
| Ingestion time | `timestamp` | optional, **streaming only** |

> For long typed time columns, the units must be specified. Available units include seconds, milliseconds, microseconds or nanoseconds.

and the dialog gives the spelling — `SECONDS`, `MILLISECONDS`, `MICROSECONDS`,
`NANOSECONDS`. That set is a CHECK with a `Values from` comment (601), not a
guess.

A string value is not a degenerate case but a named one:

> A `String` type indicates a **Categorical** time series; each categorical time series can have at most 10,000 unique variants.

## 4. The datasource union — where this actually belongs

`object-types-get-object-type-full-metadata` publishes ten datasource kinds:
`timeSeries`, `unsupported`, `restrictedView`, `stream`, `mediaSetView`,
`direct`, `geotimeSeries`, `editsOnly`, `dataset`, `table`. They split
structurally — the tabular ones carry a `propertyMapping` of property to column;
the non-tabular three (`timeSeries`, `mediaSetView`, `geotimeSeries`) carry only
a flat list.

> An object type datasource backed by a time series sync, providing values for time-dependent properties.

with `timeSeriesSyncRid` required and `properties`, "The set of properties that
are bound to the time series".

**585 had already written the union down** while building the media arm, and
this is the fourth arm by the same move. `object_type_datasources_one_backing`
now admits a dataset+branch, a restricted view, a media set view, or a sync.

### The mistake this reading exists to record

An earlier draft of 774 repointed a TSP's `datasource_id` at the time-series
datasource. **It would have silently disabled a linter.**
`ontology_violations_core` joins a property's datasource to `datasets`; a
time-series datasource has none, so the inner join drops the row and the
stale-column finding stops applying to exactly the property kind whose entire
value is a pointer into a column. The property keeps its tabular datasource, and
`object_type_time_series_sources` is the flat list as a table — 585's shape,
adopted for 585's reason.

## 5. What 586 predicted, and left undone

586's header says of the datasource guard that when a time series sync
datasource arrives "it is one line", and it quotes the sentence the datasource
limit rests on — the limit does not "include media sets or time series syncs".
Both were left for this. A fourth kind the guard had never heard of would have
failed on **every insert**: `synced := NEW.media_set_rid IS NULL` makes a sync
look like a dataset, and the organization check then raises against a dataset
that is not there. `datasource_mapping_problems` needed the third line, or every
sync datasource would report "maps no properties" and block a save.

## 6. Permissions are part of the feature

> To view a time series property, you must satisfy the access requirements for **all** of its backing data sources.

> The time series sync will inherit all of the markings from its input dataset.

> Because time series syncs cannot be backed by restricted views, they cannot have granular permissions.

The reader applies `satisfies_markings(effective_data_markings(...))` of the
sync's input dataset, and returns nothing rather than raising, because the api
masks access as absence on this path. The sync's FK to `datasets` — not to
`restricted_views` — keeps the third sentence true by construction.

## 7. The Capabilities surface, re-read (2026-09-09)

Written before building it, and the re-read changed three things I had recorded
from the prose alone. CLAUDE.md rule 8 applies here more than anywhere else in
this reading: **the four captures are not all of the same UI generation**, and
they disagree about what the panel is called.

**The newer capture** (`time-series-setup-ontology-capabilities-tab.png`) puts
time series inside an outer **Base Types** group on the Capabilities tab,
alongside six siblings — Media Reference Properties, Measures, Event,
Geospatial, Search Around, Vertex — with a second group, Dynamic Scheduling,
below it. Its own header reads:

> Time Series Properties
> set existing object type properties as time series
> — time-series/images/time-series-setup-ontology-capabilities-tab.png

**The older captures** (`time-series-setup-add-tsp-dialog-2.png` and `-3.png`)
show the panel through the dim behind an open dialog, and there it is one row
with no Base Types wrapper and a different name and blurb:

> Time Series - set up time series properties or a sensor object type.
> — time-series/images/time-series-setup-add-tsp-dialog-2.png

Media Reference Properties is absent from the older one, which is what dates
them: a capability was added and the row was renamed. **Built from the newer.**

### What the table actually has

Three columns, and I had recorded a fourth that is not there:

> PROPERTY NAME | TIME SERIES SYNC | BASE FORMATTER
> — time-series/images/time-series-setup-ontology-capabilities-tab.png

There is **no Default column**. The single row shows `Temperature`, the sync as
a link (`Machine time series sync`), and a `Time series formatting` dropdown. The
panel's actions sit on its header line: `Analyze` and `+ Add`. With one TSP in
the capture I cannot see how several are distinguished, so marking the default
row in our table is an **inference**, and is marked as one below.

### The empty state

> Get started using one or more properties from this object type in time series workflows
> — time-series/images/time-series-oma-get-started.png

Its subtitle offers the sensor branch, which we do not build:

> Choose if this object type is a Sensor object type and set up a time series property.
> — time-series/images/time-series-oma-get-started.png

### The dialog, and the step we do not build

Titled `Time series property setup`, with a three-item stepper: `Select existing
property`, `Add time series syncs`, `Ontology setup`. Step 3 is the sensor
decision, so ours has two steps and says why rather than showing a dead third.

Step 2 carries the sentence that lets a surface create a sync at all:

> A time series sync indexes the rows of the time series dataset by series ID. A dataset may also be selected and it will be indexed as a time series sync.
> — time-series/images/time-series-setup-add-tsp-dialog-3.png

and its chosen sync is tagged by kind — `machine time series sync` `Numerical`.
That tag is not asked for anywhere in the dialog, and the glossary says why it
does not have to be: a `String` value column *indicates a Categorical time
series*, and *different data types cannot exist within one time series sync*.
So the sync answers `itemType` for every property it backs. 780 makes that a
function, `time_series_sync_item_type`, rather than a rule the surface knows
privately.

### The default checkbox is shown in both of its states

In the OLD three-step dialog it is checked with a live label:

> Set as default time series property
> This allows other applications to automatically configure and display this property.
> — time-series/images/time-series-setup-add-tsp-dialog-2.png

In the NEW single `Edit time series property` dialog the same control is checked
and **greyed out** — a disabled checkbox with a muted label, in a red-outlined
callout the capture uses to point at it:

> Set as default
> — time-series/images/time-series-setup-default-tsp.png

That is the whole answer to whether the default can be cleared. Foundry does not
refuse the click; it removes it. So the rule lives in the surface, and the
database is left able to represent the state an operator reaches in SQL — with
`ontology_warnings()` reporting it rather than a trigger silently rewriting a
`false` back to `true`.

## Decisions (2026-09-09)

1. **A sync is a resource over a dataset**, with its three columns named rather
   than assumed. Streams are not built, and with them the optional ingestion
   time column, whose only writer would be a stream.
2. **A TSP keeps its tabular datasource.** The sync binds properties; it maps no
   columns. See §4.
3. **The indexed column is `text`.** `property_column_type` fell through to
   `ELSE 'jsonb'` with no CHECK, so the build succeeded and produced a wrong
   thing. All three legal cell encodings — a bare series id, a qualified
   `{seriesId, syncRid}`, a codex template rid — are strings. No index carried
   one, so nothing needed rebuilding.
4. **The branch is OURS, marked as inference.** The api's `timeSeries` arm
   carries no branch where `dataset` and `stream` do, and no page names one, so
   the reader resolves `master` as `index_object_type` already does for a
   restricted view.
5. **Syncs are addressed by RID, never an api name** — `Add syncs by RID`,
   `syncRid`, `timeSeriesSyncRid` — so they have none. The RID shape is the
   section's own: `ri.time-series-catalog.main.sync.<uuid>`.
6. **One sync serves many object types**, which is the opposite of a dataset
   datasource's `Phonograph2:DatasetAndBranchAlreadyRegistered` rule. The sync
   page shows one sync backing two object types.

## 8. Are the `timeseries.*` type classes legacy? (2026-09-09)

Asked because 780 left it open, and answered by reading rather than by choosing.
**The answer is NUANCED — no sentence settles it — but it rests on three
explicit anchors and one explicit contradiction that does most of the work.**

### First, a correction to how the question was posed

I said 415 "skipped" the seven and that nobody decided it. **False, and 415 says
so in its own header:**

```
-- Two panel shapes exist. This builds the SLOT-BASED one (Geospatial, Event).
-- The LIST-BASED one is `time_series_properties`, which we already have.
```
(`supabase/migrations/415_metadata_and_capabilities.sql` — ours, not the mirror.)

It routed them by panel shape, deliberately. And 710 already catalogues most of
the family as type classes. The open question was never *were they skipped* but
*is the shape they encode still live*.

### The contradiction that dates the table

Two mirrored pages state opposite rules for the same property:

> When applied to the primary key of a timeseries object, this type class specifies the *series identifier* (`seriesId`) of that object.

— `object-link-types/metadata-typeclasses.md`, of `timeseries_id`. Against:

> The primary key property of an object type cannot be selected as the time series property.

— `time-series/time-series-properties.md`. And:

> TSPs cannot be a primary key or title property.

— `time-series/create-sensor-ot.md`. That is not ambiguity. One of those pages
describes a model the platform no longer uses.

### Which model, said explicitly

> Prior to the development of sensor object types, the platform used Measures as a time series model. Measures are being deprecated and you can use sensor object types in similar workflows.

— `time-series/faqs.md`. And the single sentence in the whole corpus that maps a
type-class NAME onto a current field:

> If you are migrating from the Measures setup, this was previously referred to as `is_enum`.

— `time-series/create-sensor-ot.md`. So the `timeseries.*` vocabulary **is** the
Measures vocabulary, and Measures is retired.

### But the rows are not dead, and the page says why

> The **Deprecated** column indicates whether a type class is still supported.

Only two of the seventeen carry the literal token. The rest carry
*Configure in **Capabilities** page of object type*, which the legend makes a
THIRD value — supported, configured elsewhere:

> The configuration of all supported type classes will move to the **Capabilities** page.

And Quiver is named in the present tense as a consumer:

> Quiver is an application that consumes `timeseries` type classes.

### The verdict: the seven do not share one fate

| row | status | where it lives now |
|---|---|---|
| `timeseries_units` | live knob, **relocated** | the per-TSP base formatter, and the sensor-OT section |
| `timeseries_internal_interpolation` | live knob, **relocated** | the same two |
| `timeseries_is_enum` | live knob, **renamed** | sensor-OT section, "Is categorical?" |
| `timeseries_measure` | model **deprecated** | Measures → sensor object types |
| `timeseries_id` | **generationally contradicted** | the TSP's series-id string property |
| `timeseries_root_object_id` | no named successor | possibly Sensor link — INFERENCE, nothing states it |
| `timeseries_is_deprecated` | no current UI | one callout telling the reader to ignore it |

So neither *legacy-and-excluded* nor *the slot half*: the seven are the
**superseded encoding of a live feature**, and the live feature is not
slot-shaped at the level they sit at.

### What that means for building Time series formatting

**Its own panel, not `capability_slots()`** — and 415's routing was right for
the reason it gave. Two levels, because the docs have two:

1. **Per TSP row, the base formatter.** Two fields, each a constant OR a
   reference to a `string` property on the same object type — *"The unit and
   interpolation formatting can point to other `string` properties on this
   object type for more granular control"*. That is per-(object type, property),
   which `capability_slots()`'s one-row-per-object-type-slot shape structurally
   cannot hold.
2. **Per object type, the sensor configuration section.** This half IS
   slot-shaped — Sensor link, Is categorical?, Units, Internal interpolation,
   each bound to a property. Still not `capability_slots()`, because Sensor link
   binds a LINK TYPE plus a property and the slot shape is
   `(capability, slot, accepts base_type[])`.

Adding `timeseries_units` / `timeseries_internal_interpolation` to
`capability_slots()` would build the retired Measures shape beside the live one
— the parallel-system failure this repository has made three times.

The interpolation value set is closed and citable: `LINEAR` / `NEAREST` /
`PREVIOUS` / `NEXT` / `NONE` (`time-series/interpolation-overview.md`), with
`LINEAR` *"Only applicable to numerical time series"*. Two cautions: `api/`
publishes **nothing** about interpolation, so prose is the only source — weaker
than our usual rail; and the casing splits by audience, SCREAMING_CASE in the
time-series pages and "Linear" in the OMA capture.

### What this pass found on the way, and 781 fixed

`ontology_type_classes_catalogue()`'s own COMMENT counted the page as 17 vertex
plus 13 timeseries rows. The page has **seventeen** timeseries rows. Four were uncatalogued and therefore
refused by name at assignment time, three of them carrying a blank Deprecated
column — the value meaning current and not even relocated. 781 adds them and
`typeClasses.test.ts` now PARSES the page, so the next upstream row fails CI
instead.

### Still for a human

**Precedence is undocumented.** Nothing in the mirror says what wins if a sensor
object type has both a base formatter and a sensor-section value; the page says
units and interpolation *"should be set in the sensor object type configuration
section rather than through the base formatter"*, inside a warning callout, and
the capture replaces the cell with an info icon. Under *do not be stricter than
Foundry* that is a withheld control and at most a warning — but the precedence
rule itself would be invented.

## 9. Time series formatting, built (2026-09-09)

The base formatter — the third column of the TSP table, and the last part of
`## Time series formatting` 774 named as unbuilt. Seven readers went at it
before anything was written, and four of their findings changed the design.

### It is NOT the value formatter, which was the whole design fork

The column is headed `BASE FORMATTER`, and that is also the docs' own name for
what our `value_formatting` column holds. One name, two mechanisms — and the
obvious move, a sixth arm on `value_formatting_valid`, would have been wrong
twice. The api's `valueFormatting` union has exactly five members — `date`, `number`,
`boolean`, `knownType`, `timestamp` — with no time series member, and 736
exists *because* 673 invented members the
api does not publish. A sixth arm repeats that migration by name.

What is reused is one level down. Every "value or pointer" slot the api
publishes — a unit, a currency code, an affix, a timezone id — is the same
two-member union, and 736 already validates it as `formatting_operand_valid`.
And the page's own sentence IS that union, in prose:

> The unit and interpolation formatting can point to other `string` properties on this object type for more granular control (for example, if each time series contained in the time series property has different units and or interpolation). If granular control is not required, both interpolation and units have a set of standard values to choose from.

So both columns are operands, validated by the function that already existed.
The seam `packages/ontology/src/formatting/index.ts` records holds: the api's
`propertyApiName` carries a PROPERTY_ID here, as everywhere else in this repo.

### Units have no standard set, and the page promised one

That same sentence says units *"have a set of standard values to choose from"*.
**That set is not in the corpus.** Not on any of 4,123 mirrored pages, not in
`api/`, not in the 214 extracted lessons. The only enumerated unit lists belong
to other products and print themselves truncated as *"and more"*. Palantir's own
worked example dataset uses `ft`, `mph`, `ft/min`, `deg` — and `lat` and `lon`,
which are not units at all.

So the units constant is **free text with no CHECK**, and 782's header carries
the reason rather than a `Values from` comment it could not honestly write. This
is the first value set in this project that a page promises and no page prints.

Interpolation is the opposite: five members, enumerated verbatim twice.

> The internal interpolation options available in the Palantir platform are:

`LINEAR NEAREST PREVIOUS NEXT NONE`, re-enumerated identically under
create-sensor-ot's *"Valid values are:"*. The CHECK names the page.

### Unset is not unknown

> By default, numeric time series use `LINEAR` interpolation and categorical series use `PREVIOUS`.

So the column is nullable with no literal DEFAULT and `time_series_formatting()`
resolves it from the declared `itemType`. `numericOrNonNumeric` resolves to
null rather than guessing — its type *"must be inferred from the result of a
time series query"*.

### Two rungs, and the difference is whether a page states a consequence

`LINEAR` is *"Only applicable to numerical time series"* — stated. What happens
if it is set anyway is **not** stated anywhere: a filtered grep of every
interpolation line for invalid / ignore / error / fallback / unsupported /
reject across the whole mirror returns nothing. A refusal would be stricter than
Foundry, so it is `ontology_warnings()`.

A pointer naming a property that is gone, or is not a string, is different: the
formatter cannot resolve, and that can become true without anyone editing the
formatter. That is `ontology_violations()` by CLAUDE.md's own description of the
rung.

### What is deliberately NOT modelled

- **External interpolation.** Quiver's cards have one; the ontology has no
  field, no type class, no sensor option, nothing on any Ontology Manager
  surface. It is a plot setting. The consuming applications do not even agree on
  its shape — Quiver splits it into Before and After, Workshop carries a single
  External — which is a second reason it does not belong here.
- **The sensor branch.** For a sensor object type the cell becomes an info icon:

> Set the units and interpolation in the Sensor object type configuration below.
> — time-series/images/time-series-setup-sensor-object-type-base-formatter.png

  Sensor object types are excluded, so no object type of ours can be one.
- **A precedence rule.** Genuinely undocumented — fifteen grep patterns over the
  whole mirror, intersected with unit/interpolation/formatter/sensor, return
  nothing. Foundry withholds the control rather than refusing the value, so
  withholding is a surface decision and precedence stays uninvented.

### `api/` cannot help here, and that is worth recording

Zero of 1,821 api pages match `interpolat`; the `timeseries` property type
publishes `itemType` and nothing else; the OSDK publishes points only. CLAUDE.md
leans on `api/` to settle shape questions and it has falsified our schema four
times — **here it cannot**, so prose is the sole rail. It does still confirm the
constant-or-pointer SHAPE four times over on the neighbouring value formatter,
which is why that half is not an invention.

### A correction, and it is mine

780's header says `ObjectTypesPage` *"excludes `time_series` from the property
type dropdown by name"*. It does not. Line 210 offers every member of
`PROPERTY_TYPES`; the filter that names `time_series` is the **array element**
dropdown twelve lines below. So an undeclared, unbound time series property is
creatable from the editor today, and the panel has to tolerate one. I wrote that
claim into an applied migration and repeated it, and 782's header carries the
correction because 780 cannot be edited.

### One open fork in the surface

The capture shows the constant-vs-pointer choice as an unlabelled caret-right
beside the value control — an Ontology Manager idiom that recurs in the numeric
formatter and the conditional-formatting colour picker, and which **no page
names**. Foundry's one prose-documented form of the same choice is a pair of
links, *"Add constant"* and *"Add reference"* (conditional-formatting). Ours
draws the documented pair. If a capture ever shows the caret open, this is the
thing to revisit.

## Decisions (2026-09-09, second pass — NOT YET READ BY A HUMAN)

These were taken while building 780 and the Capabilities panel. Four of them
exist because a reconcile overturned what I had already written, so they are
worth reading before the next thing is built on them.

7. **The default is a flag on the property row.** The api publishes no default
   field on either the object type or the `timeseries` property type, so this
   shape is **ours** — inference, modelled on 408's `is_title_key`: a boolean, a
   CHECK on eligibility, a partial unique index for the one-per-type half.
8. **The primary-key refusal was already ours, and I nearly re-added it.** I
   wrote a CHECK for *The primary key property of an object type cannot be
   selected as the time series property* and then deleted it:
   `primary_key_eligibility('time_series')` has returned `'no'` since 408, which
   §2 of this reading already said. The title half is covered too, which matters
   because a page I had not used states both at once — *TSPs cannot be a primary
   key or title property* (`create-sensor-ot.md`). The probe that "proved" the
   new CHECK caught `check_violation` from the OLD constraint and would have
   passed with the new one removed.

   One scar from this: 780's section heading still reads *the column, and the
   two facts about one row* when only one CHECK survived. I corrected it after
   applying the migration; `db.mjs` byte-compares an applied file against its
   ledger entry and CI refused the change, correctly. **Applied migrations are
   immutable including their comments**, so the heading stays wrong and this
   line is the correction.
9. **The trigger fires for the FIRST time series property, not whenever no
   default exists.** The two readings differ on a reachable path: delete the
   default of two and add a third, and the second version designates it
   silently — which contradicts the position taken in 12 below. Scoped to the
   moment a property *becomes* one.
10. **One sync per property, refused rather than picked.** `time_series_points`
    resolves the binding with `LIMIT 1` and the join table is keyed
    `(datasource_id, property_id)`, so two syncs meant an arbitrary answer.
    Foundry supports several and says the cost — *you must have a column of
    qualified series IDs* — which 774 excluded. A **scoped divergence**: it
    lasts exactly as long as the reader parses a bare series id.
11. **A declaration the sync disagrees with is refused — at bind time.** A
    `double` property bound to a categorical sync makes 779's reader null the
    column it named and return every point empty. Closed on ONE edge: the guard
    does not re-run when the declaration is later edited, when a sync is
    repointed, or when its dataset commits a new schema. Those three are a
    linter's job and are named in Questions rather than implied to be covered.
12. **The missing-default warning is a DECISION, not a citation.** No page in
    the mirror says a missing default is a problem, a warning or a
    recommendation; the strongest statement of consequence in the corpus is
    Quiver's card sentence. Every other arm of `ontology_warnings()` quotes a
    page that says *discouraged* or *warned*. This one infers.
13. **A claim withdrawn.** I drafted, and cut, an argument that sensor object
    types' `Is categorical` column — *\[Required if the TSP is backed by
    multiple syncs of both numerical and categorical types]* — meant 779's
    `TimeSeries:MixedSeriesNotBuilt` now rested on the schema. It does not: that
    row is a column of a sensor object type's backing dataset, 779's column is
    the api's `isNonNumericPropertyTypeId` on the property type, and the new arm
    exempts `numericOrNonNumeric` anyway. Converging concepts, different
    mechanisms.
14. **The panel is built from the newest capture**
    (`capabilities-time-series-properties-panel.png`), and three of its controls
    are deliberately not drawn because nothing is behind them: `Analyze` (our
    Quiver page creates analyses without plotting a series), step 3 of the
    dialog (the sensor object type choice), and the `BASE FORMATTER` dropdown —
    which is rendered as the `No formatting` state the capture itself shows,
    because that is true of every row until interpolation and units are built.
15. **Two documented subtitles exist for this panel and the truthful one was
    chosen.** The older capture's *set up time series properties or a sensor
    object type* promises a branch we do not build; the newer tab capture's *set
    existing object type properties as time series* is exactly what ours does.

## Questions (2026-09-09)

1. **CLOSED by 779.** `itemType` is required by the api and was not stored. It
   is now a declaration on the property, with the three members the api
   enumerates, and a bound TSP must make it.

   The reader's old behaviour turns out to have been right for a reason nobody
   had written down: returning both a numeric and a categorical column IS the
   documented behaviour of `numericOrNonNumeric` without the boolean property —
   the type "must be inferred from the result of a time series query". What was
   missing was the other two members, where the answer is known in advance and
   a column that is always null was handed back anyway. The reader now returns
   what the declaration promises, and both only for the member that says to
   infer.

   `isNonNumericPropertyTypeId` is **storable and refused**, not stored and
   ignored: it resolves per SERIES, from a boolean property of the object being
   read, which is a second lookup no page shows configured. The guard raises
   `TimeSeries:MixedSeriesNotBuilt` until the reader can honour it — the
   alternative to the declared-defaulted-inert shape this whole arc began from.
2. **The 10,000-variant cap on a categorical series is not enforced**, and the
   page says exceeding it makes the series "error and no longer be accessible in
   the platform".
3. **CLOSED by 780 and the Capabilities panel.** The default is designated, one
   per object type, the first one automatically, and the panel is what reaches
   it. A sensor object type's single TSP must be the default — still out of
   scope, and it constrains nothing on the standard path.
4. **`geotemporal_series` still falls through to `jsonb`**, and
   `array_element_allowed` excludes `time_series` but not it. `base-types`
   words it differently on purpose — a property as a *reference to* a
   geotemporal series — and it belongs to the geospatial product, unread here.
5. **A range filter on a series id emits `o.<col> >= 5`** — but this is NOT a
   time series defect, and describing it as one here was wrong. Measured after
   the fact: `object_set_where` emits exactly the same thing for a plain
   `string` property, because nothing compares a value-filter kind to the
   property's base type for ANY base type. A TSP is Searchable by default
   (render-hint gating covers only `vector`), so it inherits the general gap
   rather than creating one. The fix belongs to the filter grammar, not here,
   and it needs its own reading: what Foundry does when a filter kind and a
   property type disagree is not something any page consulted for this slice
   says.
6. **`## Time series formatting` is a third of every table row and is unbuilt.**
   `BASE FORMATTER` is a column in every capabilities capture, and its popover
   configures Internal Interpolation and Units — each of which may instead point
   at another `string` property of the object type for per-series control. Ours
   renders the `No formatting` state and nothing else. This is the largest named
   gap in the panel.
7. **Seven `timeseries.*` type-class rows were skipped by `capability_slots()`
   and nobody decided that.** `object-link-types/metadata-typeclasses` marks
   `timeseries_id`, `timeseries_measure`, `timeseries_units`,
   `timeseries_internal_interpolation`, `timeseries_root_object_id`,
   `timeseries_is_enum` and `timeseries_is_deprecated` with the same *Configure
   in Capabilities page* note that 415 used to take the whole `event` family.
   Two of them are exactly the knobs question 6 describes. Whoever builds
   formatting has to decide whether that family is legacy-and-excluded or the
   slot-shaped half of the same feature, and say which.
8. **The itemType-agrees-with-sync invariant is enforced at bind time only.**
   Editing the declaration afterwards, repointing a sync's value column, or a
   dataset committing a schema that changes that column's type all pass
   unremarked. That is precisely the *goes stale without anyone editing the
   ontology* shape `ontology_violations()` exists for, and it has no arm.
9. Unbuilt and named: derived series and codex templates, the Time Series
   Catalog, alerting, function-backed series, sensor object types, multi-sync
   TSPs and qualified series ids, interpolation and units formatting.
