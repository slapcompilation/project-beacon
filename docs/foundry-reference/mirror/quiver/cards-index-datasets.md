<!-- source: https://palantir.com/docs/foundry/quiver/cards-index-datasets/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Dataset cards

Back to: [Index of cards](/docs/foundry/quiver/cards-index/)

Cards in this section support the analysis of Foundry [datasets](/docs/foundry/data-integration/datasets/) and Ontology [materializations](/docs/foundry/object-edits/materializations/).

Datasets are a [data type](/docs/foundry/quiver/analysis-data-model/#list-of-input-and-output-types) in Quiver that provide a way to transform, visualize and analyze data at scale, with the capacity to surpass the 50k row constraint on data joins and transformations present in transform tables.

![Dataset cards menu](./images/quiver-materialization-cards-menu.png)

Specifically, Dataset cards allow you to:

* Perform high-scale joins (left/right/inner/full)
* Derive new columns, filter, or aggregate
* Plot data using [categorical charts](/docs/foundry/quiver/cards-index-charts/)
* Convert to a transform table and use [Vega plots](/docs/foundry/quiver/cards-vega-plot/)

Dataset cards also take object sets as input. Quiver will seamlessly convert these object sets into corresponding dataset representation in the background. From an object set, use any of the cards located under the **Datasets** next actions, or perform an explicit conversion with the [Object set dataset card](/docs/foundry/quiver/card-object-set-dataset/). Quiver will use the object type's [materialization](/docs/foundry/object-edits/materializations/) export dataset. If that is not available, it will attempt to use the backing [datasource dataset](/docs/foundry/object-link-types/create-object-type/#choosing-a-backing-datasource).

To view which backing dataset primitives are powering a Dataset card, hover over the datasource icon.

![Hover over the datasource icon to trace backing dataset primitives](./images/quiver-datasource-tracing.png)

The following cards are available:

* [Expression](/docs/foundry/quiver/card-expression/)
* [Filter dataset](/docs/foundry/quiver/card-filter-dataset/)
* [Join datasets](/docs/foundry/quiver/card-join-datasets/)
* [Dataset SQL](/docs/foundry/quiver/card-dataset-sql/)
* [Numeric aggregation (dataset)](/docs/foundry/quiver/card-numeric-aggregation-dataset/)
* [Object set dataset](/docs/foundry/quiver/card-object-set-dataset/)
* [Set math (dataset)](/docs/foundry/quiver/card-set-math-dataset/)
* [Unique column values (dataset)](/docs/foundry/quiver/card-unique-column-values-dataset/)
* [Categorical plot from dataset](/docs/foundry/quiver/card-categorical-plot-dataset/)
