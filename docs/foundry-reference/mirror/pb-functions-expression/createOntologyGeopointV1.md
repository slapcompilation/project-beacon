<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/createOntologyGeopointV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert to Ontology GeoPoint

> Supported in: Batch, Faster, Streaming

Convert a GeoPoint into a string that the Ontology will accept for a geo-indexed column (a geohash type column). Ontology GeoPoints are strings of the format '{lat},{lon}', where -90 <= lat <= 90 and -180 <= lon <= 180.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** GeoPoint to convert.<br>*Expression\<GeoPoint>*

**Output type:** *Ontology GeoPoint*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `point`

| point | **Output** |
| ----- | ----- |
| {<br> **latitude**: -20.0,<br> **longitude**: 80.0,<br>} | -20.0000000,80.0000000 |
| {<br> **latitude**: 38.9031,<br> **longitude**: -77.0599,<br>} | 38.9031000,-77.0599000 |
| {<br> **latitude**: 41.987654321,<br> **longitude**: -99.123456789,<br>} | 41.9876543,-99.1234568 |
| *null* | *null* |

***
