<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryCentroidV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry centroid

> Supported in: Batch, Streaming

Return the centroid, or "center of mass", of the geometry using a spherical approximation of the globe. If the geometry is a collection of mixed dimensions, only the elements of the highest dimension will contribute to the centroid (e.g. in a collection of points, lines and polygons, points and lines are ignored). This operation will round to 32-bit floating point precision for coordinates in the geometry.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** Valid GeoJSON input.<br>*Expression\<Geometry>*

**Output type:** *GeoPoint*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-1.0,-1.0],\[1.0,-1.0],\[1.0,1.0],\[-1.0,1.0],\[-1.0,-1.0]]]} | {<br> **latitude**: 0.0,<br> **longitude**: 0.0,<br>} |
| {"type":"LineString","coordinates":\[\[30.0,0.0],\[35.0,0.0],\[50.0,0.0]]} | {<br> **latitude**: 0.0,<br> **longitude**: 40.0,<br>} |
| {"type":"MultiPoint","coordinates":\[\[0.0,0.0],\[0.0,1.0]]} | {<br> **latitude**: 0.5,<br> **longitude**: 0.0,<br>} |
| {"type":"MultiPoint","coordinates":\[\[160.0,0.0],\[-170.0,0.0]]} | {<br> **latitude**: 0.0,<br> **longitude**: 175.0,<br>} |
| {"type":"GeometryCollection","geometries":\[{"type":"Polygon","coordinates":\[\[\[0.0,-0.017981],\[0.0017... | {<br> **latitude**: 0.0,<br> **longitude**: 0.0,<br>} |
| {"type":"Polygon","coordinates":\[\[\[10.2010565854362,-45.0511905886321],\[10.20108119607644,-45.051242... | {<br> **latitude**: -45.05131203645637,<br> **longitude**: 10.200951037517806,<br>} |
| *null* | *null* |

***
