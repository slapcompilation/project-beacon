<!-- source: https://palantir.com/docs/foundry/pipeline-builder/outputs-overview/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Outputs

**Pipeline outputs** are the end result of a pipeline in Pipeline Builder; outputs can be datasets, [virtual tables](/docs/foundry/data-integration/virtual-tables/), or Ontology components such as object types, object links, or time series.

Outputs help you describe your pipeline, from adding your data to creating transform logic. Outputs are created once you deploy your first pipeline build and allow you to expand your workflow and Project capabilities in other Foundry applications.

To add an output, select **Add pipeline output** in the outputs panel to the right of your graph.

<img src="./media/outputs-add-output@2x.png" alt="New pipeline creation page" width="800">

This will take you to the output type selection screen.

<img src="./media/outputs-output-types.png" alt="Output types" width="600">

Review the sections below for details on each output type.

## Datasets

A **dataset** is a fundamental element in Foundry. Workflows in Pipeline Builder start with adding datasets, continue with transforms on datasets, and can end with datasets as an output. Add a dataset as an output to when you want to build a pipeline that produces clean, transformed data. You can use your final dataset as a foundation for Ontology building in the Ontology Manager.

Learn more about [adding dataset outputs](/docs/foundry/pipeline-builder/outputs-add-dataset-output/).

## Media sets

A [media set](/docs/foundry/data-integration/media-sets/) is a collection of media files with a common schema, for example, files of the same format. Media sets support a variety of forms of unstructured data, including visual media, PDF documents, audio, and more. Add a media set as an output when you want to build a pipeline that produces clean, transformed media.

Learn more about [adding media set outputs](/docs/foundry/pipeline-builder/outputs-add-media-set-output/).

## Geotemporal series syncs

[Geotemporal series](/docs/foundry/geospatial/geotemporal-series-overview/) can be used to track the geographic position of entities over time, and consist of different observations. Each observation contains an identifier, timestamp, position, and other user-specified properties. You can add a geotemporal series sync output to your Pipeline Builder pipeline to make batch or streaming geotemporal data in Foundry available in downstream applications such as the Map application. Geotemporal observations from Foundry are written in Pipeline Builder.

Learn more about [adding geotemporal series syncs in Pipeline Builder](/docs/foundry/pipeline-builder/outputs-add-geotemporal-series-output/).

:::callout{theme="neutral"}
In order to use the geotemporal series sync output in Pipeline Builder, you must have geotemporal series enabled for your enrollment. Please contact your Palantir representative for any further questions about enabling this feature.
:::

## Virtual tables \[Beta]

A [virtual table](/docs/foundry/data-integration/virtual-tables/) acts as a pointer to a table in a source system outside of Foundry, and allows you to use that data in Foundry without ingesting it. Much like datasets, you can add virtual tables to your pipeline, continue with transforms, and end with a virtual table or a dataset as an output. Use a virtual table as an output when you want to use an external system for storage. Pipelines can include a mix of datasets and virtual tables; for example, you can start with a dataset and write your output externally, or you can start with a virtual table and write your output to Foundry.

Learn more about [adding virtual table outputs](/docs/foundry/pipeline-builder/outputs-add-virtual-table-output/).

## Ontology outputs

Add Ontology elements as outputs to your pipeline to guide your workflow from raw datasets to cleaned and structured data that defines a new object type element in your global Ontology. With Pipeline Builder, you can add and edit object types, link types, and time series within one workflow interface rather than navigating back to Ontology Manager.

Learn more about [adding Ontology outputs](/docs/foundry/pipeline-builder/outputs-add-ontology-output/).

### Object types

An **object type** is the schema definition of a real-world entity or event. Add an object type output to your workflow to help guide data transforms into defined elements that you can use to build applications in Foundry, including [Workshop](/docs/foundry/workshop/overview/) modules or [Slate](/docs/foundry/slate/overview/) applications.

### Object links

A **link type** is the schema definition of a relationship between two object types. A **link** refers to a single instance of that relationship between two objects. If you add two object type outputs to your pipeline, you can create a link to define their relationship and add to your global Ontology. Use object links to build robust applications in Workshop and Slate.

### Time series syncs

[Time series data](/docs/foundry/time-series/time-series-concepts-glossary/#time-series) are any data that consists of one or more sets of timestamp and value pairs; these pairs measure a quantity over time. This can include measuring sales volumes per year, total flights per day, production outputs per hour, or high frequency temperature readings at sub-second resolution. Add a time series sync output to your Pipeline to index data backing time series properties.

Learn more about time series [setup](/docs/foundry/time-series/time-series-setup/) and [usage](/docs/foundry/time-series/time-series-usage/).

Learn more about the [Foundry Ontology](/docs/foundry/ontology/overview/).
