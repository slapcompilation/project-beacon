<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/geometryRotate2dV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Geometry rotate 2d

> Supported in: Streaming

Applies a two dimensional clockwise rotation centered at the provided GeoPoint to the supplied geometry. This rotation occurs in the provided coordinate reference system and is then projected back to WGS84.

**Expression categories:** Geospatial

## Declared arguments

* **Angle in degrees:** The angle in degrees of clockwise rotation.<br>*Literal\<Double>*
* **Centre GeoPoint:** The centre GeoPoint about which the rotation occurs. Assumed to be in WGS84.<br>*Expression\<GeoPoint>*
* **Geometry column:** The geometries on which the rotation is applied.<br>*Expression\<Geometry>*
* **Projected coordinate system:** Coordinate system identifier formatted as "authority:id". For example, UTM zone 18N could be identified by EPSG:32618. Geometries will be projected to the source coordinate system, have a rotation applied, then projected back to WGS84.<br>*Literal\<String>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **Angle in degrees:** 90.0
* **Centre GeoPoint:** `geoPoint`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326

| geometry | geoPoint | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[1.0, 0.0]} | {<br> latitude -> 0.0,<br> longitude -> 0.0,<br>} | {"type":"Point","coordinates":\[6.123233995736766E-17, -1.0]} |

***

### Example 2: Base case

**Argument values:**

* **Angle in degrees:** 270.0
* **Centre GeoPoint:** `geoPoint`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618

| geometry | geoPoint | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[-77.0, 20.0]} | {<br> latitude -> 22.0,<br> longitude -> -76.0,<br>} | {"type":"Point","coordinates":\[-73.8719606865239, 21.041418391118174]} |

***

### Example 3: Base case

**Argument values:**

* **Angle in degrees:** 180.0
* **Centre GeoPoint:** `geoPoint`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326

| geometry | geoPoint | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[0.0, 0.0], \[1.0, 0.0]]} | {<br> latitude -> 1.0,<br> longitude -> 1.0,<br>} | {"type":"LineString","coordinates":\[\[2.0, 2.0], \[0.9999999999999999, 2.0]]} |

***

### Example 4: Null case

**Argument values:**

* **Angle in degrees:** 90.0
* **Centre GeoPoint:** `geoPoint`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326

| geometry | geoPoint | **Output** |
| ----- | ----- | ----- |
| *null* | *null* | *null* |

***
