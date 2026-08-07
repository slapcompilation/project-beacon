<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/normalizeGeometryV4/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Prepare geometry

> Supported in: Batch, Streaming

Prepares a geometry for downstream use, for example indexing to the ontology, by converting a geometry string into valid GeoJSON. Polygons will be closed and deduplicated. Geometries which cross the anti-meridian (as indicated by width > 180 degrees) will be split into multiple features on each side of the anti-meridian. By default, this operation will return the converted geometry, or null if the string cannot be converted. Alternatively, in the "show errors" output mode, this operation will instead output a struct containing either the successfully parsed output or a descriptive error message.

**Expression categories:** Geospatial

## Declared arguments

* **Geometry string:** Geometry string to be parsed and converted to GeoJSON.<br>*Expression\<String>*
* *optional* **Output mode:** Choose to output as a simple output where the output is the resulting geometry and errors are returned as null, or output a struct with two fields: an "ok" field with the resulting geometry if it can be converted; otherwise, an "error" field containing a descriptive error message.<br>*Enum\<Simple, With errors>*

**Output type:** *Geometry | Struct\<ok:Geometry, error:String>*

## Examples

### Example 1: Base case

**Argument values:**

* **Geometry string:** `geometry`
* **Output mode:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[10.0,0.0],\[10.0,10.0],\[0.0,10.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0,1.0],\[1.0,0.0,1.0],\[0.0,1.0,1.0],\[0.0,0.0,1.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0,1.0],\[0.0,1.0,1.0],\[1.0,0.0,1.0],\[0.0,0.0,1.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0], \[0.0,1.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0], \[1.0,0.0], \[0.0,1.0], \[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[179.0,-30.0],\[-179.0,-30.0],\[-179.0,30.0],\[179.0,30.0],\[179.0,-30]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[-180.0,-30.0],\[-180.0,30.0],\[-179.0,30.0],\[-179.0,-30.0],\[-180.0,-30.0]]],\[\[\[180.0,30.0],\[180.0,-30.0],\[179.0,-30.0],\[179.0,30.0],\[180.0,30.0]]]]} |
| {"type":"LineString","coordinates":\[\[179.0,30.0],\[-179.0,30.0]]} | {"type":"MultiLineString","coordinates":\[\[\[179.0,30.0],\[180.0,30.0]],\[\[-180.0,30.0],\[-179.0,30.0]]]} |
| {"type":"GeometryCollection","geometries":\[{"type":"LineString","coordinates":\[\[40.0,10.0],\[0.0,1.0]... | {"type":"GeometryCollection","geometries":\[{"type":"LineString","coordinates":\[\[40.0,10.0],\[0.0,1.0]... |
| {"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[1.0,0.0]},{"type":"LineString","coordinates":\[\[179.0,30.0],\[-179.0,30.0]]}]} | {"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[1.0,0.0]},{"type":"MultiLineString","coordinates":\[\[\[179.0,30.0],\[180.0,30.0]],\[\[-180.0,30.0],\[-179.0,30.0]]]}]} |
| {"type":"GeometryCollection","geometries":\[{"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]}... | {"type":"MultiLineString","coordinates":\[\[\[0.0,0.0],\[1.0,0.0]],\[\[1.0,1.0],\[2.0,1.0]]]} |
| {"type":"GeometryCollection","geometries":\[{"type":"MultiLineString","coordinates":\[\[\[0.0,0.0],\[1.0,0.0]],\[],\[\[1.0,1.0],\[2.0,1.0]]]},{"type":"MultiPoint","coordinates":\[\[0.0,0.0],\[1.0,1.0]]}]} | {"geometries":\[{"coordinates":\[\[\[0.0,0.0],\[1.0,0.0]],\[\[1.0,1.0],\[2.0,1.0]]],"type":"MultiLineString"},{"coordinates":\[\[0.0,0.0],\[1.0,1.0]],"type":"MultiPoint"}],"type":"GeometryCollection"} |
| {"type":"MultiPolygon","coordinates":\[\[\[\[1.0,1.0],\[2.0,1.0],\[2.0,2.0],\[1.0,2.0],\[1.0,1.0]]],\[\[]],\[\[\[10.0,10.0],\[20.0,10.0],\[20.0,20.0],\[10.0,20.0],\[10.0,10.0]]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[1.0,2.0],\[2.0,2.0],\[2.0,1.0],\[1.0,1.0],\[1.0,2.0]]],\[\[\[10.0,20.0],\[20.0,20.0],\[20.0,10.0],\[10.0,10.0],\[10.0,20.0]]]]} |

***

### Example 2: Base case

**Argument values:**

* **Geometry string:** `geometry`
* **Output mode:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"type":"MultiPolygon","coordinates":\[\[\[\[102.0,2.0],\[102.0,3.0],\[103.0,3.0],\[103.0,2.0],\[102.0,2.0]]]]} | {"type":"Polygon","coordinates":\[\[\[102.0,2.0],\[102.0,3.0],\[103.0,3.0],\[103.0,2.0],\[102.0,2.0]]]} |
| {"type":"MultiPolygon","coordinates":\[\[\[]],\[\[\[102.0,2.0],\[103.0,2.0],\[103.0,3.0],\[102.0,3.0],\[102.0,2.0]]]]} | {"type":"Polygon","coordinates":\[\[\[102.0,2.0],\[102.0,3.0],\[103.0,3.0],\[103.0,2.0],\[102.0,2.0]]]} |
| {"type":"FeatureCollection","features":\[{"geometry":{"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,0.0],\[0.0,0.0]]]]},"properties":{"gaccname":"namehere"},"type":"Feature"}]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |
| {"type":"GeometryCollection","geometries":\[{"type":"LineString","coordinates":\[\[40.0,11.0],\[0.0,1.0]]},{"type":"LineString","coordinates":\[\[10.0,10.0],\[20.0,20.0],\[10.0,40.0]]}]} | {"type":"MultiLineString","coordinates":\[\[\[40.0,11.0],\[0.0,1.0]],\[\[10.0,10.0],\[20.0,20.0],\[10.0,40.0]]]} |

***

### Example 3: Base case

**Argument values:**

* **Geometry string:** `geometry`
* **Output mode:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,1.0],\[0.0,1.0], \[1.0,0.0], \[0.0,0.0]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[0.5,0.5],\[1.0,0.0],\[0.0,0.0]]],\[\[\[0.5,0.5],\[0.0,1.0],\[1.0,1.0],\[0.5,0.5]]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[2.0,0.0],\[1.0,1.0],\[2.0,2.0],\[0.0,2.0],\[1.0,1.0],\[0.0,0.0]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[1.0,1.0],\[2.0,0.0],\[0.0,0.0]]],\[\[\[1.0,1.0],\[0.0,2.0],\[2.0,2.0],\[1.0,1.0]]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[2.0,0.0],\[2.0,2.0],\[0.0,2.0],\[0.0,0.0]],\[\[0.0,0.0],\[2.0,0.0],\[1.0,1.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,2.0],\[2.0,2.0],\[2.0,0.0],\[1.0,1.0],\[0.0,0.0],\[0.0,2.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[1.0,1.0],\[0.0,1.0],\[0.0,0.0]],\[\[3.0,3.0],\[4.0,3.0],\[4.0,4.0],\[3.0,4.0],\[3.0,3.0]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0],\[0.0,1.0]]],\[\[\[3.0,4.0],\[4.0,4.0],\[4.0,3.0],\[3.0,3.0],\[3.0,4.0]]]]} |

***

### Example 4: Null case

**Argument values:**

* **Geometry string:** `geometry`
* **Output mode:** `with_errors`

| geometry | **Output** |
| ----- | ----- |
| *null* | {<br> **error**: Input is null,<br> **ok**: *null*,<br>} |
| Not geojson | {<br> **error**: Input string could not be parsed as GeoJSON,<br> **ok**: *null*,<br>} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0,1.0],\[0.0,1.0],\[0.0,0.0]]]} | {<br> **error**: Coordinate dimension is mixed,<br> **ok**: *null*,<br>} |
| {"type":"LineString","coordinates":\[\[0.0,0.0]]} | {<br> **error**: Invalid number of points in LineString (found 1 - must be 0 or >= 2),<br> **ok**: *null*,<br>} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,91.0],\[0.0,1.0],\[0.0,0.0]]]} | {<br> **error**: Coordinates out-of-bounds. Latitudes must fall in \[-90, 90] and longitudes in \[-180, 180],<br> **ok**: *null*,<br>} |
| {"type":"Polygon","coordinates":\[\[\[0.0,-90.1],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]]]} | {<br> **error**: Coordinates out-of-bounds. Latitudes must fall in \[-90, 90] and longitudes in \[-180, 180],<br> **ok**: *null*,<br>} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[181.0,89.0],\[0.0,1.0],\[0.0,0.0]]]} | {<br> **error**: Coordinates out-of-bounds. Latitudes must fall in \[-90, 90] and longitudes in \[-180, 180],<br> **ok**: *null*,<br>} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[-182.0,89.0],\[0.0,1.0],\[0.0,0.0]]]} | {<br> **error**: Coordinates out-of-bounds. Latitudes must fall in \[-90, 90] and longitudes in \[-180, 180],<br> **ok**: *null*,<br>} |
| {"type":"Polygon","coordinates":\[]} | {<br> **error**: Expected polygon to contain at least one ring,<br> **ok**: *null*,<br>} |

