<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/linestringPointNV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Nth point in linestring

> Supported in: Batch, Faster, Streaming

Returns the nth point in a single linestring in the geometry. Indexing is 1-based, and an index of 0 is out-of-bounds. A negative index is counted backwards from the end of the linestring, so that -1 is the last point. Returns null for any of the following conditions: geometry isn't a single linestring, a feature collection or geometry collection is provided, index is out-of-bounds, or at least one argument is null.

**Expression categories:** Geospatial

## Declared arguments

* **Linestring:** Linestring to retrieve the nth point of.<br>*Expression\<Geometry>*
* **N:** Index of the point to retrieve. Indexing is 1-based, and an index of 0 is out-of-bounds. A negative index is counted backwards from the end of the linestring, so that -1 is the last point.<br>*Expression\<Byte | Integer | Long | Short>*

**Output type:** *GeoPoint*

## Examples

### Example 1: Base case

**Argument values:**

* **Linestring:** `linestring`
* **N:** `n`

| linestring | n | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[30.0,2.0],\[35.0,0.0],\[50.0,3.0]]} | 1 | {<br> **latitude**: 2.0,<br> **longitude**: 30.0,<br>} |
| {"type":"LineString","coordinates":\[\[30.0,2.0],\[35.0,0.0],\[50.0,3.0]]} | 3 | {<br> **latitude**: 3.0,<br> **longitude**: 50.0,<br>} |
| {"type":"LineString","coordinates":\[\[45.0,9.0],\[90.0,4.0],\[40.0,0.0]]} | -1 | {<br> **latitude**: 0.0,<br> **longitude**: 40.0,<br>} |

***

### Example 2: Null case

**Argument values:**

* **Linestring:** `linestring`
* **N:** `n`

| linestring | n | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[10.0,4.0],\[75.0,0.0]]} | *null* | *null* |
| *null* | 1 | *null* |

***

### Example 3: Edge case

**Argument values:**

* **Linestring:** `linestring`
* **N:** `n`

| linestring | n | **Output** |
| ----- | ----- | ----- |
| {"type":"MultiLineString","coordinates":\[\[\[100.0,0.0]], \[\[102.0,2.0]]]} | 2 | *null* |
| {"type":"GeometryCollection","geometries":{"type":"LineString","coordinates":\[\[10.0,4.0]]}} | 1 | *null* |
| {"type":"LineString","coordinates":\[\[10.0,4.0],\[75.0,0.0],\[25.0,3.0]]} | 0 | *null* |
| {"type":"LineString","coordinates":\[\[12.0,3.0],\[76.0,2.0],\[98.0,8.0]]} | 4 | *null* |
| {"type":"LineString","coordinates":\[\[90.0,1.0],\[34.0,1.0],\[19.0,7.0]]} | -4 | *null* |

***
