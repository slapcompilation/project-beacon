<!-- source: https://palantir.com/docs/foundry/geospatial/geotemporal-series-overview/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Geotemporal series \[Beta]

:::callout{theme="neutral" title="Beta"}
Geotemporal series are in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

[Geotemporal series](/docs/foundry/geospatial/types-of-geospatial-and-geotemporal-data/#geotemporal-series) data is used to track the geographic position of entities over time. Geotemporal series are conceptually similar to [time series](/docs/foundry/time-series/time-series-overview/) except they include a geospatial component.

Here are some examples of geotemporal series data that you can naturally model:

* The location and time of an aircraft flying between an origin and a destination
* GPS pings emitted every day by birds migrating across North America
* Tracking a package from distribution to delivery

You can use geotemporal series data to operationalize real-time position data on maps or analyze historic data to gain insights into trends over time and space.

## Use geotemporal series data

To use geotemporal series data in Foundry you must set up the following two components:

* **[Geotemporal series sync](/docs/foundry/geospatial/types-of-geospatial-and-geotemporal-data/#geotemporal-series-sync):** An integration backed by a dataset or stream that indexes geotemporal series data into an optimized database. You can configure geotemporal series syncs using [Pipeline Builder](/docs/foundry/pipeline-builder/outputs-overview/#geotemporal-series-syncs).
* **[Geotemporal series object type](/docs/foundry/geospatial/types-of-geospatial-and-geotemporal-data/#geotemporal-series-object-type):** Associates a geotemporal series with metadata and allows Foundry applications to access the series data. For example, you can include the origin and destination airports on the object type, which [references a geotemporal series](/docs/foundry/geospatial/types-of-geospatial-and-geotemporal-data/#geotemporal-series-reference-gtsr) that integrates the flight tracks.

Before you set up these components, review [data modeling for geotemporal series](/docs/foundry/geospatial/data-modeling/) for the required observation schema and data structure.

Learn more about [how to store geotemporal series in the Ontology](/docs/foundry/geospatial/integrate-geotemporal-series-with-the-ontology/).
