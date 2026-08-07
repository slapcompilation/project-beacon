<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometrySymmetricDifferenceV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry symmetric difference

> Supported in: Batch, Faster, Streaming

Calculates the portion that is in either geometry, but not in their intersection.

**Expression categories:** Geospatial

## Declared arguments

* **Geometry a:** Geometry b.<br>*Expression\<Geometry>*
* **Geometry b:** Geometry a.<br>*Expression\<Geometry>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[2.0,1.0],\[2.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[3.0,1.0],\[3.0,0.0],\[1.0,0.0]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]],\[\[\[2.0,0.0],\[2.0,1.0],\[3.0,1.0],\[3.0,0.0],\[2.0,0.0]]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.5,0.0],\[0.5,1.0],\[0.0,1.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.5,1.0],\[1.0,1.0],\[1.0,0.0],\[0.5,0.0],\[0.5,1.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.25,0.25],\[0.5,0.25],\[0.5,0.5],\[0.25,0.5],\[0.25,0.25]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]],\[\[0.25,0.25],\[0.5,0.25],\[0.5,0.5],\[0.25,0.5],\[0.25,0.25]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]],\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]]} |
| {"type":"Point","coordinates":\[0.0,0.0]} | {"type":"Point","coordinates":\[1.0,1.0]} | {"type":"MultiPoint","coordinates":\[\[0.0,0.0],\[1.0,1.0]]} |
| {"type":"LineString","coordinates":\[\[0.0,0.0],\[2.0,0.0]]} | {"type":"LineString","coordinates":\[\[1.0,0.0],\[3.0,0.0]]} | {"type":"MultiLineString","coordinates":\[\[\[0.0,0.0],\[1.0,0.0]],\[\[2.0,0.0],\[3.0,0.0]]]} |

***

### Example 2: Null case

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| *null* | {"type":"LineString","coordinates":\[]} | *null* |
| {"type":"LineString","coordinates":\[]} | *null* | *null* |
| *null* | *null* | *null* |

***

### Example 3: Edge case

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[0.0,0.0]} | {"type":"Point","coordinates":\[0.0,0.0]} | {"type":"Point","coordinates":\[]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[]]} |
| {"type":"Point","coordinates":\[0.0,0.0]} | {"type":"LineString","coordinates":\[\[0.0,0.0],\[0.0,1.0]]} | {"type":"LineString","coordinates":\[\[0.0,0.0],\[0.0,1.0]]} |
| {"type":"LineString","coordinates":\[\[0.0,0.0],\[0.0,1.0]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |
| {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,1.0]]} | {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,1.0]]} | {"type":"LineString","coordinates":\[]} |

***
