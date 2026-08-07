<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/latLonBoundingBoxV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Get lat/long bounding box struct

> Supported in: Batch, Faster, Streaming

Given a valid geometry or array of geometries, return a struct containing the bounds of the geometry or geometries.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** GeoJSON string or array of GeoJSON strings.<br>*Expression\<Array\<Geometry> | Geometry>*

**Output type:** *LatLonBoundingBox*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0]]]} | {<br> maxLat -> 1.0,<br> maxLon -> 1.0,<br> minLat -> 0.0,<br> minLon -> 0.0,<br>} |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `geometryArray`

| geometryArray | **Output** |
| ----- | ----- |
| \[ {"type":"LineString","coordinates":\[\[1,0],\[0,8.4]]}, {"type":"Point","coordinates":\[125.6, -92.3]}, {"type":"Polygon","coordinates":\[\[\[0,0],\[1,6.3],\[-6,1],\[0,0]]]} ] | {<br> maxLat -> 8.4,<br> maxLon -> 125.6,<br> minLat -> -92.3,<br> minLon -> -6.0,<br>} |

***

### Example 3: Null case

**Argument values:**

* **Expression:** `geometryArray`

| geometryArray | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 4: Edge case

**Argument values:**

* **Expression:** `geometryArray`

| geometryArray | **Output** |
| ----- | ----- |
| \[ Invalid GeoJSON, {"type":"LineString","coordinates":\[\[2,0],\[0,4.8]]} ] | {<br> maxLat -> 4.8,<br> maxLon -> 2.0,<br> minLat -> 0.0,<br> minLon -> 0.0,<br>} |

***
