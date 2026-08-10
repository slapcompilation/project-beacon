<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/h3ToGeometryV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# H3 to geometry

> Supported in: Batch, Faster, Streaming

Convert H3 index to polygon.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** A valid H3 index.<br>*Expression\<H3 Index>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `h3`

| h3 | **Output** |
| ----- | ----- |
| 8029fffffffffff | {"type":"Polygon","coordinates":\[\[\[-121.3366283326517,28.653019311484535],\[-110.25748485653355,36.80... |
| 85283473fffffff | {"type":"Polygon","coordinates":\[\[\[-121.91508032705622,37.2713558667319],\[-121.86222328902491,37.353... |
| 8f2d55c256ac883 | {"type":"Polygon","coordinates":\[\[\[39.99999168658859,45.00000521415798],\[39.99999036498484,45.000000... |

***
