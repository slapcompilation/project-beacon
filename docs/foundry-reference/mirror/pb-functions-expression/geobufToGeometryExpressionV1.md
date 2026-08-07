<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geobufToGeometryExpressionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Decode Geobuf as GeoJSON

> Supported in: Batch, Streaming

Decode Geobuf geometry as GeoJSON.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** Geobuf geometry to decode.<br>*Expression\<Geobuf>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geobuf`

| geobuf | **Output** |
| ----- | ----- |
| MgwIABoIgKDCHoCKqDc= | {"type":"Point","coordinates": \[32.0, 58.0]} |
| *null* | *null* |
| MgwIABoIre7HRuzg7iY= | {"type":"Point","coordinates": \[-73.989015, 40.753206]} |

***
