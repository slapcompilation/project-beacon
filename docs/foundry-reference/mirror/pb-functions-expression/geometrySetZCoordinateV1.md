<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometrySetZCoordinateV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry set z-coordinate

> Supported in: Batch, Faster, Streaming

Sets the z-coordinate of a geometry. If the geometry has an existing z-coordinate it will be overwritten.

**Expression categories:** Geospatial

## Declared arguments

* **Geometry:** Geometry.<br>*Expression\<Geometry>*
* **Z coordinate:** Z-coordinate.<br>*Expression\<Double>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Geometry:** `geometry`
* **Z coordinate:** `zCoordinate`

| geometry | zCoordinate | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[1.0, 2.0]} | 1.0 | {"type":"Point","coordinates":\[1.0, 2.0, 1.0]} |
| {"type":"Point","coordinates":\[1.0, 2.0, 3.0]} | 1.0 | {"type":"Point","coordinates":\[1.0, 2.0, 1.0]} |

***

### Example 2: Null case

**Argument values:**

* **Geometry:** `geometry`
* **Z coordinate:** `zCoordinate`

| geometry | zCoordinate | **Output** |
| ----- | ----- | ----- |
| *null* | 0.0 | *null* |
| {"type":"Point","coordinates":\[1.0, 2.0]} | *null* | {"type":"Point","coordinates":\[1.0, 2.0]} |

***
