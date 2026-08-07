<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/inverseHaversineV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Calculate destination point

> Supported in: Batch, Faster, Streaming

Calculates the destination point along a specified path given a starting point, course, and distance.

**Expression categories:** Geospatial

## Declared arguments

* **Course:** Current course in degrees.<br>*Expression\<Double>*
* **Distance:** Distance to destination in meters.<br>*Expression\<Double>*
* **Starting point:** Longitude and latitude for point a.<br>*Expression\<GeoPoint>*
* *optional* **Calculation method:** The path to follow along the surface of a spherical approximation of the earth. Defaults to great circle.<br>*Enum\<Great Circle, Loxodrome/Rhumb Line>*

**Output type:** *GeoPoint*

## Examples

### Example 1: Base case

**Argument values:**

* **Course:** `course`
* **Distance:** `distance`
* **Starting point:** `point_a`
* **Calculation method:** `GREAT_CIRCLE`

| point\_a | course | distance | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 48.8567,<br> **longitude**: 2.3508,<br>} | 225.0 | 32000.0 | {<br> **latitude**: 48.65279552300661,<br> **longitude**: 2.0427666779658806,<br>} |

***

### Example 2: Base case

**Argument values:**

* **Course:** `course`
* **Distance:** `distance`
* **Starting point:** `point_a`
* **Calculation method:** `LOXODROME`

| point\_a | course | distance | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 48.8567,<br> **longitude**: 2.3508,<br>} | 225.0 | 32000.0 | {<br> **latitude**: 48.65320703115239,<br> **longitude**: 2.0421403965968183,<br>} |

***

### Example 3: Null case

**Argument values:**

* **Course:** `course`
* **Distance:** `distance`
* **Starting point:** `point_a`
* **Calculation method:** *null*

| point\_a | course | distance | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 48.8567,<br> **longitude**: 2.3508,<br>} | 225.0 | 32000.0 | {<br> **latitude**: 48.65279552300661,<br> **longitude**: 2.0427666779658806,<br>} |

***

### Example 4: Edge case

**Argument values:**

* **Course:** `course`
* **Distance:** `distance`
* **Starting point:** `point_a`
* **Calculation method:** `LOXODROME`

| point\_a | course | distance | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 42.779577,<br> **longitude**: -156.581761,<br>} | 10.0 | 8000000.0 | {<br> **latitude**: 90.0,<br> **longitude**: 0.0,<br>} |

***
