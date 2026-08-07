<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/createGeodesicLineStringV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create geodesic line string

> Supported in: Batch, Streaming

Creates a geodesic line between two points.

**Expression categories:** Geospatial

## Declared arguments

* **End point:** Longitude and latitude for the end point.<br>*Expression\<GeoPoint>*
* **Starting point:** Longitude and latitude for the starting point.<br>*Expression\<GeoPoint>*
* *optional* **Number of steps:** The number of points to return in between the start and end point of the geodesic line segment. The default value is 24 points.<br>*Expression\<Byte | Integer | Long | Short>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 20.92,<br> **longitude**: 179.0,<br>} | {<br> **latitude**: 20.92,<br> **longitude**: -178.0,<br>} | 3 | {"type":"MultiLineString","coordinates":\[\[\[-180.0, 20.925458598035362],\[-179.5, 20.926550359447504],... |

***

### Example 2: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 38.9072,<br> **longitude**: -77.0369,<br>} | {<br> **latitude**: 20.92,<br> **longitude**: -70.0,<br>} | 8 | {"type":"LineString","coordinates":\[\[-77.0369, 38.90720000000001],\[-76.10884874732801, 36.9298141100... |

***

### Example 3: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 34.1309,<br> **longitude**: -88.908,<br>} | {<br> **latitude**: 34.496,<br> **longitude**: -83.9651,<br>} | 4 | {"type":"LineString","coordinates":\[\[-88.90800000000002, 34.13089999999999],\[-87.9230399151116, 34.2... |

***

### Example 4: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 39.4953,<br> **longitude**: -89.6352,<br>} | {<br> **latitude**: 61.0928,<br> **longitude**: 62.2376,<br>} | 4 | {"type":"LineString","coordinates":\[\[-89.6352, 39.4953],\[-83.5342527561974, 54.30031923899314],\[-70.... |

***

### Example 5: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 38.9072,<br> **longitude**: -77.0369,<br>} | {<br> **latitude**: 20.92,<br> **longitude**: -70.0,<br>} | *null* | {"type":"LineString","coordinates":\[\[-77.0369, 38.90720000000001],\[-76.69701959729164, 38.1961853930... |

***

### Example 6: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 20.92,<br> **longitude**: -70.0,<br>} | {<br> **latitude**: *null*,<br> **longitude**: -77.0369,<br>} | 8 | *null* |

***

### Example 7: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 20.92,<br> **longitude**: -70.0,<br>} | {<br> **latitude**: *null*,<br> **longitude**: *null*,<br>} | 8 | *null* |

***

### Example 8: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 20.92,<br> **longitude**: -70.0,<br>} | {<br> **latitude**: 38.9072,<br> **longitude**: *null*,<br>} | 8 | *null* |

***

### Example 9: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 39.4953,<br> **longitude**: -89.6352,<br>} | *null* | 8 | *null* |

***

### Example 10: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: *null*,<br> **longitude**: *null*,<br>} | {<br> **latitude**: *null*,<br> **longitude**: *null*,<br>} | 8 | *null* |

***

### Example 11: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: *null*,<br> **longitude**: *null*,<br>} | {<br> **latitude**: *null*,<br> **longitude**: *null*,<br>} | *null* | *null* |

***

### Example 12: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| *null* | *null* | 8 | *null* |

***

### Example 13: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: *null*,<br> **longitude**: -77.0369,<br>} | {<br> **latitude**: 20.92,<br> **longitude**: -70.0,<br>} | 8 | *null* |

***

### Example 14: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: *null*,<br> **longitude**: *null*,<br>} | {<br> **latitude**: 20.92,<br> **longitude**: -70.0,<br>} | 8 | *null* |

***

### Example 15: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 38.9072,<br> **longitude**: *null*,<br>} | {<br> **latitude**: 20.92,<br> **longitude**: -70.0,<br>} | 8 | *null* |

***

### Example 16: Base case

**Argument values:**

* **End point:** `endPoint`
* **Starting point:** `startPoint`
* **Number of steps:** `numSteps`

| startPoint | endPoint | numSteps | **Output** |
| ----- | ----- | ----- | ----- |
| *null* | {<br> **latitude**: 20.92,<br> **longitude**: -70.0,<br>} | 8 | *null* |

***
