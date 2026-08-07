<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryBufferV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry buffer

> Supported in: Batch, Streaming

Computes the buffer of a geometry for both positive and negative buffer distances. Returns an approximate representation of all points within a given distance of the this geometric object (or for negative buffers, all points minus those within the buffer distance of the boundary). Buffer drops any z coordinates, and zero/negative distance buffers of lines and points will return null.

**Expression categories:** Geospatial

## Declared arguments

* **Buffer distance:** The buffer distance in the units of the given projected coordinate system. For single sided geometries a non-positive buffer will result in a null value being returned. For polygonal geometries a negative double-sided buffer will shrink the geometry. For linear or point geometries a non-positive buffer will return null.<br>*Expression\<Double>*
* **Geometry column:** The geometries to buffer.<br>*Expression\<String>*
* **Projected coordinate system:** Projected coordinate system to perform the buffer in, which determines the units of the "buffer distance" parameter. Geometries will be converted to this coordinate system, buffered, then converted back to WGS 84. Formatted as "authority:id", so for example, UTM zone 18N could be identified by EPSG:32618.<br>*Literal\<String>*
* *optional* **Buffer cap style:** The style of the buffer end-caps, defaults to round. If set to flat the end caps are truncated flat at the line ends, while square has the end-caps squared off at the buffer distance beyond the line ends.<br>*Enum\<Flat, Round, Square>*
* *optional* **Buffer join style:** The style of the buffer joins, defaults to round. Mitre will lead to "sharp" corners, while bevel will lead to corners being beveled (clipped off).<br>*Enum\<Bevel, Mitre, Round>*
* *optional* **Line segments per quadrant:** For round end-cap and join styles, this defines the number of line segments used to approximate a quarter circle. A sensible default is 8, which gives a maximum error of 2%. Higher values lead to more complex geometries and may degrade performance. Lower values lead to reduced smoothness in the resultant geometry.<br>*Literal\<Integer>*
* *optional* **Single or double sided:** Whether the buffer is single or double sided. The single sided options work only with linear geometries (line strings and multi-line strings) and positive buffer distances. They result in buffering only the left/right hand side of the geometry, oriented as if traveling along the points of the line from first to last. If a single-sided buffer is selected, non-linear geometries (polygons and points) will be dropped.<br>*Enum\<Double sided, Single sided: left, Single sided: right>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 8
* **Single or double sided:** `DOUBLE_SIDED`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[-77.07368071728229,38.83040844313318]} | 10.0 | {"type":"Polygon","coordinates":\[\[\[-77.07356558299462, 38.83041048767274],\[-77.07356728534256, 38.83... |
| {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318, 1],\[-77.0725293738795,38.83042888342659, 1]]} | 10.0 | {"type":"Polygon","coordinates":\[\[\[-77.07253198637027, 38.83051894052714],\[-77.07250947453703, 38.83... |
| {"type":"Polygon","coordinates":\[\[\[-77.07368071728229,38.83040844313318, 1],\[-77.0725293738795,38.83... | 10.0 | {"type":"Polygon","coordinates":\[\[\[-77.07379585155829, 38.83040639848026],\[-77.07382199292853, 38.83... |

***

### Example 2: Base case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 8
* **Single or double sided:** `DOUBLE_SIDED`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[-77.07368071728229,38.83040844313318]} | -1.0 | *null* |
| {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659]]} | -1.0 | *null* |
| {"type":"Polygon","coordinates":\[\[\[-77.07368071728229,38.83040844313318],\[-77.07370685720375,38.83130901341597],\[-77.0725293738795,38.83042888342659],\[-77.07368071728229,38.83040844313318]]]} | -1.0 | {"type":"Polygon","coordinates":\[\[\[-77.07366946524603, 38.830417653295896],\[-77.07369471254682, 38.83128747619332],\[-77.07255743103391, 38.83043739579778],\[-77.07366946524603, 38.830417653295896]]]} |
| {"type":"Polygon","coordinates":\[\[\[-77.07331719760555, 38.83072458211154],\[-77.07331719760555, 38.83... | -500.0 | *null* |

***

### Example 3: Base case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 8
* **Single or double sided:** `SINGLE_SIDED_LEFT`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659]]} | 5.0 | {"type":"Polygon","coordinates":\[\[\[-77.0725293738795, 38.83042888342659],\[-77.07368071728229, 38.830... |
| {"type":"Polygon","coordinates":\[\[\[-77.0725293738795, 38.83042888342659],\[-77.07368071728229, 38.830... | 5.0 | *null* |
| {"type":"Point","coordinates": \[-77.0725293738795, 38.83042888342659]]} | 5.0 | *null* |

***

### Example 4: Base case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 8
* **Single or double sided:** `SINGLE_SIDED_RIGHT`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659]]} | 5.0 | {"type":"Polygon","coordinates":\[\[\[-77.07368071728229, 38.83040844313318],\[-77.0725293738795, 38.830... |

***

### Example 5: Null case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 8
* **Single or double sided:** `DOUBLE_SIDED`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| *null* | 10.0 | *null* |

***

### Example 6: Null case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 8
* **Single or double sided:** `SINGLE_SIDED_LEFT`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
|  {"type": "GeometryCollection","geometries": \[{"type":"LineString","coordinates":\[\[-77.0736807172822... | 5.0 | {"type":"Polygon","coordinates":\[\[\[-77.0725293738795, 38.83042888342659],\[-77.07368071728229, 38.830... |

***

### Example 7: Edge case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `BEVEL`
* **Line segments per quadrant:** 8
* **Single or double sided:** `DOUBLE_SIDED`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659],\[-77.07370685720375,38.83130901341597],\[-77.07368071728229,38.83040844313318]]]} | 5.0 | {"type":"Polygon","coordinates":\[\[\[-77.07373828442175, 38.83040742082089],\[-77.0737644250676, 38.831... |

***

### Example 8: Edge case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `FLAT`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 8
* **Single or double sided:** `DOUBLE_SIDED`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659]]} | 5.0 | {"type":"Polygon","coordinates":\[\[\[-77.07253068012344, 38.830473911977066],\[-77.07252806763852, 38.8... |

***

### Example 9: Edge case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 12
* **Single or double sided:** `DOUBLE_SIDED`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[-77.07368071728229,38.83040844313318]} | 10.0 | {"type":"Polygon","coordinates":\[\[\[-77.07356558299462, 38.83041048767274],\[-77.0735662268165, 38.830... |

***

### Example 10: Edge case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `MITRE`
* **Line segments per quadrant:** 8
* **Single or double sided:** `DOUBLE_SIDED`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-77.07373697742014, 38.830362392304345],\[-77.07376758060177, 38.83141669950616],\[-77.072389088204, 38.83038632146655],\[-77.07373697742014, 38.830362392304345]]]} | 5.0 | {"type":"Polygon","coordinates":\[\[\[-77.07379323748556, 38.830316341450036],\[-77.0738283041888, 38.83152438555785],\[-77.07224880268927, 38.83034375933304],\[-77.07379323748556, 38.830316341450036]]]} |

***

### Example 11: Edge case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 8
* **Single or double sided:** `SINGLE_SIDED_LEFT`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[-77.07368071728229,38.83040844313318]} | -1.0 | *null* |
| {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659]]} | -1.0 | *null* |
| {"type":"Polygon","coordinates":\[\[\[-77.07368071728229,38.83040844313318],\[-77.07370685720375,38.83130901341597],\[-77.0725293738795,38.83042888342659],\[-77.07368071728229,38.83040844313318]]]} | -1.0 | *null* |

***

### Example 12: Edge case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `SQUARE`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 8
* **Single or double sided:** `DOUBLE_SIDED`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659]]} | 5.0 | {"type":"Polygon","coordinates":\[\[\[-77.07253068012344, 38.830473911977066],\[-77.0724731128864, 38.83... |

***

### Example 13: Edge case

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 8
* **Single or double sided:** `DOUBLE_SIDED`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[-77.07368071728229,38.83040844313318]} | 0.0 | *null* |
| {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659]]} | 0.0 | *null* |
| {"type":"Polygon","coordinates":\[\[\[-77.07368071728229,38.83040844313318],\[-77.07370685720375,38.83130901341597],\[-77.0725293738795,38.83042888342659],\[-77.07368071728229,38.83040844313318]]]} | 0.0 | {"type":"Polygon","coordinates":\[\[\[-77.07368071728229,38.83040844313318],\[-77.07370685720375,38.83130901341597],\[-77.0725293738795,38.83042888342659],\[-77.07368071728229,38.83040844313318]]]} |

***
