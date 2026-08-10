<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/createGeoRangeFanGeometryV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create range fan geometry

> Supported in: Batch, Streaming

Approximates a range fan as a polygon, specifying the region of all points whose haversine distance to the origin point is between the minimum and maximum radii, and to which the bearing from the origin is contained with the angular range centered around the specified bearing parameter. The left and right sides of the range fan are drawn as geodesic lines computed along the surface of the WGS84 ellipsoid approximating the surface of the earth. Returns null if the range spans more than 180 degrees while also crossing the anti-meridian, or if the maximum radius spans more than half of the circumference of the earth.

**Expression categories:** Geospatial

## Declared arguments

* **Bearing:** The bearing of the range fan relative to the north pole.<br>*Expression\<DefiniteNumeric>*
* **Maximum radius length:** The length of the maximum radius of the ellipse. Must be greater than the minimum radius and less than half of the circumference of the earth.<br>*Expression\<DefiniteNumeric>*
* **Maximum radius length unit:** The unit of the maximum radius.<br>*Enum\<Centimeter, Data mile, Decameter, Decimeter, Foot, Hectometer, Inch, Kilometer, Meter, Mile, and more ...>*
* **Minimum radius length:** The length of the minimum radius of the ellipse. Must be less than the maximum radius.<br>*Expression\<DefiniteNumeric>*
* **Minimum radius length unit:** The unit of the minimum radius.<br>*Enum\<Centimeter, Data mile, Decameter, Decimeter, Foot, Hectometer, Inch, Kilometer, Meter, Mile, and more ...>*
* **Origin:** Longitude and latitude for the origin of the range fan.<br>*Expression\<GeoPoint>*
* **Range:** The angular range of the range fan, centered on its bearing. Must be greater than 0 degrees. Range fans which both span over 180 degrees and cross the anti-meridian are not yet supported and will return null.<br>*Expression\<DefiniteNumeric>*
* *optional* **Bearing angle unit:** The unit of the bearing. Defaults to degrees.<br>*Enum\<Degrees, Minutes, Radians, Seconds>*
* *optional* **Number of arc points:** The number of points used to approximate arcs drawn on each side of the range fan.<br>*Expression\<Byte | Integer | Long | Short>*
* *optional* **Number of side points:** The number of points used to approximate sides of the range fan.<br>*Expression\<Byte | Integer | Long | Short>*
* *optional* **Range angle unit:** The unit of the range. Defaults to degrees.<br>*Enum\<Degrees, Minutes, Radians, Seconds>*

**Output type:** *Geometry*
