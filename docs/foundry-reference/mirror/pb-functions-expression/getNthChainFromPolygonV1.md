<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/getNthChainFromPolygonV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Nth chain in polygon

> Supported in: Batch, Faster, Streaming

Returns the nth ring in a single polygon in the geometry. Indexing is 1-based, and an index of 0 is out-of-bounds. An index equal to 1 returns an external ring. An index greater than 1 returns an internal ring. Returns null for any of the following conditions: geometry isn't a single polygon, a feature collection or geometry collection is provided, index is out-of-bounds, or at least one argument is null.

**Expression categories:** Geospatial

## Declared arguments

* **N:** Index of the ring to retrieve. Indexing is 1-based, and an index of 0 is out-of-bounds. An index greater than 1 returns an internal ring.<br>*Expression\<Byte | Integer | Long | Short>*
* **Polygon:** Polygon to retrieve the nth ring of.<br>*Expression\<Geometry>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **N:** `n`
* **Polygon:** `polygon`

| polygon | n | **Output** |
| ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 1 | {"coordinates": \[\[0.0, 0.0], \[0.0, 10.0], \[10.0, 10.0], \[10.0, 0.0], \[0.0, 0.0]], "type": "LineString"} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 2 | *null* |
| {"coordinates":\[\[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]],\[\[57.0,57.0],\[55.0,52.0],\[52.0,52.0],\[50.0,57.0],\[57.0,57.0]]],"type":"Polygon"} | 1 | {"coordinates": \[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]], "type": "LineString"} |
| {"coordinates":\[\[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]],\[\[57.0,57.0],\[55.0,52.0],\[52.0,52.0],\[50.0,57.0],\[57.0,57.0]]],"type":"Polygon"} | 2 | {"coordinates": \[\[57.0,57.0],\[55.0,52.0],\[52.0,52.0],\[50.0,57.0],\[57.0,57.0]], "type": "LineString"} |

***

### Example 2: Null case

**Argument values:**

* **N:** `n`
* **Polygon:** `polygon`

| polygon | n | **Output** |
| ----- | ----- | ----- |
| {"coordinates": \[\[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} | 1 | *null* |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | *null* | *null* |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 0 | *null* |
| *null* | 1 | *null* |
| *null* | *null* | *null* |

***

### Example 3: Edge case

**Argument values:**

* **N:** `n`
* **Polygon:** `polygon`

| polygon | n | **Output** |
| ----- | ----- | ----- |
| {"coordinates":\[\[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]],\[\[57.0,57.0],\[55.0,52.... | 1 | {"coordinates": \[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]], "type": "LineString"} |
| {"coordinates":\[\[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]],\[\[57.0,57.0],\[55.0,52.... | 2 | {"coordinates": \[\[57.0,57.0],\[55.0,52.0],\[52.0,52.0],\[50.0,57.0],\[57.0,57.0]], "type": "LineString"} |
| {"coordinates":\[\[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]],\[\[57.0,57.0],\[55.0,52.... | 3 | {"coordinates": \[\[58.0,58.0],\[58.0,59.0],\[59.0,59.0],\[59.0,58.0],\[58.0,58.0]], "type": "LineString"} |
| {"coordinates":\[\[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]],\[\[57.0,57.0],\[55.0,52.... | 4 | {"coordinates": \[\[52.0,58.5],\[56.0,58.5],\[54.0,57.5],\[52.0,58.5]], "type": "LineString"} |
| {"coordinates":\[\[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]],\[\[57.0,57.0],\[55.0,52.... | 5 | *null* |

***
