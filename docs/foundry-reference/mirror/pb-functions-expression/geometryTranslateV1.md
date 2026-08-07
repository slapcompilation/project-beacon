<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryTranslateV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry translate expression

> Supported in: Batch, Faster, Streaming

Applies a translation to a geometry. Two dimensional geometries are only converted to three dimensional geometries if a z offset is supplied.

**Expression categories:** Geospatial

## Declared arguments

* **Geometry column:** The geometries to be translated.<br>*Expression\<String>*
* **Projected coordinate system:** Coordinate system identifier formatted as "authority:id". For example, UTM zone 18N could be identified by EPSG:32618. Geometries will be cast to the source coordinate system, have a translation applied, then re-cast to WGS84.<br>*Literal\<String>*
* **X offset:** The distance in the coordinate reference system that the geometry will be translated in the positive x direction.<br>*Literal\<Double>*
* **Y offset:** The distance in the coordinate reference system that the geometry will be translated in the positive y direction.<br>*Literal\<Double>*
* *optional* **Z offset:** The distance in the coordinate reference system that the geometry will be translated in the positive z direction.<br>*Literal\<Double>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326
* **X offset:** 1.0
* **Y offset:** -1.0
* **Z offset:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates":\[0.0, 0.0]} | {"type":"Point","coordinates":\[1.0, -1.0]} |
| {"type":"LineString","coordinates":\[\[0.0, 0.0], \[1.0, 1.0]]} | {"type":"LineString","coordinates":\[\[1.0, -1.0], \[2.0, 0.0]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0, 0.0],\[1.0, 0.0],\[1.0, 1.0],\[0.0, 1.0], \[0.0, 0.0]]]} | {"type":"Polygon","coordinates":\[\[\[1.0, -1.0],\[2.0, -1.0],\[2.0, 0.0],\[1.0, 0.0],\[1.0, -1.0]]]} |

***

### Example 2: Base case

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326
* **X offset:** 1.0
* **Y offset:** -1.0
* **Z offset:** 1.0

| geometry | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates":\[0.0, 0.0]} | {"type":"Point","coordinates":\[1.0, -1.0, 1.0]} |
| {"type":"LineString","coordinates":\[\[0.0, 0.0], \[1.0, 1.0]]} | {"type":"LineString","coordinates":\[\[1.0, -1.0, 1.0], \[2.0, 0.0, 1.0]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0, 0.0],\[1.0, 0.0],\[1.0, 1.0],\[0.0, 1.0], \[0.0, 0.0]]]} | {"type":"Polygon","coordinates":\[\[\[1.0, -1.0, 1.0],\[2.0, -1.0, 1.0],\[2.0, 0.0, 1.0],\[1.0, 0.0, 1.0],\[1.0, -1.0, 1.0]]]} |

***

### Example 3: Base case

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326
* **X offset:** 1.0
* **Y offset:** -1.0
* **Z offset:** 1.0

| geometry | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates":\[0.0, 0.0, -1.0]} | {"type":"Point","coordinates":\[1.0, -1.0, 0.0]} |
| {"type":"LineString","coordinates":\[\[0.0, 0.0, -1.0], \[1.0, 1.0, -1.0]]} | {"type":"LineString","coordinates":\[\[1.0, -1.0, 0.0], \[2.0, 0.0, 0.0]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0, 0.0, -1.0],\[1.0, 0.0, -1.0],\[1.0, 1.0, -1.0],\[0.0, 1.0, -1.0],\[0.0, 0.0, -1.0]]]} | {"type":"Polygon","coordinates":\[\[\[1.0, -1.0, 0.0],\[2.0, -1.0, 0.0],\[2.0, 0.0, 0.0],\[1.0, 0.0, 0.0],\[1.0, -1.0, 0.0]]]} |

***

### Example 4: Base case

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **X offset:** 100.0
* **Y offset:** -200.0
* **Z offset:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates":\[-77.0, 20.0]} | {"type":"Point","coordinates":\[-76.99902180032066, 19.99820455178219]} |

***

### Example 5: Null case

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326
* **X offset:** 1.0
* **Y offset:** -1.0
* **Z offset:** 1.0

| geometry | **Output** |
| ----- | ----- |
| *null* | *null* |

***
