<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/interpolateGeoPointAlongLinestringV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Interpolate geo point along linestring

> Supported in: Batch, Streaming

Returns a point interpolated along a line. Implementation interprets lines as the shortest path, using a spherical approximation of the globe.

**Expression categories:** Geospatial

## Declared arguments

* **Fraction:** Fraction of the total length of the linestring at which to pull a geo point, starting from the beginning of the linestring. Must be a float between 0 and 1.<br>*Expression\<Decimal | Double | Float>*
* **Linestring:** Linestring along which to interpolate a geo point.<br>*Expression\<Geometry>*

**Output type:** *GeoPoint*

## Examples

### Example 1: Base case

**Argument values:**

* **Fraction:** `fraction`
* **Linestring:** `linestring`

| linestring | fraction | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[0.0,2.0],\[30.0,0.0]]} | 0.5 | {<br> **latitude**: 1.0352686301676643,<br> **longitude**: 15.004677545504547,<br>} |
| {"type":"LineString","coordinates":\[\[30.0,2.0],\[50.0,3.0]]} | 0.8 | {<br> **latitude**: 2.8256098405656185,<br> **longitude**: 45.99752305664789,<br>} |
| {"type":"LineString","coordinates":\[\[45.0,9.0],\[90.0,4.0]]} | 0.2 | {<br> **latitude**: 8.363732883448177,<br> **longitude**: 54.073497456494955,<br>} |

***

### Example 2: Base case

**Argument values:**

* **Fraction:** `fraction`
* **Linestring:** `linestring`

| linestring | fraction | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[0.0,2.0],\[30.0,0.0]]} | 0.5 | {<br> **latitude**: 1.0352686301676643,<br> **longitude**: 15.004677545504547,<br>} |
| {"type":"LineString","coordinates":\[\[30.0,2.0],\[50.0,3.0]]} | 0.8 | {<br> **latitude**: 2.8256098405656185,<br> **longitude**: 45.99752305664789,<br>} |
| {"type":"LineString","coordinates":\[\[45.0,9.0],\[90.0,4.0]]} | 0.2 | {<br> **latitude**: 8.363732883448177,<br> **longitude**: 54.073497456494955,<br>} |

***

### Example 3: Base case

**Argument values:**

* **Fraction:** `fraction`
* **Linestring:** `linestring`

| linestring | fraction | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[0.0,2.0],\[30.0,0.0]]} | 0.5 | {<br> **latitude**: 1.0352686301676643,<br> **longitude**: 15.004677545504547,<br>} |
| {"type":"LineString","coordinates":\[\[30.0,2.0],\[50.0,3.0]]} | 0.8 | {<br> **latitude**: 2.825609851378893,<br> **longitude**: 45.99752329517703,<br>} |
| {"type":"LineString","coordinates":\[\[45.0,9.0],\[90.0,4.0]]} | 0.2 | {<br> **latitude**: 8.363732872387065,<br> **longitude**: 54.0734975914614,<br>} |

***

### Example 4: Null case

**Argument values:**

* **Fraction:** `fraction`
* **Linestring:** `linestring`

| linestring | fraction | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[10.0,4.0],\[75.0,0.0]]} | *null* | *null* |
| {"type":"LineString","coordinates":\[\[10.0,8.0],\[35.0,0.0]]} | -0.5 | *null* |
| {"type":"LineString","coordinates":\[\[10.0,8.0],\[35.0,0.0]]} | 1.6 | *null* |
| {"type":"MultiLineString","coordinates":\[\[\[100.0,0.0]], \[\[102.0,2.0]]]} | 0.4 | *null* |
| {"type":"GeometryCollection","geometries":{"type":"LineString","coordinates":\[\[10.0,4.0]]}} | 0.5 | *null* |
| *null* | 1.0 | *null* |

***

### Example 5: Edge case

**Description:** Fraction values of 0 return a GeoPoint at the start point and fraction values of 1 return a GeoPoint at the end point. There exist floating point errors but should be precise enough for almost all use cases.

**Argument values:**

* **Fraction:** `fraction`
* **Linestring:** `linestring`

| linestring | fraction | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[10.0,4.0],\[75.0,0.0]]} | 0.0 | {<br> **latitude**: 4.0,<br> **longitude**: 9.999999999999998,<br>} |
| {"type":"LineString","coordinates":\[\[10.0,8.0],\[35.0,0.0]]} | 1.0 | {<br> **latitude**: 0.0,<br> **longitude**: 35.0,<br>} |
| {"type":"LineString","coordinates":\[\[10.0,8.4],\[35.0,0.0],\[163.0,67.9]]} | 1.0 | {<br> **latitude**: 67.90000000000002,<br> **longitude**: 163.0,<br>} |
| {"type":"LineString","coordinates":\[\[10.0,8.4],\[35.0,0.0],\[163.0,67.9]]} | 0.0 | {<br> **latitude**: 8.400000000000002,<br> **longitude**: 9.999999999999998,<br>} |

***
