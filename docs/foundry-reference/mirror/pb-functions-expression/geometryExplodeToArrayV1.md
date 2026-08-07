<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryExplodeToArrayV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry explode to array

> Supported in: Batch, Faster, Streaming

Converts a geometry to an array of its constituent simple geometries.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** The geometry to explode.<br>*Expression\<Geometry>*

**Output type:** *Array\<Geometry>*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | \[ {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} ] |
| {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]],\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]]} | \[ {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]}, {"type":"Polygon","coordinates":\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]} ] |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type": "GeometryCollection", "geometries": \[{"type": "MultiPoint", "coordinates": \[\[0, 0], \[1, 1]]}, {"type": "Polygon", "coordinates": \[\[\[0, 0], \[0, 1], \[1, 1], \[1, 0], \[0, 0]]]}]} | \[ {"type":"Point","coordinates":\[0.0,0.0]}, {"type":"Point","coordinates":\[1.0,1.0]}, {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} ] |

***

### Example 3: Null case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| *null* | *null* |

***
