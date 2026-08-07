<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isValidGeoJsonV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is valid GeoJSON

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid GeoJSON input string. Not all GeoJSON strings are indexable by the ontology; use the "prepare geometry" expression to prepare geometry prior to Ontology use.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** GeoJSON to check. Note that not all GeoJSON strings are indexable by the Ontology; use the "prepare geometry" expression to prepare geometry prior to Ontology use.<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geoJson`

| geoJson | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates":\[3.0, 5.0, 2.0]} | true |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]]]} | true |
| {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]} | true |
| not a GeoJSON string | false |

***
