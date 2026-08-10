<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geoPointToMgrsV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert GeoPoint to MGRS

> Supported in: Batch, Faster, Streaming

Converts a GeoPoint following the WGS84 coordinate system (which is EPSG:4326) to a MGRS (military grid reference system) coordinate. The output MGRS will follow a space-delimited format with 5 digits of precision.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** GeoPoint to convert.<br>*Expression\<GeoPoint>*

**Output type:** *MGRS*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geoPoint`

| geoPoint | **Output** |
| ----- | ----- |
| {<br> latitude -> 88.99999659707431,<br> longitude -> 0.9996456505181999,<br>} | Z AF 01937 88990 |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `geoPoint`

| geoPoint | **Output** |
| ----- | ----- |
| {<br> latitude -> 21.409796671597924,<br> longitude -> -157.91608117421092,<br>} | 4Q FJ 12345 67889 |
| {<br> latitude -> 21.338665624760598,<br> longitude -> -157.93921670599434,<br>} | 4Q FJ 10000 59999 |
| {<br> latitude -> 21.40898645576642,<br> longitude -> -157.91652127483704,<br>} | 4Q FJ 12300 67799 |

***

### Example 3: Null case

**Argument values:**

* **Expression:** `geoPoint`

| geoPoint | **Output** |
| ----- | ----- |
| *null* | *null* |

***
