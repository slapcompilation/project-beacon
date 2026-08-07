<!-- source: https://palantir.com/docs/foundry/aip-analyst/capabilities/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Capabilities

AIP Analyst uses tools to search, analyze, and present answers to your questions. You can customize which tools are available by selecting checkboxes from the **Tools** menu.

![The AIP Analyst tools menu.](/docs/resources/foundry/aip-analyst/aip-analyst-tools.png)

## Search

These tools let AIP Analyst find relevant resources across your Ontology using fuzzy keyword matching. The [search scope](/docs/foundry/aip-analyst/using-aip-analyst/#settings) settings in the **Settings** menu apply to these tools.

* **Object type search:** Identifies relevant object types based on object type metadata, such as display name, ID, description, or status.
* **Object search:** Searches across the entire Ontology or specified object types, returning matched objects grouped by object type.

## Look up

These tools load information about a specific resource using its identifier.

* **Object type lookup:** Retrieves comprehensive metadata for a *specific object type*, including properties and links to related object types.
* **Object lookup:** Retrieves a specific object from a given object type, returning all property values for that object.
* **Function lookup:** Retrieves a function's signature and a preview of its source code.
* **Action type lookup:** Retrieves metadata for a specific action type.
* **Dataset lookup:** Finds and previews datasets, including schema information and sample data.
* **Backing dataset lookup:** Retrieves the backing dataset for a given object type, enabling direct dataset-level analysis of Ontology data.
* **Workshop lookup:** Retrieves the object types, links, functions, and action types referenced by a Workshop module.
* **Notepad lookup:** Retrieves the content of a Notepad document.
* **Media set item lookup:** Retrieves a specific media item from a media set.

## Query and analyze

These tools create results that AIP Analyst can use as building blocks for further analysis, such as object sets, aggregations, and SQL query results.

* **Object set:** Creates an object set, optionally filtered or transformed by applying operations such as filters, search-arounds, or semantic search.
* **Import object set:** Imports existing object sets into the current analysis context.
* **Ontology aggregation:** Performs aggregation operations on object sets with optional grouping properties. Supported operations include count, sum, average, min, max, percentile, cardinality, standard deviation, and variance.
* **Ontology SQL:** Executes SQL queries against object sets, returning tabular data that can be used for complex analysis or chained into further queries. Queries can be chained, with each query referencing the results of a previous one.
* **Dataset SQL:** Executes SQL queries against datasets to retrieve and analyze data, returning tabular data that can be used for further analysis or chained into subsequent queries. Supports referencing multiple dataset branches.

## Functions and actions

AIP Analyst can execute functions and actions during analysis.

* **Function execution:** Executes functions to perform computations or data transformations. You can provide inputs and review outputs directly within the analysis session.
* **Action type execution:** Executes actions to create or modify objects. Actions require approval before execution, and can be reverted if needed.

## Visualization

AIP Analyst can present its outputs using several visualization tools:

* **Vega chart:** Builds interactive charts from tabular data such as Ontology aggregations, SQL results, or dataset queries.
* **Map visualization:** Visualizes object geospatial data on an interactive map.

## File and media support

You can upload files into an analysis for AIP Analyst to process:

* **Spreadsheets:** Excel (`.xlsx` and `.xls`) and CSV files.
* **Documents:** Word (`.docx`) files. Embedded images are extracted alongside the text, so the agent can interpret charts, diagrams, and screenshots from the document rather than only the prose.
* **Images:** JPEG, PNG, GIF, and WebP.
* **PDFs:** Both text and visual content are processed, so the agent can interpret charts, diagrams, and tables rendered on the page.

You can also attach media items from media sets as analysis context.

## Additional capabilities

* **Clarifying questions:** When a query is ambiguous, AIP Analyst may ask clarifying questions to refine its analysis approach before proceeding.
* **Context cleanup:** AIP Analyst automatically hides outdated or unnecessary information from earlier in the conversation, keeping the agent focused on the data relevant to your current question.
* **Manage tools:** Enables or disables tools during an analysis so AIP Analyst can focus on the capabilities relevant to the current question. You can still configure tools manually from the **Tools** menu.
