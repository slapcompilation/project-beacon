<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryLengthV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry length

> Supported in: Batch, Streaming

Get the length of the line strings and multi line strings in the geometry in meters. Uses a spherical approximation of the globe. Non-linear geometries (polygons and points) count as 0.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** GeoJSON string.<br>*Expression\<Geometry>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"LineString","coordinates":\[\[-73.778128,40.641195],\[-118.408535,33.941563]]} | 3974344.7433354934 |
| {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0],\[1.0,1.0],\[1.0,2.0]]} | 333585.2407005987 |
| {"type":"MultiLineString","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[1.0,1.0]], \[\[1.0,2.0],\[2.0,2.0]]]} | 333517.50194413937 |

***

### Example 2: Null case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 3: Edge case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"GeometryCollection","geometries":\[{"type":"Polygon","coordinates":\[\[\[-1.0,-1.0],\[-3.0,-1.0]... | 333517.50194413937 |
| {"type":"Polygon","coordinates":\[\[\[-1.0,-1.0],\[-3.0,-1.0],\[-2.0,-2.0],\[-1.0,-1.0]]]} | 0.0 |
| {"type":"MultiPoint","coordinates":\[\[23.0,30.0],\[12.0,15.3]]} | 0.0 |

***
