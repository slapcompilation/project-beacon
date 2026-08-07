<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/createGeoLineStringV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create linestring geometry

> Supported in: Batch, Streaming

Creates a GeoJSON linestring geometry from the given points.

**Expression categories:** Geospatial

## Declared arguments

* **Points:** The points that make up the linestring.<br>*Expression\<Array\<T>>*

**Type variable bounds:** *T accepts Struct\<longitude:Double, latitude:Double>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Points:** `points`

| points | **Output** |
| ----- | ----- |
| \[ {<br> **latitude**: 10.0,<br> **longitude**: 0.0,<br>}, {<br> **latitude**: 10.0,<br> **longitude**: 10.0,<br>} ] | {"type":"LineString","coordinates":\[\[0.0,10.0],\[10.0,10.0]]} |
| \[ {<br> **latitude**: 10.0,<br> **longitude**: 10.0,<br>}, {<br> **latitude**: 20.0,<... | {"type":"LineString","coordinates":\[\[10.0,10.0],\[20.0,20.0],\[30.0,30.0]]} |
| \[ {<br> **latitude**: 0.0,<br> **longitude**: 179.0,<br>}, {<br> **latitude**: 0.0,<br> **longitude**: 181.0,<br>} ] | {"type":"MultiLineString","coordinates":\[\[\[179.0,0.0],\[180.0,0.0]],\[\[-180.0,0.0],\[-179.0,0.0]]]} |
| \[ {<br> **latitude**: 0.0,<br> **longitude**: -179.0,<br>}, {<br> **latitude**: 0.0,<br> **longitude**: -181.0,<br>} ] | {"type":"MultiLineString","coordinates":\[\[\[180.0,0.0],\[179.0,0.0]],\[\[-179.0,0.0],\[-180.0,0.0]]]} |

***

### Example 2: Null case

**Argument values:**

* **Points:** `points`

| points | **Output** |
| ----- | ----- |
| *null* | *null* |
| \[ {<br> **latitude**: 0.0,<br> **longitude**: 0.0,<br>}, *null* ] | *null* |

***

### Example 3: Edge case

**Argument values:**

* **Points:** `points`

| points | **Output** |
| ----- | ----- |
| \[  ] | *null* |
| \[ {<br> **latitude**: 0.0,<br> **longitude**: 0.0,<br>} ] | *null* |

***
