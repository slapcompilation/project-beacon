<!-- source: https://palantir.com/docs/foundry/aip-analyst/using-aip-analyst/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Using AIP Analyst

This page covers the features and concepts that make up an AIP Analyst session.

## Context

Context is the information AIP Analyst has access to during an analysis, such as your previous messages, the agent's tool results, and any Foundry resources you have added.

You can add resources to context manually using the **+** button in the input field. You can also drag and drop Foundry resources directly into the chat input area to add them as context. Dragging a resource URL from another browser tab or from within Foundry will automatically resolve the resource and load it into your analysis. Supported resources include datasets, object sets, Notepad documents, Workshop modules, functions, and more. You can also paste Foundry resource identifiers (RIDs) directly into the input to import them.

You can manage context manually using the [outline](#outline), or let AIP Analyst handle it using the [context cleanup](/docs/foundry/aip-analyst/capabilities/#additional-capabilities) tool.

![Manually add context to AIP Analyst.](/docs/resources/foundry/aip-analyst/aip-analyst-manual-context-button.png)

## Settings

The **Settings** menu includes analysis settings and user preferences. Analysis settings affect the current analysis and are saved with [analysis resources](/docs/foundry/aip-analyst/analysis-resources/). Use the **Default** tab to configure values that apply to new analyses.

### Analysis settings

Use analysis settings to control search scope, semantic search behavior, and the personal resources that AIP Analyst can include as context.

<img src="./media/aip-analyst-settings.png" alt="The AIP Analyst 'Settings' menu." width="600">

**Search scope**

Use these settings to limit what AIP Analyst can search across:

* **Ontology:** Limit search to a single Ontology.
* **Object type groups:** Limit search to specific object type groups within the chosen Ontology.
* **Compass projects:** Limit search to object types within specific Compass projects.
* **Object type statuses:** Filter discoverable object types by status: `Endorsed`, `Active`, `Experimental`, `Deprecated`, or `Example`.
* **Object type visibilities:** Filter discoverable object types by visibility: `Prominent`, `Normal`, or `Hidden`.

When these limits are set, the **Object type search** and **Object search** tools only return results that match. For Ontologies with hundreds or thousands of object types, applying these filters can improve performance.

**Semantic search**

* **Object set semantic search similarity threshold:** Set the default similarity threshold for semantic search filters used by the object set tool, between 0.0 and 1.0. Higher values return fewer but more relevant results.

**Context sources**

* **Include recent resources:** Include context about your recently viewed resources in the conversation.
* **Include favorite resources:** Include context about your favorite resources in the conversation.

### User preferences

User preferences apply across analyses for the current user:

* **Theme:** Set the color theme.
* **Notifications:** If enabled, AIP Analyst can send notifications when in the background, allowing you to ask questions and be informed when an analysis requires your attention.

## Tabs and branching

An analysis path can be forked at any point, creating a new tab that only contains the prior context and enables users to explore multiple analysis paths from identical starting states. Empty analysis paths can be created using the **+** button in the tab header. Tabs will continue running even when not in focus.

![The option to create a new branch from a given message.](/docs/resources/foundry/aip-analyst/aip-analyst-branching.png)

## Outline

The analysis outline provides a structured summary of your session, displaying your questions, manually added context, and the agent's tool usage. Your messages appear with circle icons, while tool calls are marked with icons corresponding to their function.

You can use the outline to:

* Navigate quickly through prior analysis steps.
* Review token usage for each tool call.
* Hide specific tool results by selecting the eye icon that appears when hovering over outline items.

![An AIP Analyst outline.](/docs/resources/foundry/aip-analyst/aip-analyst-outline.png)

## Graph

To improve confidence in AIP Analyst output, you can trace the analysis by reviewing the **graph** view, which is a directed graph showing the provenance and logic path of each step in the analysis. The graph view allows you to:

* Trace how the agent arrived at its conclusions and check the logic of each step.
* Audit data transformations applied during analysis and ensure reproducibility of results.
* Verify that results are grounded in actual data rather than hallucinations. With AIP Analyst, you can view the Ontology data that is used at each step and ensure that all conclusions are accurate.

![A sample AIP Analyst graph.](/docs/resources/foundry/aip-analyst/aip-analyst-graph.png)

## Audio input

You can record audio input directly from the chat interface, enabling voice-driven analysis.

## Export to PDF

You can export an analysis session to PDF by selecting the **Export to PDF** option from the session header. The export dialog lets you select which context items to include, expand or collapse tool results, and preview the document before printing. This uses your browser's print dialog, allowing you to save the output as a PDF file.