***

### Example 5: Null case

**Argument values:**

* **Geometry string:** `geometry`
* **Output mode:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[]]} | *null* |

***

### Example 6: Edge case

**Argument values:**

* **Geometry string:** `geometry`
* **Output mode:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"coordinates": \[\[\[-191.9065788394177,5.453742403668187],\[-191.9065788394177,-11.163604962907428],\[-... | {"type":"MultiPolygon","coordinates":\[\[\[\[-180.0,-11.163604962907428],\[-180.0,5.453742403668187],\[-15... |

***

### Example 7: Edge case

**Argument values:**

* **Geometry string:** `geometry`
* **Output mode:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"type":"LineString","coordinates":\[\[1.0, 1.0], \[1.0, 1.0], \[1.0, 1.0]]} | {"type":"Point","coordinates":\[1.0,1.0]} |

***

### Example 8: Edge case

**Argument values:**

* **Geometry string:** `geometry`
* **Output mode:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,0.0]]],\[\[\[102.0,2.0],\[103.0,2.0],\[103.0,3.0],\[102.0,3.0],\[102.0,2.0]]]]} | {"type":"GeometryCollection","geometries":\[{"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]},{"type":"Polygon","coordinates":\[\[\[102.0,2.0],\[102.0,3.0],\[103.0,3.0],\[103.0,2.0],\[102.0,2.0]]]}]} |

***

### Example 9: Edge case

**Argument values:**

* **Geometry string:** `geometry`
* **Output mode:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"type":"GeometryCollection","geometries":\[{"type":"GeometryCollection","geometries":\[{"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[-122.4000,37.8000]}]}]}]} | {"coordinates":\[-122.4, 37.8], "type":"Point"} |
| {"type":"GeometryCollection","geometries":\[{"type":"GeometryCollection","geometries":\[{"type":"Geome... | {"coordinates":\[-122.4, 37.8], "type":"Point"} |

***

### Example 10: Edge case

**Argument values:**

* **Geometry string:** `geometry`
* **Output mode:** `with_errors`

| geometry | **Output** |
| ----- | ----- |
| {"type":"GeometryCollection","geometries":\[{"type":"GeometryCollection","geometries":\[{"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[-122.4000,37.8000]}]}]}]} | {<br> **error**: *null*,<br> **ok**: {"type":"Point","coordinates":\[-122.4,37.8]},<br>} |
| {"type":"GeometryCollection","geometries":\[{"type":"GeometryCollection","geometries":\[{"type":"Geome... | {<br> **error**: *null*,<br> **ok**: {"type":"Point","coordinates":\[-122.4,37.8]},<br>} |
| {"type":"GeometryCollection","geometries":\[{"type":"GeometryCollection","geometries":\[{"type":"Multi... | {<br> **error**: *null*,<br> **ok**: {"type":"MultiLineString","coordinates":\[\[\[-122.36,37... |
| {"type":"GeometryCollection","geometries":\[{"type":"GeometryCollection","geometries":\[{"type":"MultiPoint","coordinates":\[\[-122.4100,37.8100],\[-122.4200,37.8200],\[-122.4300,37.8300]]}]}]} | {<br> **error**: *null*,<br> **ok**: {"type":"MultiPoint","coordinates":\[\[-122.41,37.81],\[-122.42,37.82],\[-122.43,37.83]]},<br>} |

***
