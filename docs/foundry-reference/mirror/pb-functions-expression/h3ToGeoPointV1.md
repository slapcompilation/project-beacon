<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/h3ToGeoPointV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert H3 index to GeoPoint

> Supported in: Batch, Faster, Streaming

Convert an H3 index into the GeoPoint representing the center of the corresponding H3 hexagon.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** The H3 index to convert to a GeoPoint.<br>*Expression\<H3 Index>*

**Output type:** *GeoPoint*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `h3`

| h3 | **Output** |
| ----- | ----- |
| 85aa614bfffffff | {<br> **latitude**: -20.040068721942628,<br> **longitude**: 79.95021089904623,<br>} |
| 852aa84ffffffff | {<br> **latitude**: 38.926035503721714,<br> **longitude**: -77.1525762709701,<br>} |

***

### Example 2: Null case

**Argument values:**

* **Expression:** `h3`

| h3 | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 3: Edge case

**Argument values:**

* **Expression:** `h3`

| h3 | **Output** |
| ----- | ----- |
| h3 | *null* |

***
