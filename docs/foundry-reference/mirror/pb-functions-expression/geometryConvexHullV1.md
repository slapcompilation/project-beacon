<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryConvexHullV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Get the convex hull of a geometry

> Supported in: Batch, Faster, Streaming

Given a valid GeoJSON input string, return a GeoJSON string that is the convex hull for the geometry. The convex hull is the smallest convex polygon containing the geometry.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** GeoJSON values for which the convex hull is calculated.<br>*Expression\<Geometry>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[2.0,0.0],\[2.0,1.0],\[1.0,1.0],\[1.0,2.0],\[0.0,2.0],\[0.0,0.0]]]} | {"type":"Polygon", "coordinates":\[\[\[0.0, 0.0], \[0.0, 2.0], \[1.0, 2.0], \[2.0, 1.0], \[2.0, 0.0], \[0.0, 0.0]]]} |
| *null* | *null* |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0, 0.0], \[0.0, 1.0], \[1.0, 0.0], \[0.0, 0.0]]]} |

***

### Example 3: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[1.0,0.0],\[1.0,1.0],\[0.0,1.0],\[0.0,0.0]]],\[\[\[2.0,0.0],\[3.0,0.0],\[3.0,1.0],\[2.0,1.0],\[2.0,0.0]]]]} | {"type":"Polygon", "coordinates":\[\[\[0.0, 0.0], \[0.0, 1.0], \[3.0, 1.0], \[3.0, 0.0],\[0.0, 0.0]]]} |

***

### Example 4: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"MultiPoint","coordinates":\[\[0.0,0.0],\[0.0,1.0],\[2.0,0.0], \[2.0,1.0]]} | {"type":"Polygon","coordinates":\[\[\[0.0, 0.0], \[0.0, 1.0], \[2.0, 1.0], \[2.0, 0.0], \[0.0, 0.0]]]} |

***
