<!-- source: https://palantir.com/docs/foundry/geospatial/faq/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# FAQ

## Are geotemporal series generally available?

Geotemporal series are in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.

## When should I use geotemporal series instead of time series to display geospatial data?

If you plan to display your geospatial data on a [Gaia map](/docs/foundry/geospatial/add-ontology-data-to-gaia/), then you should use geotemporal series. [Geotemporal series](/docs/foundry/geospatial/overview/) require latitude and longitude coordinates alongside a timestamp and series ID. Use geotemporal series if your tracking data includes an additional measurement value alongside its coordinates, such as speed or altitude. Geotemporal series store latitude, longitude, and a measurement value together in a single series, which can simplify your data model when you need to correlate location with other values. [Learn more about integrating geotemporal series with the Ontology.](/docs/foundry/geospatial/integrate-geotemporal-series-with-the-ontology/)

If you plan to display your geospatial data on a [Foundry map](/docs/foundry/map/overview/), then you should use [time series](/docs/foundry/time-series/time-series-overview/). You can use [time series properties](/docs/foundry/time-series/time-series-properties/) to track the movement of entities over time by storing latitude and longitude pairs as *separate* time series to display on a Foundry map as [track objects](/docs/foundry/map/integrate-objects/#track-objects). Using time series for geospatial entity tracking is appropriate when your data contains latitude and longitude measurements recorded at different timestamps, such as GPS coordinates for ships or vehicles, *without* an additional measurement value. [Learn more about creating time series syncs that back track objects in your Ontology.](/docs/foundry/time-series/geospatial-time-series-use-case/)

### Can I implement both geotemporal series and time series simultaneously?

If you plan to view your geospatial data on *both* Foundry and Gaia maps, then you can [create a geotemporal series sync that produces a geotemporal reference property](/docs/foundry/geospatial/integrate-geotemporal-series-with-the-ontology/) *and* [create a time series sync that produces time series properties](/docs/foundry/time-series/geospatial-time-series-use-case/) on your object type. Objects displayed on a Foundry or Gaia map that implement both are read-only, so users may *only* view the objects on each map as opposed to executing actions on one or multiple. You should avoid implementing both series types unless necessary for your specific use case.
