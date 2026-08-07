<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryToGeobufExpressionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Encode GeoJSON as Geobuf

> Supported in: Batch, Faster, Streaming

Encodes GeoJSON geometry as Geobuf.

**Expression categories:** Geospatial

## Declared arguments

* **Geometry:** Geometry to convert to Geobuf.<br>*Expression\<Geometry>*
* *optional* **Dimensions:** Number of dimensions per coordinate encoded in the Geobuf.<br>*Expression\<Integer>*
* *optional* **Precision:** Number of preserved decimals after the decimal point.<br>*Expression\<Integer>*

**Output type:** *Geobuf*

## Examples

### Example 1: Base case

**Argument values:**

* **Geometry:** `geojson`
* **Dimensions:** *null*
* **Precision:** *null*

| geojson | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates": \[32.0, 58.0]} | MgwIABoIgKDCHoCKqDc= |
| *null* | *null* |
| {"type":"Point","coordinates": \[-73.989015, 40.753206]} | MgwIABoIre7HRuzg7iY= |

***
