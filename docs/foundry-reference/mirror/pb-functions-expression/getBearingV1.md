<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/getBearingV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Get bearing from start point to end point

> Supported in: Batch, Faster, Streaming

Calculates the absolute true bearing (clockwise angle relative to geographical north) from the first point to the second point in degrees using a spherical approximation of the earth.

**Expression categories:** Geospatial

## Declared arguments

* **Ending point:** Longitude and latitude for the ending point.<br>*Expression\<GeoPoint>*
* **Starting point:** Longitude and latitude for the starting point.<br>*Expression\<GeoPoint>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Ending point:** `end_point`
* **Starting point:** `start_point`

| start\_point | end\_point | **Output** |
| ----- | ----- | ----- |
| {<br> **latitude**: 40.69325025929194,<br> **longitude**: -74.00522662934995,<br>} | {<br> **latitude**: 51.4988509390695,<br> **longitude**: -0.1238396067697046,<br>} | 51.20964213763489 |

***

### Example 2: Edge case

**Argument values:**

* **Ending point:** `end_point`
* **Starting point:** `start_point`

| start\_point | end\_point | **Output** |
| ----- | ----- | ----- |
| {<br> **latitude**: -41.304077,<br> **longitude**: 174.75,<br>} | {<br> **latitude**: -31.304077,<br> **longitude**: 174.749,<br>} | 359.99507958062 |

***

### Example 3: Edge case

**Argument values:**

* **Ending point:** `end_point`
* **Starting point:** `start_point`

| start\_point | end\_point | **Output** |
| ----- | ----- | ----- |
| {<br> **latitude**: -41.304077,<br> **longitude**: 174.75,<br>} | {<br> **latitude**: -31.304077,<br> **longitude**: 174.75,<br>} | 0.0 |

***

### Example 4: Edge case

**Argument values:**

* **Ending point:** `end_point`
* **Starting point:** `start_point`

| start\_point | end\_point | **Output** |
| ----- | ----- | ----- |
| {<br> **latitude**: -41.304077,<br> **longitude**: 174.774535,<br>} | {<br> **latitude**: 37.42984400901383,<br> **longitude**: -122.16950590121428,<br>} | 45.56453711814595 |

***

### Example 5: Edge case

**Argument values:**

* **Ending point:** `end_point`
* **Starting point:** `start_point`

| start\_point | end\_point | **Output** |
| ----- | ----- | ----- |
| *null* | *null* | *null* |

***

### Example 6: Edge case

**Argument values:**

* **Ending point:** `end_point`
* **Starting point:** `start_point`

| start\_point | end\_point | **Output** |
| ----- | ----- | ----- |
| {<br> **latitude**: 48.8567,<br> **longitude**: 2.3508,<br>} | {<br> **latitude**: 48.8567,<br> **longitude**: 2.3508,<br>} | 0.0 |

***
