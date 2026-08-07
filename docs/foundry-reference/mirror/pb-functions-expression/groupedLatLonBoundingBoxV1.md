<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/groupedLatLonBoundingBoxV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Grouped latitude/longitude bounding box

> Supported in: Batch

Returns a struct containing the entire bounding box of all valid geometries in the given column. Invalid geometries are treated as null and ignored.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** Column of geometries to compute the entire bounding box of.<br>*Expression\<Geometry>*

**Output type:** *LatLonBoundingBox*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometry`

**Given input table:**

| geometry |
| ----- |
| {"type":"LineString","coordinates":\[\[1,0],\[0,8.4]]} |
| {"type":"Point","coordinates":\[125.6, -92.3]} |
| {"type":"Polygon","coordinates":\[\[\[0,0],\[1,6.3],\[-6,1],\[0,0]]]} |

**Outputs:** {<br> maxLat -> 8.4,<br> maxLon -> 125.6,<br> minLat -> -92.3,<br> minLon -> -6.0,<br>}

***

### Example 2: Null case

**Argument values:**

* **Expression:** `geometry`

**Given input table:**

| geometry |
| ----- |
| *null* |

**Outputs:** *null*

***

### Example 3: Edge case

**Argument values:**

* **Expression:** `geometry`

**Given input table:**

| geometry |
| ----- |
| Invalid GeoJSON |
| {"type":"LineString","coordinates":\[\[2,0],\[0,4.8]]} |

**Outputs:** {<br> maxLat -> 4.8,<br> maxLon -> 2.0,<br> minLat -> 0.0,<br> minLon -> 0.0,<br>}

***
