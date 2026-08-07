<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geoPointToGeometryV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert GeoPoint to geometry

> Supported in: Batch, Faster, Streaming

Convert GeoPoint to a GeoJSON of type point.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** A valid GeoPoint.<br>*Expression\<GeoPoint>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geoPoint`

| geoPoint | **Output** |
| ----- | ----- |
| {<br> latitude -> 58.0,<br> longitude -> 32.0,<br>} | {"type":"Point","coordinates": \[32.0, 58.0]} |
| *null* | *null* |
| {<br> latitude -> 40.753206,<br> longitude -> -73.989015,<br>} | {"type":"Point","coordinates": \[-73.989015, 40.753206]} |

***
