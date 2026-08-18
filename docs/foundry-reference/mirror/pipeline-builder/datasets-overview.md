<!-- source: https://palantir.com/docs/foundry/pipeline-builder/datasets-overview/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Datasets

To create a pipeline, select a data input as a starting point. After adding a data input to a pipeline, the data can be cleaned, transformed, and combined with other data to be deployed for further use across the platform (for example, as part of the Ontology).

Pipeline Builder supports data inputs in the form of *structured*, *semi-structured*, and *unstructured* data.

**Structured data** typically comes in the form of **datasets** that consist of files containing tabular data and metadata about the columns in the dataset. The column metadata is stored alongside the corresponding dataset as a [schema](/docs/foundry/data-integration/datasets/#schemas). Pipeline Builder also supports the input of structured data in the form of manually entered data, uploaded data, data syncs, and [virtual tables](/docs/foundry/data-integration/virtual-tables/).

**Semi-structured data** refers to a **dataset** that consists of files without a schema, making the data non-tabular. Thus, semi-structured datasets are sometimes called "schema-less" datasets. Pipeline Builder supports semi-structured data in the form of XML, JSON, and CSV files. You can use parsing transform functions to convert semi-structured files into tabular form and benefit from schema safety. For XML data, Pipeline Builder can auto-generate schemas from XSD files—upload your XSD files to a raw dataset and reference them inside a Parse XML transform to automatically create the appropriate schema structure. Learn how to [transform data in your pipeline](/docs/foundry/pipeline-builder/transforms-transform-data/).

**Unstructured data** refers to other non-tabular forms of data, including visual media, PDF documents, audio, and more. Pipeline Builder supports unstructured data inputs in the form of [media sets](/docs/foundry/data-integration/media-sets/).

The first step towards defining a workflow in Pipeline Builder is to add one or more data inputs to your workspace. Learn how to [add data](/docs/foundry/pipeline-builder/datasets-add/) or [change input computation modes](/docs/foundry/pipeline-builder/datasets-computation-modes-for-batch/) in the following documentation, and learn more about data in Foundry by visiting [data integration](/docs/foundry/data-integration/datasets/#datasets).
