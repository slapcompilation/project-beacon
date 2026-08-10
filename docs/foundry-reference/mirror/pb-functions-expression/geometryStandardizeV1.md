<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryStandardizeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry standardize

> Supported in: Batch, Streaming

Given a valid geometry, standardizes it by enforcing the right-hand rule on the input, which is the convention for GeoJSON. This enables equality comparisons between equivalent geometries. This expression may reverse linestrings.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** Geometry to be standardized.<br>*Expression\<Geometry>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[32.26868,-26.53253],\[32.26465,-26.45873],\[32.25262,-26.38563],\[32.26868,-26.53253]]]} | {"type":"Polygon","coordinates":\[\[\[32.25262, -26.38563],\[32.26868, -26.53253],\[32.26465, -26.45873],\[32.25262, -26.38563]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,0.0]],\[\[0.25,0.25],\[0.5,0.25],\[0.25,0.5]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]], \[\[0.25,0.25],\[0.25,0.5],\[0.5,0.25],\[0.25,0.25]]]} |
| {"coordinates": \[\[\[20.0, 10.0], \[27.0, 10.0], \[27.0, 17.0], \[20.0, 17.0], \[20.0, 10.0]]], "type": "Polygon"} | {"coordinates": \[\[\[20.0, 10.0], \[27.0, 10.0], \[27.0, 17.0], \[20.0, 17.0], \[20.0, 10.0]]], "type": "Polygon"} |
| {"coordinates": \[\[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]], \[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]]], "type":"MultiPolygon"} | {"coordinates": \[\[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} |
| {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | {"coordinates": \[\[5.0, 5.0],\[-1.0, -1.0]], "type":"LineString"} |
| {"coordinates": \[\[\[0.0, 0.0, 0.0], \[10.0, 0.0, 0.0], \[10.0, 10.0, 0.0], \[10.0, 10.0, 10.0], \[0.0, 10.0, 10.0], \[0.0, 0.0, 10.0], \[0.0, 0.0, 0.0]]], "type": "Polygon"} | {"coordinates": \[\[\[0.0, 0.0, 0.0], \[10.0, 0.0, 0.0], \[10.0, 10.0, 0.0], \[10.0, 10.0, 10.0], \[0.0, 10.0, 10.0], \[0.0, 0.0, 10.0], \[0.0, 0.0, 0.0]]], "type": "Polygon"} |

***

### Example 2: Null case

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| *null* | *null* |
| Not geojson | *null* |

***
