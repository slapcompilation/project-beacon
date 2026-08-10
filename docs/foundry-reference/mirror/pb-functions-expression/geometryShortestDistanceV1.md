<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryShortestDistanceV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry shortest distance

> Supported in: Batch, Streaming

Given two valid geometries, calculates the shortest (great circle) distance in meters between them. Uses a spherical approximation of the globe. Overlapping geometries have a distance of zero.

**Expression categories:** Geospatial

## Declared arguments

* **Geometry a:** Geometry a.<br>*Expression\<Geometry>*
* **Geometry b:** Geometry b.<br>*Expression\<Geometry>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[-40, 0],\[-30, 0]]}} | {"type":"Polygon","coordinates":\[\[\[-30,-30],\[-30, 30],\[30, 30],\[30, -30],\[-30, -30]]]} | 0.0 |
| {"type":"Point","coordinates":\[0,0]}} | {"type":"Polygon","coordinates":\[\[\[-30,-30],\[-30, 30],\[30, 30],\[30, -30],\[-30, -30]]]} | 0.0 |
| {"type":"Point","coordinates":\[-30,29]}} | {"type":"Polygon","coordinates":\[\[\[-30,-30],\[-30, 30],\[30, 30],\[30, -30],\[-30, -30]]]} | 0.0 |
| {"type":"Polygon","coordinates":\[\[\[40,0],\[-40,0],\[0,40],\[40,0]]]} | {"type":"Polygon","coordinates":\[\[\[-30,-30],\[-30, 30],\[30, 30],\[30,-30],\[-30,-30]]]} | 0.0 |
| {"type":"Polygon","coordinates":\[\[\[-40,0],\[40,0],\[0,40],\[-40,0]]]} | {"type":"Polygon","coordinates":\[\[\[-30,-30],\[-30,0],\[30,0],\[30,-30],\[-30,-30]]]} | 0.0 |

***

### Example 2: Base case

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[87.0,77.0]},{"type":"LineString","coordinates":\[\[80.0,0],\[90.0,0]]}]} | {"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[70.0,-100.0]},{"type":"Lin... | 39438.65354637 |
| {"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[170,90]},{"type":"LineStri... | {"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[-87,-73]},{"type":"LineStr... | 5310295.471462 |
| {"type":"GeometryCollection","geometries":\[{"type":"MultiPoint","coordinates":\[\[170,90],\[171,91]]},{... | {"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[-87,-73]},{"type":"LineStr... | 5327143.5044855 |

***

### Example 3: Base case

**Description:** Case where one geometry is a point and the other is an arbitrary GeometryCollection. The expression should identify that the shortest distance between the point and the geometry lies on the middle of one of the polygon's sides.

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[1,24]} | {"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[70.0,-100.0]},{"type":"Lin... | 3285803.956493 |
| {"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[70.0,-100.0]},{"type":"Lin... | {"type":"Point","coordinates":\[1.0,-14.0]} | 1227726.9895314 |

***

### Example 4: Base case

**Description:** Base case where the shortest path from the point to the line is a great-circle line to a point in the interior of the LineString (not the endpoints)

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[1,23]} | {"type":"LineString","coordinates":\[\[51.93,95.6],\[-43.7,22.2]]}} | 4557966.282534 |

***

### Example 5: Base case

**Description:** Base case where the shortest path from the point to the line is a line to an endpoint of the LineString. In particular, it should evaluate the distance to the first point of the LineString.

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[171,23]} | {"type":"LineString","coordinates":\[\[-174,21],\[-43.7,22.2]]} | 1561650.083282 |

***

### Example 6: Base case

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[12.3,45.6]} | {"type":"Point","coordinates":\[3,3.5]} | 4767896.596327 |
| {"type":"Point","coordinates":\[-172.45613,-80]} | {"type":"Point","coordinates":\[7.54387,-80]} | 2223902.02355 |

***

### Example 7: Base case

**Description:** Base case where the shortest path from the point to the line is a great-circle line to a point in the interior of one of the Polygon's sides (not its corners)

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[1,23]} | {"type":"Polygon","coordinates":\[\[\[33.969414,27.763400],\[20.325411,69.748301],\[37.607794,71.926251],\[47.741855,42.169452],\[33.969414,27.763400]]]} | 3328300.4609136 |
| {"type":"Point","coordinates":\[36.06123680798,52.664515483941]} | {"type":"Polygon","coordinates":\[\[\[33.969414,27.7634],\[47.741855,42.169452],\[37.607794,71.926251],\[2... | 67765.90969341 |

***

### Example 8: Base case

**Description:** Case where the shortest path from the point to the line is a line to a corner of the Polygon.

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[1,23]} | {"type":"Polygon","coordinates":\[\[\[-31.224246,67.357277],\[-4.635177,38.608765],\[-12.085376,85.774983],\[-31.224246,67.357277]]]} | 1816109.959427 |

***

### Example 9: Null case

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| hello, world! | {"type":"Point","coordinates":\[0.0,0.0]} | *null* |

***

### Example 10: Null case

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| *null* | {"type":"Point","coordinates":\[]} | *null* |
| {} | {"type":"Point","coordinates":\[]} | *null* |
| *null* | *null* | *null* |

***

### Example 11: Edge case

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[19.409686726843,-10.140156318979]} | {"type":"Point","coordinates":\[-160.590313273157, 10.140156318979]} | 2.0015118211947E7 |
| {"type":"Point","coordinates":\[69,-90]} | {"type":"Point","coordinates":\[0,90]} | 2.0015118211947E7 |

***
