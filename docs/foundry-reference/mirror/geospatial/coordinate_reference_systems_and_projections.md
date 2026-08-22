<!-- source: https://palantir.com/docs/foundry/geospatial/coordinate_reference_systems_and_projections/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Coordinate reference systems and projections

Geospatial data can be stored in various [reference systems and projections ↗](https://en.wikipedia.org/wiki/Spatial_reference_system). Different projections can make it easier or harder to handle human-input numbers or perform area/length calculations. All 2D map projections distort real-world data by flattening the Earth, which is a 3D ellipsoid, to a screen/paper, which is a 2D surface. These distortions can occur in *shape*, *area*, *distance*, and *direction* (together known as *SADD*).

A library of all standard projections is available in the European Petroleum Survery Group (EPSG) [public registry ↗](https://epsg.io/). The most common projection is “standard” latitude and longitude ([WGS 84 aka EPSG:4326 ↗](https://epsg.io/4326)). However, source data often comes in a different projection, based on local conditions and norms. For example, many US-based customers use data captured using the North American Datum 1983 (NAD83), which has a different underlying model of the Earth’s surface than the one used by WGS 84.

It is important to understand the coordinate reference system (CRS) that your data uses, particularly if you are working with other data stored in a different CRS. If you have data from the same location which are stored in different coordinate reference systems, *these data will not line up on your map*. You should always consult key stakeholders and subject matter experts to clarify important questions related to CRS, data accuracy, and other best practices.

All maps in Foundry expect WGS 84 and use the [Web Mercator Projection ↗](https://en.wikipedia.org/wiki/Web_Mercator_projection).

Learn more about [manipulating CRS](/docs/foundry/geospatial/vector-data-in-transforms/) in PySpark transforms.
