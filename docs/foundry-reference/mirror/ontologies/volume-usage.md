<!-- source: https://palantir.com/docs/foundry/ontologies/volume-usage/ · mirrored 2026-08-11 from Palantir Foundry docs -->

# Ontology volume usage

Foundry’s Ontology is a fast-access storage layer that allows you to bind object definitions to interactive data for queries, links, scenarios, and actions. Data in the Foundry Ontology is indexed for fast access and for safe edits by multiple simultaneous editors. Ontology volume is a measure of the total size of the indexed object sets and their links with each other. Ontology volume is an average metric that has the unit of GB for an instantaneous reading, but has the unit of GB-Month when measuring over the course of one month.

## Measuring Ontology volume

Ontology volume is recorded by measuring the size of the indexes that back the object type. Each object type has a number of objects and a number of properties per object. Each property can be of arbitrary size. The total size of the index is calculated by summing the size of each indexed property for every object of that object type.

:::callout{theme="neutral"}
It’s important to note that Ontology volume can be larger than dataset volume because Ontology data cannot be compressed, and Ontology indexing requires additional storage to facilitate faster queries.
:::

Every hour, the Foundry platform records a measurement of Ontology volume per object. When measuring Ontology volume over time, all hourly measurements are averaged over the given time period. Averaging over the course of one calendar month produces the *GB-Month* unit.

## Investigating Ontology volume usage

Objects are managed in the Ontology Manager, the hub for all administration and monitoring of objects. The Ontology Manager allows users to configure which datasets should become objects, what types of properties are attached to these objects, and which link sets are defined between object types.

The total Ontology volume for objects and their corresponding link types are listed in the Resource Management Application.

## Factors that drive Ontology volume

Ontology volume is effectively a measure of the size of all objects in the ontology, including their properties and links. The following two factors are the main drivers of total volume.

* **The number and size of objects per object type**
  * When creating an ontology object type out of a dataset, an object will be indexed per row of that dataset. Therefore, the number of rows in that dataset is tied 1:1 to the number of objects in the corresponding object type.
  * Additionally, datasets that have more columns or that contain more data (e.g. free text fields) can produce individual objects that are larger, because each column is turned into a property.
* **The number of links between objects when using join tables**
  * In many-to-many relationships, the Ontology requires the definition of a join table to define all of the links between objects based on their primary keys. These tables are indexed alongside the objects in the Ontology and use ontology volume.
  * In general, look-up tables have a constant size per record and grow linearly in volume with the number of links that are defined.

## Managing Ontology volume

The Ontology is designed to be a fast-access backend for operational usage and querying. In the general case, the Ontology is best used with highly refined data that is synthesized from a larger data asset. The volume of the Ontology should therefore be smaller than the total raw and intermediate data size in Foundry’s transformation framework.

To manage Ontology volume usage, pay attention to the number of object types that are defined in the Ontology, as well as the number of objects per object type and the number of properties per object. Overall, the best way to manage Ontology volume usage is to understand and deliberately manage object numbers, property counts, and property sizes.
