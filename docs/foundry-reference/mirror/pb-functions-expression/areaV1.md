<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/areaV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Area

> Supported in: Batch, Streaming

Calculates area of a geometry in meters squared using a spherical approximation of the globe. For a line string or a point, this equals 0.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** GeoJSON string.<br>*Expression\<Geometry>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-1.0,-1.0],\[1.0,-1.0],\[1.0,1.0],\[-1.0,1.0],\[-1.0,-1.0]]]} | 4.945989326791108E10 |
| {"type":"Polygon","coordinates":\[\[\[-179.0,-1.0],\[179.0,-1.0],\[179.0,1.0],\[-179.0,1.0],\[-179.0,-1.0]]]} | 4.945989326791108E10 |
| {"type":"Polygon","coordinates":\[\[\[-102.05,41.0],\[-109.05,41.0],\[-109.05,37.0],\[-102.05,37.0],\[-102.05,41.0]]]} | 2.6893150148718735E11 |
| {"type":"MultiPolygon","coordinates":\[\[\[\[-102.05,41.0],\[-109.05,41.0],\[-109.05,37.0],\[-102.05,37.0],\[-102.05,41.0]]],\[\[\[-1.0,-1.0],\[1.0,-1.0],\[1.0,1.0],\[-1.0,1.0],\[-1.0,-1.0]]]]} | 3.1839139475509845E11 |
| {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]} | 0.0 |
| {"type":"Point","coordinates":\[0.0,0.0]} | 0.0 |
| {"type":"Polygon","coordinates":\[\[\[10.201057,-45.051191],\[10.201081,-45.051243],\[10.201088,-45.05125... | 410.5095025699564 |
| *null* | *null* |
| not geoJson | *null* |

***
