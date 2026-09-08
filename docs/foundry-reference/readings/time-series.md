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

## Questions (2026-09-09)

1. **`itemType` is required by the api and is not stored.** A `timeseries`
   property type carries `itemType`: `string | double | numericOrNonNumeric`,
   the last with `isNonNumericPropertyTypeId`, "a boolean property reference".
   The reader returns both a numeric and a categorical column instead of
   declaring which, which is the most permissive member of a required union.
2. **The 10,000-variant cap on a categorical series is not enforced**, and the
   page says exceeding it makes the series "error and no longer be accessible in
   the platform".
3. **The default time series property is not built.** One per object type, the
   first configured becomes it, and a sensor object type's single TSP must be
   it. Deferred with the Capabilities surface.
4. **`geotemporal_series` still falls through to `jsonb`**, and
   `array_element_allowed` excludes `time_series` but not it. `base-types`
   words it differently on purpose — a property as a *reference to* a
   geotemporal series — and it belongs to the geospatial product, unread here.
5. **A TSP is Searchable by default**, because render-hint defaults gate only
   `vector`. `object_set_where`'s range arms would emit `o.<col> >= 5` against a
   series id. Not fixed in this slice; named so it is not discovered.
6. Unbuilt and named: derived series and codex templates, the Time Series
   Catalog, alerting, function-backed series, sensor object types, multi-sync
   TSPs and qualified series ids, interpolation and units formatting.
