<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/parseWellKnownBinaryAsGeometryV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Parse well known binary as geometry

> Supported in: Batch, Faster, Streaming

Converts well-known binary (WKB) to geometry logical type. Invalid WKB input will be returned as null. Optionally supply a source coordinate system identifier to convert from the source coordinate system to WGS 84 if the WKB is not in WGS 84 already.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** Valid well-known binary as a binary.<br>*Expression\<Binary>*
* *optional* **Source coordinate system:** Optional coordinate system identifier if the well-known binary is not WGS 84. Formatted as "authority:id". For example, UTM zone 18N could be identified by EPSG:32618.<br>*Literal\<String>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `wkb`
* **Source coordinate system:** *null*

| wkb | **Output** |
| ----- | ----- |
| AAAAAAFACAAAAAAAAEAUAAAAAAAA | {"type":"Point","coordinates":\[3.0, 5.0]} |
| AIAAAAFACAAAAAAAAEAUAAAAAAAAQAAAAAAAAAA= | {"type":"Point","coordinates":\[3.0, 5.0, 2.0]} |
| AAAAAAMAAAABAAAABAAAAAAAAAAAAAAAAAAAAAA/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]]]} |
| AAAAAAIAAAACAAAAAAAAAAAAAAAAAAAAAD/wAAAAAAAAAAAAAAAAAAA= | {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]} |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `wkb`
* **Source coordinate system:** EPSG:32618

| wkb | **Output** |
| ----- | ----- |
| AAAAAAFBE4gAAAAAAEFQZzgAAAAA | {"type":"Point","coordinates":\[-77.07368071728229,38.83040844313318]} |
| AIAAAAFBE4gAAAAAAEFQZzgAAAAAQAAAAAAAAAA= | {"type":"Point","coordinates":\[-77.07368071728229,38.83040844313318, 2.0]} |
| AAAAAAMAAAABAAAABEETiAAAAAAAQVBnOAAAAABBE4mQAAAAAEFQZzgAAAAAQROIAAAAAABBUGdRAAAAAEETiAAAAAAAQVBnOAAAAAA= | {"type":"Polygon","coordinates":\[\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659],\[-77.07370685720375,38.83130901341597],\[-77.07368071728229,38.83040844313318]]]} |
| AAAAAAIAAAACQROIAAAAAABBUGc4AAAAAEETiZAAAAAAQVBnOAAAAAA= | {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659]]} |

***

### Example 3: Null case

**Argument values:**

* **Expression:** `wkb`
* **Source coordinate system:** *null*

| wkb | **Output** |
| ----- | ----- |
|  | *null* |
| *null* | *null* |

***
