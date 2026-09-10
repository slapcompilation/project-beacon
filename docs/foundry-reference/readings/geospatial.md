---
verify: strict
---

# Geospatial and geotemporal data

**Pages read:** all 17 under `geospatial/` (of which three are underscore/hyphen
duplicates of the same topic, so ~14 distinct), plus
`object-link-types/properties-overview`, `action-types/scale-property-limits`,
`map/integrate-objects`, `pb-functions-expression/constructGeotemporalSeriesReferenceV1`,
`pipeline-builder/outputs-add-geotemporal-series-output`, and the two api pages
under `ontologies-v2-resources-geotemporal-series-properties*`.

**Images, counted rather than asserted:** the section references **41** distinct
images and 41 are on disk. This reading rests on **one** that I parsed myself —
`create-geotemporal-series-reference-expression.png`, because it is the one that
could have falsified the cell CHECK 788 adds. **The other 40 are unparsed, and
that is a debt, and it is mine.** It is a proportionate debt only because the
decision below is *not to build* the feature those images document; anyone who
reverses that decision must parse them first.

---

## 1. The headline: this section is read, and mostly not built

The geotemporal series **feature** is not buildable from what the corpus
publishes, and 788 builds only the storage rules that are. That is the opposite
conclusion from the time series arc, and the reasons are specific rather than
squeamish.

**The read path is preview and its encoding is absent.** The single endpoint that
reads entries carries its own banner:

> This endpoint is in preview and may be modified or removed at any time.

and the api's canonical `PropertyValue` JSON-encoding table — printed on that
very page — has a `Timeseries` row and no geotemporal row at all. So the wire
form of a geotemporal value is unpublished even where every other property
type's is.

**What sits behind it is a database we do not have.** Geotemporal syncs are
configured in Pipeline Builder against observation schemas, source systems,
destination namespaces and hot/cold storage. None of that is ontology.

**And it is Beta:**

> Geotemporal series are in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.

Beta alone would not stop a build here — plenty of what this project copies is
young. The absent encoding is what stops it.

## 2. What IS documented: the two rules in one sentence

> Within an ontology object type, a geotemporal series reference (GTSR) property type is used to reference a particular geotemporal series from a geotemporal series sync. Applications use this reference to fetch the backing geotemporal data for the series. Each object type may have at most one GTSR property type, and it may not allow multiple values.

Two rules, neither of them ours before 788: **at most one per object type** (a
fact about a set of rows → a partial unique index) and **never an array** (a fact
about one row → the existing `array_element_allowed` CHECK, which excluded
`vector`, `time_series` and `media_reference` and not this).

The array rule survives a conflict, and the tie-break is this repository's own —
an enumeration beats a description. `base-types` *describes* the exclusion as
"excluding the `Vector` and `Time series` types", a list that is simply
incomplete; `action-types/scale-property-limits` *enumerates* array support per
property type and gives Geotemporal series reference its own row. Three feature
sentences agree with the enumeration, so nothing rests on the tie-break alone:

> An object type can have at most one geotemporal series reference property, and it may not be an array of geotemporal series references.

## 3. The cell, which IS published

The Pipeline Builder producer prints its own output — the same thing that made
786's qualified series id buildable — with a base case, a null case and three
awkward inputs including the empty string. The cell is a two-key object naming
the series and the integration that holds it, and the expression's own dialog
confirms both inputs are required: *Series ID* is "The column with the series ID
values that correspond to series in the geotemporal integration" and
*Geotemporal series integration RID* is "The RID of the geotemporal series
integration to reference"
(`create-geotemporal-series-reference-expression.png`).

**So `geotemporal_series` stays `jsonb` and gains a CHECK.** It does **not**
become `text`. That was the right answer for `time_series`, whose cell is a bare
series id string — copying it here would be reasoning from a shared word rather
than a shared shape, which is the mistake 782 came close to making with "base
formatter".

Two things the CHECK deliberately does not do, each because doing them would be
stricter than Foundry's own printed answers: it does not bound the series id's
length (the 1-100 bound belongs to the sync's observation schema, and the
producer prints the empty string producing a full reference), and it does not pin
the RID's instance segment (the only published sample leaves it empty).

## 4. `geopoint` and `geoshape` are already right, and one trap is recorded

