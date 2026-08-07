<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/parseWellKnownTextAsGeometryV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Parse well known text as geometry

> Supported in: Batch, Faster, Streaming

Converts well-known text (WKT) string to geometry logical type. Invalid WKT input will be returned as null. Optionally supply a source coordinate system identifier to convert from the source coordinate system to WGS 84 if the WKT is not in WGS 84 already.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** Valid well-known text as a string.<br>*Expression\<String>*
* *optional* **Source coordinate system:** Optional coordinate system identifier if the well-known text is not WGS 84. Formatted as "authority:id". For example, UTM zone 18N could be identified by EPSG:32618.<br>*Literal\<String>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `wkt`
* **Source coordinate system:** *null*

| wkt | **Output** |
| ----- | ----- |
| POINT (3.0 5.0 2.0) | {"type":"Point","coordinates":\[3.0, 5.0, 2.0]} |
| POLYGON ((0.0 0.0, 1.0 0.0, 0.0 1.0, 0.0 0.0)) | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]]]} |
| LINESTRING (0.0 0.0, 1.0 0.0) | {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]} |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `wkt`
* **Source coordinate system:** EPSG:32618

| wkt | **Output** |
| ----- | ----- |
| POINT (320000.0 4300000.0 2.0) | {"type":"Point","coordinates":\[-77.07368071728229,38.83040844313318, 2.0]} |
| POLYGON ((320000.0 4300000.0, 320100.0 4300000.0, 320000.0 4300100.0, 320000.0 4300000.0)) | {"type":"Polygon","coordinates":\[\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659],\[-77.07370685720375,38.83130901341597],\[-77.07368071728229,38.83040844313318]]]} |
| LINESTRING (320000.0 4300000.0, 320100.0 4300000.0) | {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659]]} |

***
