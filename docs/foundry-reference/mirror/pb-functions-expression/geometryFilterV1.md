<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryFilterV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Filter by geometry type

> Supported in: Batch, Faster, Streaming

Nulls any values in the geometry column that are not of the provided geometry types.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** The geometry column to filter.<br>*Expression\<Geometry>*
* **Geometry types:** The set of geometry types to keep.<br>*Set\<Enum\<Feature, FeatureCollection, GeometryCollection, LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon>>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometry`
* **Geometry types:** {`POINT`}

| geometry | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates": \[32.0, 58.0]} | {"type":"Point","coordinates": \[32.0, 58.0]} |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `geometry`
* **Geometry types:** {`POINT`}

| geometry | **Output** |
| ----- | ----- |
| {"type":"LineString","coordinates":\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323]]} | *null* |

***

### Example 3: Base case

**Argument values:**

* **Expression:** `geometry`
* **Geometry types:** {`LINESTRING`}

| geometry | **Output** |
| ----- | ----- |
| {"type":"LineString","coordinates":\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323]]} | {"type":"LineString","coordinates":\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323]]} |
| {"type": "GeometryCollection","geometries": \[{"type":"LineString","coordinates":\[\[-77.07368071728229... | *null* |

***

### Example 4: Base case

**Argument values:**

* **Expression:** `geometry`
* **Geometry types:** {`LINESTRING`, `POINT`}

| geometry | **Output** |
| ----- | ----- |
| {"type":"LineString","coordinates":\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323]]} | {"type":"LineString","coordinates":\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323]]} |
| {"type":"Point","coordinates": \[32.0, 58.0]} | {"type":"Point","coordinates": \[32.0, 58.0]} |

***

### Example 5: Null case

**Argument values:**

* **Expression:** `geometry`
* **Geometry types:** {`POINT`}

| geometry | **Output** |
| ----- | ----- |
| *null* | *null* |

***