632 got both. Nothing changes. But two facts are worth having written down before
anyone builds a converter:

- **The stored and wire encodings differ, and they are reversed.**
  `properties-overview` says a geopoint is stored "as a comma-separated string in
  the format `latitude,longitude`"; the api encodes the same value as GeoJSON,
  which is longitude-first. Any converter needs the swap and an asymmetric
  fixture.
- **A geoshape needs no swap at all** — it is already GeoJSON in both places.
  Adding one would move every polygon.

## 5. The track slots are the TIME SERIES feature, not this one

`capability_slots()` publishes `geospatial.track_latitude` and
`track_longitude`, and what fills them is settled:

> To configure the track for the object type, select the **Track Latitude** and **Track Longitude** properties in the **Geospatial** section of the object type's **Capabilities** tab. Both properties must be numeric time series properties representing the object's location over time.

Three consequences, all acted on in 788:

1. **774's header was false when written.** It said the Geospatial panel shipped
   two slots that no property could fill. 415's own assertion block creates a
   `time_series` property and nominates it for `track_latitude`, under a comment
   naming it the documented case, and has run on every apply since. What 774 could truthfully have said is that
   no property of a *real* ontology filled them, because nothing could author a
   time series property until 780's panel.
2. **The slots were too wide.** The page says *numeric*; the slot accepted any
   time series property. Since 779 a property declares its item type, so the
   `string` member — the one that means categorical — is now refused.
   `numericOrNonNumeric` is deliberately **not** refused: its type "must be
   inferred from the result of a time series query".
3. **There is no geopoint slot and should never be one.** `metadata-typeclasses`
   marks `geo/latitude`, `geo/longitude` and `geo/geojson` deprecated in favour
   of the base types, and the map reads geo by base type rather than by
   nomination.

## 6. A URL is not a page, and a missing section may have MOVED

`all-foundry-urls.txt` lists six `geotemporal-series/` URLs. All six now 404 —
the mirror script failed on every one, reporting that it found neither page
markdown nor an endpoint. They were not lost: the section was **reorganised into `geospatial/`**, and every one
has a successor on disk (`overview` → `geotemporal-series-overview`,
`integrating-…-with-the-ontology` → `integrate-geotemporal-series-with-the-ontology`,
`data-modeling`, `faq`, `concepts-glossary` →
`types-of-geospatial-and-geotemporal-data`).

This matters beyond geospatial. CLAUDE.md already says a link is not a reading
and that what is missing is missing by the section; this adds a third case —
**a section can appear missing when it has simply been renamed**, and the URL
file unions rather than prunes, so the stale entries persist. Checking for a
successor is cheaper than re-mirroring and much cheaper than concluding a topic
is undocumented.

## Decisions (2026-09-10 — NOT YET READ BY A HUMAN)

1. **Do not build the geotemporal series feature.** No published value encoding,
   a preview read endpoint, and an observation database behind it. Revisit if
   the api publishes a geotemporal `PropertyValue` row.
2. **`geotemporal_series` is `jsonb` with a CHECK**, made explicit rather than
   inherited from the `ELSE` branch.
3. **At most one GTSR per object type** — a partial unique index.
4. **Never an array** — the existing CHECK, extended.
5. **The track slots are time series**, and narrowed to refuse a declared-string
   property.
6. `geopoint` and `geoshape` are unchanged; the swap trap is recorded, not coded.

## Questions (2026-09-10)

1. **40 of 41 images are unparsed**, and the decision not to build is what makes
   that proportionate. Reversing the decision means parsing them first.
2. **The `geotimeSeries` datasource arm is published only by `api/`** — no prose
   page describes that datasource kind. If it is ever built, it is 585's shape (a
   raw external RID plus a flat properties list), not 774's (an owned sync row
   with a column mapping), because Foundry documents *creating* a time series
   sync and only *selecting* a geotemporal integration.
3. **The Geotemporal Series interface, Gaia type-mapping and
   `add-ontology-data-to-gaia`** are unread beyond what §1 needed.
4. **`readings/time-series.md` claimed `base-types` words a geotemporal property
   as "a reference to" *on purpose*.** That is unsupported: `scale-property-limits`
   calls both series types references, and the api encodes a time series value as
   `{seriesId, syncRid}` — also a reference. The distinction is not semantic.
