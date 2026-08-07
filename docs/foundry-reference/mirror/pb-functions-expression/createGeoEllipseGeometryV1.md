<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/createGeoEllipseGeometryV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create ellipse geometry

> Supported in: Batch, Streaming

Approximates an ellipse as a polygon centered at the given geo coordinate. The distance between points is computed along the surface of the WGS84 ellipsoid approximating the surface of the earth.

**Expression categories:** Geospatial

## Declared arguments

* **Center:** Longitude and latitude for the center of the ellipse.<br>*Expression\<GeoPoint>*
* **Semi-major axis length:** The length of the longest radius (half the axis) of the ellipse.<br>*Expression\<DefiniteNumeric>*
* **Semi-major axis length unit:** The unit of the semi-major axis length.<br>*Enum\<Centimeter, Data mile, Decameter, Decimeter, Foot, Hectometer, Inch, Kilometer, Meter, Mile, and more ...>*
* **Semi-minor axis:** The length of the shortest radius (half the axis) of the ellipse.<br>*Expression\<DefiniteNumeric>*
* **Semi-minor axis length unit:** The unit of the semi-minor axis length.<br>*Enum\<Centimeter, Data mile, Decameter, Decimeter, Foot, Hectometer, Inch, Kilometer, Meter, Mile, and more ...>*
* *optional* **Azimuth:** The angle between the major axis and the y axis. Positive angles indicate a clockwise rotation, while negative angles indicate a counter-clockwise rotation.<br>*Expression\<DefiniteNumeric>*
* *optional* **Azimuth angle unit:** The unit of the azimuth angle.<br>*Enum\<Degrees, Minutes, Radians, Seconds>*
* *optional* **Number of points:** The number of points used to approximate the ellipse.<br>*Expression\<Byte | Integer | Long | Short>*

**Output type:** *Geometry*
