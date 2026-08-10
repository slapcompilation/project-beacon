<!-- source: https://palantir.com/docs/foundry/time-series/time-series-concepts-glossary/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Concepts glossary

The following list explains key concepts used in the creation of time series in Foundry. We recommend familiarizing yourself with these concepts to better understand how to effectively [set up](/docs/foundry/time-series/time-series-setup/) and [use time series](/docs/foundry/time-series/time-series-usage/) in your organization.

## Time series

Data that consists of one or more sets of timestamp and value pairs. Each pair represents a quantity at a point in time, thus each set of pairs measures a quantity over time; each set requires a unique identifier. For example, a group of machines may each have several sensors, with each sensor recording values at a regular cadence for the machine housing that sensor; each sensor for each machine will need to be uniquely identified.

## Time series object type

An object type (for example, *Machine*) where each object links to one or more sets of timestamp and value pairs via [time series properties (TSPs)](#time-series-property-tsp). Object-centric Foundry applications like Quiver, Vertex, and Workshop allow for analysis of TSPs.

## Time series object type backing dataset

A dataset required to create a [time series object type](#time-series-object-type); each row represents a single object (for example, *Machine 123*) of this time series object type and has the following schema:

| Column | Type | Description |
| --- | --- | --- |
| Primary key | `String` | *\[Required]* A primary key for each row |
| Series ID | `String` | *\[Required]* A [series ID](#series-id) column for each TSP |
| \<column name> | \<column type> | *\[Optional]* Additional information about each object |
| \<column name> | \<column type> | *\[Optional]* Additional configuration information for each TSP |

## Series ID

A foreign key in the time series object type used to fetch values from a [time series sync](#time-series-sync). Typically, the series ID is distinct within the time series object type backing dataset and has a one-to-many relationship with its corresponding rows in the time series sync.

## Time series property (TSP)

A property that provides a value that changes over time (for example, a temperature sensor reading). Each series ID column in the time series object type backing dataset maps to one TSP.

## Time series sync

The time series sync indexes time series data, which provides values for TSPs, in Foundry's time series database. Each row that is synced represents a TSP's value for a single point in time (for example, *Machine 123’s temperature at 12:00:00 on 01/01/2023 is 100\*F*). All values for a series ID should be contained in the same sync. These values are fetched through their series ID; thus, a single sync can contain all values for multiple series IDs. The sync should be created as a target output type in [Pipeline Builder](/docs/foundry/pipeline-builder/outputs-overview/) and contain exactly the following columns:

| Column | Type | Description |
| --- | --- | --- |
| Series ID | `String` | *\[Required]* The series ID for the set of timestamp and value pairs referred to by a TSP; they must match the TSP's series ID. |
| Timestamp | `Timestamp`, `Long` | *\[Required]* The time at which the quantity is measured. |
| Value | `Integer`, `Float`, `Double`, `String` | *\[Required]* The value of the quantity at the point that it is measured. A `String` type indicates a **Categorical** time series; each categorical time series can have at most 10,000 unique variants. |

:::callout{theme="warning"}
If a categorical time series exceeds the 10,000 unique variant limit, that series ID will error and no longer be accessible in the platform.
:::

## Qualified series ID

A qualified series ID has the following shape: `"{"seriesId":"<replace with series ID>","syncRid":"<replace with sync RID containing this series ID>"}"`. The value of a time series property that is backed by multiple time series syncs must be a qualified series ID, and it must be formatted as a JSON string with no newlines or spaces. [Learn more about setting up a qualified series ID](/docs/foundry/time-series/create-or-select-ts-ot/#multiple-datasets-for-a-single-measurement-type).

## Sensor object type

A time series object type with one default TSP that is linked to an object type for which it records time series data. The linked object type is sometimes referred to as the **root object type**.

## Derived series

Derived series are time series that are calculated with a formula that takes time series as inputs and saves them as a template. These templates are authored in the Time Series Catalog or in Quiver and can be referenced from a time series property for use in Ontology-aware applications.

## Bound object type

A time series object type from which a given derived series can be resolved. This object type is specified during derived series creation.

## Codex template

A codex template is used to store a templatized derived series formula that is executed at runtime when derived series are visualized or used within other calculations.
