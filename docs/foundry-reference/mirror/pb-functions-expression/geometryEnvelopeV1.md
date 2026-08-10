<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryEnvelopeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Get geometry envelope

> Supported in: Batch, Streaming

Given a valid geometry or array of geometries, return a geometry representing the envelope of the input. The envelope is the smallest axis-aligned rectangular region containing the minimum and maximum x and y values of the geometry.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** GeoJSON string or array of GeoJSON strings.<br>*Expression\<Array\<Geometry> | Geometry>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `geometryArray`

| geometryArray | **Output** |
| ----- | ----- |
| \[ {"type":"LineString","coordinates":\[\[1,0],\[0,8.4]]}, {"type":"Point","coordinates":\[125.6, -92.3]}, {"type":"Polygon","coordinates":\[\[\[0,0],\[1,6.3],\[-6,1],\[0,0]]]} ] | {"type":"Polygon","coordinates":\[\[\[-6.0,-92.3],\[-6.0,8.4],\[125.6,8.4],\[125.6,-92.3],\[-6.0,-92.3]]]} |

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
| \[ Invalid GeoJSON, {"type":"LineString","coordinates":\[\[2,0],\[0,4.8]]} ] | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,4.8],\[2.0,4.8],\[2.0,0.0],\[0.0,0.0]]]} |

***
