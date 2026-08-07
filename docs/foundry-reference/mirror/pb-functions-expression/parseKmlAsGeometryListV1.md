<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/parseKmlAsGeometryListV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Parse KML string as geometry list

> Supported in: Batch, Streaming

Parses KML string as a list of GeoJSONs, ignoring all KML attributes.

**Expression categories:** Geospatial

## Declared arguments

* **KML string to parse:** Valid KML string to parse to geometry.<br>*Expression\<String>*
* *optional* **Output mode:** Choose whether to output null on an erroneous output, or a result type from which you can extract the 'ok' field to get the geometry list or the 'error' field to get a descriptive error message. This will also apply to all of the geometries inside the list.<br>*Enum\<Simple, With errors>*
* *optional* **Prepare geometry after parse:** Choose whether the KML should be prepared to adhere to Foundry geometry semantics. It is recommended to prepare in most cases to prevent failure during ontology indexing. Preparing will null out invalid geometries, for example those with out of bounds coordinates.<br>*Literal\<Boolean>*

**Output type:** *Array\<Geometry> | Struct\<ok:Array\<Struct\<ok:Geometry, error:String>>, error:String>*

## Examples

### Example 1: Base case

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** `simple`
* **Prepare geometry after parse:** true

| col | **Output** |
| ----- | ----- |
| \<?xml version="1.0" encoding="utf-8"?><br>\<kml xmlns="http://www.opengis.net/kml/2.2"><br>  \<Do... | \[ {"coordinates":\[\[-122.43193945401, 37.801983684521], \[-122.431564131101, 37.8020327731402], \[-122.43... ] |

***

### Example 2: Base case

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** `simple`
* **Prepare geometry after parse:** false

| col | **Output** |
| ----- | ----- |
| \<?xml version="1.0" encoding="utf-8"?><br>\<kml xmlns="http://www.opengis.net/kml/2.2"><br>  \<Do... | \[ {"coordinates":\[\[-122.43193945401, 37.801983684521], \[-122.431564131101, 37.8020327731402], \[-122.43... ] |

***

### Example 3: Base case

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** `with_errors`
* **Prepare geometry after parse:** true

| col | **Output** |
| ----- | ----- |
| \<?xml version="1.0" encoding="utf-8"?><br>\<kml xmlns="http://www.opengis.net/kml/2.2"><br>  \<Do... | {<br> **error**: *null*,<br> **ok**: \[ {<br> **error**: *null*,<br> **ok**: {"ty... |

***

### Example 4: Base case

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** `with_errors`
* **Prepare geometry after parse:** false

| col | **Output** |
| ----- | ----- |
| \<?xml version="1.0" encoding="utf-8"?><br>\<kml xmlns="http://www.opengis.net/kml/2.2"><br>  \<Do... | {<br> **error**: *null*,<br> **ok**: \[ {<br> **error**: *null*,<br> **ok**: {"ty... |

***

### Example 5: Base case

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** `simple`
* **Prepare geometry after parse:** false

| col | **Output** |
| ----- | ----- |
| randomKmlFileString | *null* |

***

### Example 6: Base case

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** `with_errors`
* **Prepare geometry after parse:** false

| col | **Output** |
| ----- | ----- |
| randomKmlFileString | {<br> **error**: Failed to parse String. Error: Unexpected character 'r' (code 114) in prolog; expected '<'<br> at \[row,col {unknown-source}]: \[1,1],<br> **ok**: *null*,<br>} |

***

### Example 7: Null case

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** `simple`
* **Prepare geometry after parse:** false

| col | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 8: Null case

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** `with_errors`
* **Prepare geometry after parse:** false

| col | **Output** |
| ----- | ----- |
| *null* | {<br> **error**: Null input: KML,<br> **ok**: *null*,<br>} |

***
