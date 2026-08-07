<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/parseKmlAsGeometryV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Parse KML string as geometry

> Supported in: Batch, Streaming

Parses KML geometry definitions as a GeoJSON. Ignores all attributes. This expression operates on already extracted text; please extract files to text before using this expression.

**Expression categories:** Geospatial

## Declared arguments

* **KML string to parse:** Valid KML string to parse to geometry.<br>*Expression\<String>*
* *optional* **Output mode:** Choose whether to output null on an erroneous output, or a result type from which you can extract the 'ok' field to get the geometry or the 'error' field to get a descriptive error message.<br>*Enum\<Simple, With errors>*
* *optional* **Prepare geometry after parse:** Choose whether the kml should be prepared to adhere to Foundry geometry semantics. Geometries should be prepared prior to ingestion into the ontology to prevent failures during ontology indexing. Running prepare may result in more errors during the parse itself. For example, prepare will error on geometries with out of bounds coordinates during indexing.<br>*Expression\<Boolean>*

**Output type:** *String | Struct\<ok:Geometry, error:String>*

## Examples

### Example 1: Base case

**Description:** Basic polygons.

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** *null*
* **Prepare geometry after parse:** *null*

| col | **Output** |
| ----- | ----- |
| \<LineString><br> \<coordinates><br>-71.1663,42.2614<br>-71.1667,42.2616<br>\</coordinates><br>\</LineString> | {"type":"LineString","coordinates":\[\[-71.1663,42.2614],\[-71.1667,42.2616]]} |
| \<Polygon><br>\<extrude>1\</extrude><br>\<altitudeMode>relativeToGround\</altitudeMode><br>\<ou... | {"type":"Polygon","coordinates":\[\[\[-122.0848938459612,37.42257124044786,17.0],\[-122.0847882750515,37... |
| \<Polygon><br>\<extrude>1\</extrude><br>\<altitudeMode>relativeToGround\</altitudeMode><br>\<ou... | {"type":"Polygon","coordinates":\[\[\[-77.05465973756702,38.87291016281703,100.0],\[-77.0531553685479,38... |
| \<Point><br>\<coordinates><br>-71.1663,42.2614<br>\</coordinates><br>\</Point> | {"type":"Point","coordinates":\[-71.1663,42.2614]} |
| \<MultiGeometry><br>\<Polygon><br>\<outerBoundaryIs><br>\<coordinates> -71.1663,42.2614<br>-71.1... | {"type":"MultiPolygon","coordinates":\[\[\[\[-81.1679,32.2614],\[-81.1679,32.28],\[-81.1663,32.28],\[-81.16... |

***

### Example 2: Base case

**Description:** Basic polygons with result type outputs.

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** `with_errors`
* **Prepare geometry after parse:** *null*

| col | shouldPrepare | **Output** |
| ----- | ----- | ----- |
| \<LineString><br> \<coordinates><br>-71.1663,42.2614<br>-71.1667,42.2616<br>\</coordinates><br>\</LineString> | true | {<br> **error**: *null*,<br> **ok**: {"type":"LineString","coordinates":\[\[-71.1663,42.2614],\[-71.1667,42.2616]]},<br>} |
| \<Polygon><br>\<extrude>1\</extrude><br>\<altitudeMode>relativeToGround\</altitudeMode><br>\<ou... | true | {<br> **error**: *null*,<br> **ok**: {"type":"Polygon","coordinates":\[\[\[-122.0848938459612,37.42257124044786,17.0],\[-122.0847882750515,37...,<br>} |
| \<Polygon><br>\<extrude>1\</extrude><br>\<altitudeMode>relativeToGround\</altitudeMode><br>\<ou... | true | {<br> **error**: *null*,<br> **ok**: {"type":"Polygon","coordinates":\[\[\[-77.05465973756702,38.87291016281703,100.0],\[-77.0531553685479,38...,<br>} |
| \<Point><br>\<coordinates><br>-71.1663,42.2614<br>\</coordinates><br>\</Point> | true | {<br> **error**: *null*,<br> **ok**: {"type":"Point","coordinates":\[-71.1663,42.2614]},<br>} |
| \<MultiGeometry><br>\<Polygon><br>\<outerBoundaryIs><br>\<coordinates> -71.1663,42.2614<br>-71.1... | true | {<br> **error**: *null*,<br> **ok**: {"type":"MultiPolygon","coordinates":\[\[\[\[-81.1679,32.2614],\[-81.1679,32.28],\[-81.1663,32.28],\[-81.16...,<br>} |

***

### Example 3: Base case

**Description:** Full KML files with documents and folders are not supported.

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** *null*
* **Prepare geometry after parse:** *null*

| col | **Output** |
| ----- | ----- |
| \<kml xmlns="http://www.opengis.net/kml/2.2"><br>\<Document><br>\<name>KML Samples\</name><br><... | *null* |

***

### Example 4: Null case

**Description:** Example of null input.

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** *null*
* **Prepare geometry after parse:** *null*

| col | **Output** |
| ----- | ----- |
| *null* | *null* |
| *empty string* | *null* |

***

### Example 5: Edge case

**Description:** Invalid KML examples.

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** *null*
* **Prepare geometry after parse:** *null*

| col | **Output** |
| ----- | ----- |
| \<Polygon>\<mal> formed KML \</ml>\</Polygon> | *null* |
| \<Polygon><br>\<extrude>1\</extrude><br>\<altitudeMode>relativeToGround\</altitudeMode><br>\<ou... | *null* |
| \<Polygon>\<innerBoundaryIs>\<LinearRing><br>\<coordinates> -123.0,37.0,17<br>-122.0,38.0,17<br>... | *null* |

***

### Example 6: Edge case

**Description:** Invalid KML examples with out-of-bounds coordinates

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** *null*
* **Prepare geometry after parse:** *null*

| col | **Output** |
| ----- | ----- |
| \<Polygon>\<outerBoundaryIs>\<LinearRing><br>\<coordinates> -180.3348783983763,95.1514008468736,... | *null* |

***

### Example 7: Edge case

**Description:** Invalid KML examples with out-of-bounds coordinates when prepare geometry is not run will return a geometry.

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** `simple`
* **Prepare geometry after parse:** `shouldPrepare`

| col | shouldPrepare | **Output** |
| ----- | ----- | ----- |
| \<Polygon>\<outerBoundaryIs>\<LinearRing><br>\<coordinates> -180.3348783983763,95.1514008468736,... | false | {"coordinates":\[\[\[-180.3348783983763,95.1514008468736,100.0],\[-180.3372535345629,95.14888517553887,1... |

***
