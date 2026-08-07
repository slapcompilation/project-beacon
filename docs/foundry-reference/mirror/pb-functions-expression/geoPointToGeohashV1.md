<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geoPointToGeohashV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert GeoPoint to Geohash

> Supported in: Batch, Faster, Streaming

Converts a GeoPoint to a base32-encoded Geohash with specified precision that contains the GeoPoint. For more information on Geohash, see: https://en.wikipedia.org/wiki/Geohash .

**Expression categories:** Geospatial

## Declared arguments

* **GeoPoint:** The GeoPoint to convert.<br>*Expression\<GeoPoint>*
* **Output Geohash precision:** The number of base32 characters returned in the output Geohash string.<br>*Expression\<Integer>*

**Output type:** *Geohash*

## Examples

### Example 1: Base case

**Argument values:**

* **GeoPoint:** `point`
* **Output Geohash precision:** 5

| point | **Output** |
| ----- | ----- |
| {<br> **latitude**: -20.0,<br> **longitude**: 80.0,<br>} | mu2yh |
| {<br> **latitude**: -77.0599,<br> **longitude**: 38.9031,<br>} | hf79t |
| *null* | *null* |

***

### Example 2: Base case

**Argument values:**

* **GeoPoint:** `point`
* **Output Geohash precision:** `precision`

| point | precision | **Output** |
| ----- | ----- | ----- |
| {<br> **latitude**: -20.0,<br> **longitude**: 80.0,<br>} | 5 | mu2yh |
| {<br> **latitude**: -77.0599,<br> **longitude**: 38.9031,<br>} | 3 | hf7 |
| {<br> **latitude**: -82.77450568,<br> **longitude**: -179.55742495,<br>} | 12 | 0123456789zb |
| {<br> **latitude**: 1.0,<br> **longitude**: -1.0,<br>} | 12 | ebpm9npc6m9b |
| {<br> **latitude**: 1.0,<br> **longitude**: -1.0,<br>} | *null* | *null* |

***
