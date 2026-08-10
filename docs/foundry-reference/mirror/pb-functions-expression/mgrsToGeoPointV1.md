<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/mgrsToGeoPointV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert MGRS to GeoPoint

> Supported in: Batch, Faster, Streaming

Converts a MGRS (military grid reference system) coordinate into a GeoPoint following the WGS84 coordinate system (which is EPSG:4326).

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** MGRS (military grid reference system) coordinate to convert.<br>*Expression\<MGRS>*

**Output type:** *GeoPoint*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `mgrs`

| mgrs | **Output** |
| ----- | ----- |
| ZAF0193788990 | {<br> **latitude**: 88.99999659707431,<br> **longitude**: 0.9996456505181999,<br>} |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `mgrs`

| mgrs | **Output** |
| ----- | ----- |
| 4Q FJ 12345 67890 | {<br> **latitude**: 21.409796671597924,<br> **longitude**: -157.91608117421092,<br>} |
| 4Q FJ 1 6 | {<br> **latitude**: 21.338665624760598,<br> **longitude**: -157.93921670599434,<br>} |
| 4Q FJ 123 678 | {<br> **latitude**: 21.40898645576642,<br> **longitude**: -157.91652127483704,<br>} |

***

### Example 3: Null case

**Argument values:**

* **Expression:** `mgrs`

| mgrs | **Output** |
| ----- | ----- |
| *null* | *null* |

***
