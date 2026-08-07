<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isValidOntologyGeopointV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is valid Ontology GeoPoint

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid Ontology GeoPoint. Ontology GeoPoints are strings of the format '{lat},{lon}', where -90 <= lat <= 90 and -180 <= lon <= 180.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** String to test.<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geopoint`

| geopoint | **Output** |
| ----- | ----- |
| -35.307428203,149.122686883 | true |
| 149.122686883,-35.307428203 | false |
| 10.0, 20.0 | true |
|    10.0,    20.0    | true |
| not a GeoPoint | false |
| *null* | false |
| (10.0,20.0) | false |

***
