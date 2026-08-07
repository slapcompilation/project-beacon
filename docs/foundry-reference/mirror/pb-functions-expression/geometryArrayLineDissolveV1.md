<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryArrayLineDissolveV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry array line dissolve

> Supported in: Batch, Faster, Streaming

Given an array of geometries, combine these into a linear geometry. Dissolve simplifies an input set of line-strings by removing unnecessary nodes and concatenating line-strings that can be combined. Z-coordinates will be ignored for the purpose of the dissolve operation, but the vertices in the resultant geometry will have the same z-coordinate as the corresponding points in the input.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** An array of geometries to dissolve.<br>*Expression\<Array\<T>>*

**Type variable bounds:** *T accepts Geometry*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"LineString","coordinates":\[\[0,0],\[0,1],\[1,1]]}, {"type":"LineString","coordinates":\[\[1,1]... | {"type":"MultiLineString","coordinates":\[\[\[5.0, 5.0],\[4.0, 4.0],\[3.0, 3.0],\[2.0, 2.0],\[1.0, 1.0],\[0.0, 1.0],\[0.0, 0.0]],\[\[7.0, 7.0], \[6.0, 7.0], \[6.0, 6.0]]]} |
| \[ {"type":"LineString","coordinates":\[\[0,0,1],\[0,1,1],\[1,1,1]]}, {"type":"LineString","coordinates":\[\[1,1,1],\[2,2,2]]}, {"type":"LineString","coordinates":\[\[1,1,2],\[2,2,2],\[3,3,3]]} ] | {"type":"LineString","coordinates":\[\[0.0, 0.0, 1.0],\[0.0, 1.0, 1.0],\[1.0, 1.0, 1.0],\[2.0, 2.0, 2.0],\[3.0, 3.0, 3.0]]} |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"LineString","coordinates":\[\[0,0],\[0,1],\[1,1]]}, {"type":"Polygon","coordinates":\[\[\[2,2],\[... | {"type":"MultiLineString","coordinates":\[\[\[3.0, 3.0], \[4.0, 4.0], \[5.0, 5.0]],\[\[3.0, 3.0], \[3.0, 2.0], \[2.0, 2.0], \[2.0, 3.0], \[3.0, 3.0]],\[\[0.0, 0.0], \[0.0, 1.0], \[1.0, 1.0]]]} |

***

### Example 3: Base case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]}, {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]} ] | {"type":"MultiLineString","coordinates":\[\[\[1.0, 0.0], \[1.0, 1.0]],\[\[1.0, 1.0], \[0.0, 1.0], \[0.0, 0.0], \[1.0, 0.0]],\[\[1.0, 0.0], \[2.0, 0.0], \[2.0, 1.0], \[1.0, 1.0]]]} |

***

### Example 4: Null case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[  ] | *null* |
| *null* | *null* |

***
