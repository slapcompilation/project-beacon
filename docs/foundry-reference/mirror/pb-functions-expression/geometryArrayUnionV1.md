<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryArrayUnionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry array (unary) union

> Supported in: Batch, Faster, Streaming

Given an array of geometries, combine these into a single geometry, merging without overlap.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** An array of geometries to union.<br>*Expression\<Array\<T>>*

**Type variable bounds:** *T accepts Geometry*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]}, {"type":"Polygon","coordinates":\[\[\[0.5,0.0],\[1.5,0.0],\[1.5,1.0],\[0.5,1.0],\[0.5,0.0]]]} ] | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[0.5,1.0],\[1.0,1.0],\[1.5,1.0],\[1.5,0.0],\[1.0,0.0],\[0.5,0.0],\[0.0,0.0]]]} |
| \[  ] | *null* |
| *null* | *null* |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]}, {"type":"P... | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |

***

### Example 3: Base case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]}, {"type":"Polygon","coordinates":\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]} ] | {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]],\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]]} |

***

### Example 4: Base case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]}, {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]} ] | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0],\[0.0,0.0]]]} |

***

### Example 5: Base case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]}, {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]} ] | {"type":"GeometryCollection","geometries":\[{"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]},{"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]}]} |

***

### Example 6: Edge case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]}, {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]} ] | {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]} |

***

### Example 7: Edge case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]} ] | {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]} |

***

### Example 8: Edge case

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]}, {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0]]]} ] | {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]} |

***
