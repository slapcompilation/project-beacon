<!-- source: https://palantir.com/docs/foundry/geospatial/data-modeling/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Data modeling

Geotemporal series should model a change in an entity's position over time, such as a plane flying from San Francisco to New York City. If your data does not include timestamps, positions, or uniquely-identifying [series IDs](/docs/foundry/geospatial/types-of-geospatial-and-geotemporal-data/#series-id), geotemporal series may not be appropriate for your use case.

## Observation schema

Each row in a [geotemporal series sync](/docs/foundry/geospatial/types-of-geospatial-and-geotemporal-data/#geotemporal-series-sync) adheres to the same schema, which is defined when the sync is created in [Pipeline Builder](/docs/foundry/pipeline-builder/outputs-overview/). A schema minimally includes the following *required* fields:

| Column | Type | Description |
| --- | --- | --- |
| Series ID | `String` | *\[Required]* The identifier for a sequence of observations, referred to by a geotemporal series reference (GTSR). Must be between 1-100 characters long, inclusive. |
| Timestamp | `Timestamp` | *\[Required]* The time the observation was emitted from a sensor. This may also be called the event timestamp. |
| Position | `GeoPoint` | *\[Required]* The latitude and longitude coordinates of the observation. |
| Altitude | `Double` | *\[Optional]* The height of the observation above the surface of the earth, in meters. Where needed for rendering, altitude is assumed to be height above ellipsoid (HAE), in meters.|

Additional data is often recorded alongside the observation, such as a plane reporting its heading or speed. Geotemporal series allow these additional data points to be captured alongside the required geotemporal series columns.

## Picking a series ID

Within a geotemporal series sync, you should choose a [series ID](/docs/foundry/geospatial/types-of-geospatial-and-geotemporal-data/#series-id) to group observations from the moving entity. The incoming data should include an identifier for a given entity that persists between observations. If no such identifier is provided, you can create an identifier from the data, for example, by concatenating a flight's number, origin, destination, and date. By including the date in the series ID, you ensure that each day's flight is treated as a separate series rather than flights over multiple days being associated with a single series.

The series ID is used to recall the latest point, track, and other properties related to the series. Conflicting series IDs result in poor map renderings or incorrect data.

## Live vs static properties

Properties on a geotemporal series schema, like speed or heading, are all "live" by default, meaning that they are expected to change on every observation. Usually, properties that do not change, or "static" properties such as a plane's call sign or flag, should be placed on the [geotemporal series object type](/docs/foundry/geospatial/types-of-geospatial-and-geotemporal-data/#geotemporal-series-object-type) rather than as properties on the geotemporal series itself. On rare occasions, it can be useful to denormalize a static property onto observations to enable search workflows. To support this, mark the geotemporal series property as "static" instead of "live", communicating to Foundry's geotemporal series database that the property can be sampled less frequently than "live" properties when compressing or downsampling tracks. Such "static" properties are still required to be specified on every incoming observation, even if they remain unchanged between observations.
