<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryIntersectsV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometries have intersection

> Supported in: Batch, Faster, Streaming

Determines if two geometries intersect.

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
| {"coordinates":\[\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323], \[... | {"coordinates":\[\[\[-103.78627755867336,33.162750522563925],\[-103.78627755867336,28.29724741894266],\[-... | true |
| {"coordinates":\[\[\[0.3651446504365481,15.159518507965103],\[0.3651446504365481,13.427462911044273],\[3.... | {"coordinates":\[\[\[5.656394524666183,13.405417496831944],\[5.656394524666183,11.29869961209053],\[8.551... | false |

***
