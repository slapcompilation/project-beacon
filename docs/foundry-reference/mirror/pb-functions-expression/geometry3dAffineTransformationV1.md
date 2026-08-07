<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometry3dAffineTransformationV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry 3d affine transformation

> Supported in: Batch, Faster, Streaming

Applies a three dimensional affine transformation to the input geometry. This transformation occurs in the user-provided projected coordinate system, and the result is projected back to WGS84. Two dimensional geometries will have their z-coordinates set to 0 before the affine transformation is applied. The returned geometry is three dimensional and for each coordinate \[x,y,z] represents the matrix multiplication \[\[x0, x1, x2, x-offset], \[y0, y1, y2, y-offset], \[z0, z1, z2, z-offset], \[0, 0, 0, 1]] \*  \[x, y, z, 1], where the first three ordinates of the result are returned.

**Expression categories:** Geospatial

## Declared arguments

* **Geometry column:** The geometries on which the affine transformation is applied.<br>*Expression\<String>*
* **Projected coordinate system:** Coordinate system identifier formatted as "authority:id". For example, UTM zone 18N could be identified by EPSG:32618. Geometries will be cast to the source coordinate system, have an affine transformation  applied, then re-cast to WGS84.<br>*Literal\<String>*
* *optional* **X offset:** The (0,3) value of the matrix with default 0.0. This parameter represents the distance in projected coordinates that the geometry will be translated in the positive x direction.<br>*Literal\<Double>*
* *optional* **X0:** The (0,0) value of the matrix with default 1.0.<br>*Literal\<Double>*
* *optional* **X1:** The (0,1) value of the matrix with default 0.0.<br>*Literal\<Double>*
* *optional* **X2:** The (0,2) value of the matrix with default 0.0.<br>*Literal\<Double>*
* *optional* **Y offset:** The (1,3) value of the matrix with default 0.0. This parameter represents the distance in projected coordinates that the geometry will be translated in the positive y direction.<br>*Literal\<Double>*
* *optional* **Y0:** The (1,0) value of the matrix with default 0.0.<br>*Literal\<Double>*
* *optional* **Y1:** The (1,1) value of the matrix with default 1.0.<br>*Literal\<Double>*
* *optional* **Y2:** The (1,2) value of the matrix with default 0.0.<br>*Literal\<Double>*
* *optional* **Z offset:** The (2,3) value of the matrix with default 0.0. This parameter represents the distance in projected coordinates that the geometry will be translated in the positive z direction.<br>*Literal\<Double>*
* *optional* **Z0:** The (2,0) value of the matrix with default 0.0.<br>*Literal\<Double>*
* *optional* **Z1:** The (2,1) value of the matrix with default 0.0.<br>*Literal\<Double>*
* *optional* **Z2:** The (2,2) value of the matrix with default 1.0.<br>*Literal\<Double>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326
* **X offset:** 0.0
* **X0:** 0.0
* **X1:** -1.0
* **X2:** 0.0
* **Y offset:** 0.0
* **Y0:** 1.0
* **Y1:** 0.0
* **Y2:** 0.0
* **Z offset:** 0.0
* **Z0:** 0.0
* **Z1:** 0.0
* **Z2:** 0.0

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0, 0.0],\[1.0, 0.0],\[1.0, 1.0],\[0.0, 1.0],\[0.0, 0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0, 0.0, 0.0],\[0.0, 1.0, 0.0],\[-1.0, 1.0, 0.0],\[-1.0, 0.0, 0.0],\[0.0, 0.0, 0.0]]]} |

***

