<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/h3IndexExpressionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Get H3 index

> Supported in: Batch, Faster, Streaming

Convert GeoPoint to H3 index at given resolution. Returns null for resolution <0 or >15.

**Expression categories:** Geospatial

## Declared arguments

* **GeoPoint:** GeoPoint (lon,lat) to convert to H3 index.<br>*Expression\<GeoPoint>*
* **Resolution:** H3 grid resolution between 0 and 15 (inclusive).<br>*Expression\<Byte | Integer | Long | Short>*

**Output type:** *H3 Index*

## Examples

### Example 1: Base case

**Argument values:**

* **GeoPoint:** `point`
* **Resolution:** 5

| point | **Output** |
| ----- | ----- |
| {<br> **latitude**: -20.0,<br> **longitude**: 80.0,<br>} | 85aa614bfffffff |
| {<br> **latitude**: 38.9031,<br> **longitude**: -77.0599,<br>} | 852aa84ffffffff |

***

### Example 2: Base case

**Argument values:**

* **GeoPoint:** <br>constructGeoPoint(<br> latitude: 80.0,<br> longitude: -20.0,<br>)
* **Resolution:** 5

**Output:** 8507b297fffffff

***
