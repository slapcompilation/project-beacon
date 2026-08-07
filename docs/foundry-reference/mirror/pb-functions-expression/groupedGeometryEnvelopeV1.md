<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/groupedGeometryEnvelopeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Grouped geometry envelope

> Supported in: Batch, Faster

Returns the envelope of all valid geometries in the given column. Invalid geometries are treated as null and ignored.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** Column of geometries to compute the envelope of.<br>*Expression\<Geometry>*

**Output type:** *Geometry*

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

**Outputs:** {"type":"Polygon","coordinates":\[\[\[-6.0,-92.3],\[-6.0,8.4],\[125.6,8.4],\[125.6,-92.3],\[-6.0,-92.3]]]}

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

**Outputs:** {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,4.8],\[2.0,4.8],\[2.0,0.0],\[0.0,0.0]]]}

***
