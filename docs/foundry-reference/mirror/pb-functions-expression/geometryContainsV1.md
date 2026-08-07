<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryContainsV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry contains

> Supported in: Batch, Faster, Streaming

Determines if geometry a contains geometry b. Points or lines lying on the boundary of a polygon are not contained within another geometry.

**Expression categories:** Geospatial

## Declared arguments

* **Geometry a:** Geometry a.<br>*Expression\<Geometry>*
* **Geometry b:** Geometry b.<br>*Expression\<Geometry>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"coordinates":\[\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323], \[... | {"type":"Point","coordinates":\[-100.0,32.0]} | true |
| {"coordinates":\[\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323], \[... | {"type":"LineString","coordinates":\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323]]} | false |
| {"type":"LineString","coordinates":\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323]]} | {"type":"Point","coordinates":\[-112.94377956164206,34.81725414459382]} | false |
| {"type":"Point","coordinates":\[-112.94377956164206,34.81725414459382]} | {"type":"Point","coordinates":\[-112.94377956164206,34.81725414459382]} | true |
| {"coordinates":\[\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323], \[... | {"coordinates":\[\[\[-111.94377956164206,33.81725414459382],\[-111.94377956164206,31.006795384733323], \[... | true |

***

### Example 2: Null case

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| *null* | *null* | *null* |
| {"type":"Point","coordinates":\[-112.94377956164206,34.81725414459382]} | *null* | *null* |
| *null* | {"type":"Point","coordinates":\[-112.94377956164206,34.81725414459382]} | *null* |

***
