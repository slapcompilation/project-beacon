<!-- source: https://palantir.com/docs/foundry/data-integration/connecting-to-data/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Connecting to data

The first step to getting value from Foundry is to connect it to your Organization's sources of data. Foundry's tools for connecting to data support the full range of standard enterprise data sources, ranging from cloud-based object stores, file systems, and databases and data warehouses.

You can connect to data in a variety of ways with different Foundry applications, depending on the type of data you need to access.

## Data Connection

Connect to sources to run batch, streaming, media, and CDC syncs and to use virtual tables.

The [Data Connection](/docs/foundry/data-connection/overview/) framework is designed to manage data over time, through discrete versions that are managed using dataset [transactions](/docs/foundry/data-integration/datasets/#transactions). This framework enables full lineage of data versions across time, providing you with an understanding of which sync tasks produced which versions of a given dataset. It also enables syncing of only the data required, in cases where full data loading on each sync is not possible.

Granular security in Data Connection allows federated management of data syncs across different teams. Collections of syncs, or even individual data syncs, can be made visible or editable to only specific teams (defined through role- or classification-based access controls). Learn more about [securing a data foundation](/docs/foundry/security/securing-a-data-foundation/).

You can manage sync metadata independently of the actual sync definitions. This allows for full branching of new configurations, where the new sync is sandboxed and tested in a branch before it affects any downstream transformation jobs.

## HyperAuto

To evolve beyond simple data syncing solutions, [Palantir HyperAuto](/docs/foundry/hyperauto/overview/) implements support for Software-Defined Data Integration (SDDI). This toolset allows organizations to not only connect to common ERP and CRM systems, but also to programmatically generate data pipelines that clean, normalize, and harmonize datasets into a cohesive data asset at unprecedented speed. This data asset can then feed into the [Ontology](/docs/foundry/ontology/overview/) to translate data into operational value.

## External transforms

Perform scheduled syncs and exports to external systems using REST APIs.

If you want to connect to external sources to create syncs and export data, we recommend using Code Repositories to write [external Python transforms](/docs/foundry/data-connection/external-transforms/) using the REST API. You can also add dataset inputs and media set outputs to your transforms.
