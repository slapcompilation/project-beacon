<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/createGeoPointFromCoordinateSystemV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create GeoPoint from coordinate system

> Supported in: Batch, Streaming

Takes a pair of coordinates from a source coordinate system and transforms them into WGS 84 latitude/longitude values. Coordinate systems (also know as coordinate reference systems or spatial reference systems) represent different systems for identifying the location of a point on the globe and are often identified by key in standardized databases such as EPSG. If the given projection is not supported or either coordinate is null, returns null. This expression is for advanced users. It is recommended to use the "Create GeoPoint" expression if you do not need to deal with coordinate systems.

**Expression categories:** Geospatial

## Declared arguments

* **Source coordinate system:** Coordinate system identifier formatted as "authority:id". For example, UTM zone 18N could be identified by EPSG:32618.<br>*Literal\<String>*
* **X coordinate:** X coordinate (often "easting") in the source coordinate system.<br>*Expression\<Numeric>*
* **Y coordinate:** Y coordinate (often "northing") in the source coordinate system.<br>*Expression\<Numeric>*

**Output type:** *GeoPoint*

## Examples

### Example 1: Base case

**Argument values:**

* **Source coordinate system:** EPSG:32618
* **X coordinate:** `x_coordinate`
* **Y coordinate:** `y_coordinate`

| x\_coordinate | y\_coordinate | **Output** |
| ----- | ----- | ----- |
| 322190.2233952965 | 4306505.703879281 | {<br> latitude -> 38.88944258,<br> longitude -> -77.05014581,<br>} |
| 323243.1361536059 | 4318298.06539618 | {<br> latitude -> 38.99585379643137,<br> longitude -> -77.04105678275415,<br>} |
| 407063.63465300016 | 4764873.719585404 | {<br> latitude -> 43.03086518778498,<br> longitude -> -76.14077251822197,<br>} |

***

### Example 2: Base case

**Argument values:**

* **Source coordinate system:** EPSG:28992
* **X coordinate:** `x_coordinate`
* **Y coordinate:** `y_coordinate`

| x\_coordinate | y\_coordinate | **Output** |
| ----- | ----- | ----- |
| 142735.75 | 470715.91 | {<br> latitude -> 52.22438577,<br> longitude -> 5.20771293,<br>} |
| 92891.44163 | 437357.50015 | {<br> latitude -> 51.9212285,<br> longitude -> 4.4843492,<br>} |
| 81047.96352 | 454913.24287 | {<br> latitude -> 52.0775512,<br> longitude -> 4.3084213,<br>} |

***
