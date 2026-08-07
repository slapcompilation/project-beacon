<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/ontologyGeopointToGeopointV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert from Ontology GeoPoint

> Supported in: Batch, Faster, Streaming

Convert an Ontology GeoPoint into a regular GeoPoint. Ontology GeoPoints are strings of the format '{lat},{lon}', where -90 <= lat <= 90 and -180 <= lon <= 180. Regular GeoPoints are structures of the format {"longitude": {long},"latitude": {lat}}.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** Ontology GeoPoint to convert.<br>*Expression\<Ontology GeoPoint>*

**Output type:** *GeoPoint*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geopoint`

| geopoint | **Output** |
| ----- | ----- |
| -20.0000000,80.0000000 | {<br> **latitude**: -20.0,<br> **longitude**: 80.0,<br>} |
| 38.9031000,-77.0599000 | {<br> **latitude**: 38.9031,<br> **longitude**: -77.0599,<br>} |
| 41.9876543,-99.1234568 | {<br> **latitude**: 41.9876543,<br> **longitude**: -99.1234568,<br>} |

***

### Example 2: Null case

**Argument values:**

* **Expression:** `geopoint`

| geopoint | **Output** |
| ----- | ----- |
| 38.9031000, 41.9876543, 80.0000000 | *null* |
| A, 41.9876543 | *null* |
| this is a, test string | *null* |
| *null* | *null* |

***
