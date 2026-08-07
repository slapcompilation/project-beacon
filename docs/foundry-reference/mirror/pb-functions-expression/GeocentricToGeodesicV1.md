<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/GeocentricToGeodesicV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert geocentric coordinates to WGS 84 geodesic coordinates

> Supported in: Batch, Streaming

Converts geocentric cartesian coordinates (also known as Earth-centered, Earth-fixed or ECEF coordinates) to geodesic polar coordinates. Altitude is defined as height-above-ellipsoid. If any coordinates are null, the output will be null.

**Expression categories:** Geospatial

## Declared arguments

* **X coordinate:** X coordinate in the source coordinate system.<br>*Expression\<Numeric>*
* **Y coordinate:** Y coordinate in the source coordinate system.<br>*Expression\<Numeric>*
* **Z coordinate:** Z coordinate in the source coordinate system.<br>*Expression\<Numeric>*

**Output type:** *GeoPoint with altitude*

## Examples

### Example 1: Base case

**Argument values:**

* **X coordinate:** `x_coordinate`
* **Y coordinate:** `y_coordinate`
* **Z coordinate:** `z_coordinate`

| x\_coordinate | y\_coordinate | z\_coordinate | **Output** |
| ----- | ----- | ----- | ----- |
| 0.0 | 6378137.0 | 0.0 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 0.0,<br> longitude -> 90.0,<br>},<br>} |
| 0.0 | -6378137.0 | 0.0 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 0.0,<br> longitude -> -90.0,<br>},<br>} |
| -6378137.0 | 0.0 | 0.0 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 0.0,<br> longitude -> 180.0,<br>},<br>} |
| -6378137.0 | -0.0 | 0.0 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 0.0,<br> longitude -> -180.0,<br>},<br>} |
| 0.0 | 0.0 | 6356752.314245179 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 90.0,<br> longitude -> 0.0,<br>},<br>} |
| 0.0 | 0.0 | -6356752.314245179 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> -90.0,<br> longitude -> 0.0,<br>},<br>} |

***

### Example 2: Null case

**Argument values:**

* **X coordinate:** `x_coordinate`
* **Y coordinate:** `y_coordinate`
* **Z coordinate:** `z_coordinate`

| x\_coordinate | y\_coordinate | z\_coordinate | **Output** |
| ----- | ----- | ----- | ----- |
| *null* | 0.0 | 0.0 | *null* |
| 0.0 | *null* | 0.0 | *null* |
| 0.0 | 0.0 | *null* | *null* |

***

### Example 3: Edge case

**Argument values:**

* **X coordinate:** `x_coordinate`
* **Y coordinate:** `y_coordinate`
* **Z coordinate:** `z_coordinate`

| x\_coordinate | y\_coordinate | z\_coordinate | **Output** |
| ----- | ----- | ----- | ----- |
| 1.0E-7 | 0.0 | 6356752.314245179 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 89.9999999999991,<br> longitude -> 0.0,<br>},<br>} |
| 1.0E-7 | 0.0 | -6356752.314245179 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> -89.9999999999991,<br> longitude -> 0.0,<br>},<br>} |
| -6378137.0 | -1.0E-7 | 0.0 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 0.0,<br> longitude -> -179.9999999999991,<br>},<br>} |
| -6378137.0 | 1.0E-7 | 0.0 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 0.0,<br> longitude -> 179.9999999999991,<br>},<br>} |

***