### Example 2: Base case

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326
* **X offset:** 1.0
* **X0:** 0.0
* **X1:** -3.0
* **X2:** 0.0
* **Y offset:** 2.0
* **Y0:** 0.0
* **Y1:** 2.0
* **Y2:** 0.0
* **Z offset:** 3.0
* **Z0:** 0.0
* **Z1:** 0.0
* **Z2:** 1.0

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0, 0.0, 1.0],\[1.0, 0.0, 2.0],\[1.0, 1.0, 3.0],\[0.0, 1.0, 2.0],\[0.0, 0.0, 1.0]]]} | {"type":"Polygon","coordinates":\[\[\[1.0, 2.0, 4.0],\[1.0, 2.0, 5.0],\[-2.0, 4.0, 6.0],\[-2.0, 4.0, 5.0],\[1.0, 2.0, 4.0]]]} |

***

### Example 3: Base case

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326
* **X offset:** 0.0
* **X0:** 2.0
* **X1:** 0.0
* **X2:** 0.0
* **Y offset:** 0.0
* **Y0:** 0.0
* **Y1:** 3.0
* **Y2:** 0.0
* **Z offset:** 0.0
* **Z0:** 0.0
* **Z1:** 0.0
* **Z2:** 4.0

| geometry | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates":\[1.0, 2.0, 3.0]} | {"type":"Point","coordinates":\[2.0, 6.0, 12.0]} |
| {"type":"LineString","coordinates":\[\[0.0, 1.0, 1.0], \[1.0, 2.0, 3.0]]} | {"type":"LineString","coordinates":\[\[0.0, 3.0, 4.0],\[2.0, 6.0, 12.0]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0, 0.0],\[1.0, 0.0],\[1.0, 1.0],\[0.0, 1.0],\[0.0, 0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0, 0.0, 0.0],\[2.0, 0.0, 0.0],\[2.0, 3.0, 0.0],\[0.0, 3.0, 0.0],\[0.0, 0.0, 0.0]]]} |

***

### Example 4: Base case

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326
* **X offset:** 0.0
* **X0:** 1.0
* **X1:** 1.0
* **X2:** 0.0
* **Y offset:** 0.0
* **Y0:** 0.0
* **Y1:** 1.0
* **Y2:** 0.0
* **Z offset:** 0.0
* **Z0:** 0.0
* **Z1:** 0.0
* **Z2:** 0.0

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0, 0.0],\[1.0, 0.0],\[1.0, 1.0],\[0.0, 1.0],\[0.0, 0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0, 0.0, 0.0],\[1.0, 0.0, 0.0],\[2.0, 1.0, 0.0],\[1.0, 1.0, 0.0],\[0.0, 0.0, 0.0]]]} |

***

### Example 5: Base case

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326
* **X offset:** 1.0
* **X0:** 1.0
* **X1:** 0.0
* **X2:** 0.0
* **Y offset:** 1.0
* **Y0:** 0.0
* **Y1:** 1.0
* **Y2:** 0.0
* **Z offset:** 1.0
* **Z0:** 0.0
* **Z1:** 0.0
* **Z2:** 1.0

| geometry | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates":\[1.0, 2.0, 3.0]} | {"type":"Point","coordinates":\[2.0, 3.0, 4.0]} |
| {"type":"LineString","coordinates":\[\[0.0, 1.0, 2.0], \[1.0, 2.0, 3.0]]} | {"type":"LineString","coordinates":\[\[1.0, 2.0, 3.0],\[2.0, 3.0, 4.0]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0, 0.0],\[1.0, 0.0],\[1.0, 1.0],\[0.0, 1.0],\[0.0, 0.0]]]} | {"type":"Polygon","coordinates":\[\[\[1.0, 1.0, 1.0],\[2.0, 1.0, 1.0],\[2.0, 2.0, 1.0],\[1.0, 2.0, 1.0],\[1.0, 1.0, 1.0]]]} |

***

### Example 6: Null case

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **X offset:** 0.0
* **X0:** 2.0
* **X1:** 0.0
* **X2:** 0.0
* **Y offset:** 0.0
* **Y0:** 3.0
* **Y1:** 0.0
* **Y2:** 0.0
* **Z offset:** 0.0
* **Z0:** 4.0
* **Z1:** 0.0
* **Z2:** 0.0

| geometry | **Output** |
| ----- | ----- |
| *null* | *null* |

***
