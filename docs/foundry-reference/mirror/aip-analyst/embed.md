<!-- source: https://palantir.com/docs/foundry/aip-analyst/embed/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Embed AIP Analyst

AIP Analyst can be embedded in Workshop or OSDK applications using an iframe. It supports a number of URL parameters to allow for specialization. Parameters that accept multiple values take a comma-separated list (for example, `objectTypeGroupRids=group1,group2`).

For a deeper integration inside Workshop modules, see the [AIP Analyst Workshop widget](/docs/foundry/aip-analyst/workshop-widget/).

## Control which data AIP Analyst can access

* **`ontologyRid`:** Sets the Ontology that AIP Analyst can explore, for example, `ri.ontology.main...`.
* **`objectTypeGroupRids`:** Limits AIP Analyst to searching across specific object type groups.
* **`compassProjectRids`:** Limits AIP Analyst to searching across resources within specific Compass projects or folders.
* **`hideManualContextMenu`:** Prevents users from manually adding other data sources when set to `true`.

```plaintext
/workspace/aip-analyst?ontologyRid=ri.ontology.main.abc123&objectTypeGroupRids=group1,group2&hideManualContextMenu=true
```

## Pre-load the session

Pre-fill the user's first message, or pre-load [context](/docs/foundry/aip-analyst/using-aip-analyst/#context) so users start with relevant resources already available:

* **`workshopRids`:** Load object types, links, and functions from your Workshop module, for example `ri.workshop.main.module...`.
* **`objectSetRids`:** Load saved object sets, for example `ri.object-set.main...`.
* **`datasetRids`:** Load specific datasets.
* **`objectTypeIds`:** Load individual object types.
* **`objectRids`:** Load individual objects.
* **`functionRids`:** Load individual functions.
* **`actionTypeRids`:** Load individual action types.
* **`notepadRids`:** Load Notepad documents.
* **`initialMessage`:** Pre-populate the first user message when AIP Analyst loads.
* **`autoStart`:** When `true` and `initialMessage` is set, AIP Analyst sends the initial message and begins analysis as soon as the page loads. Use this to embed "ask and answer" experiences that respond to context from the host application.

```plaintext
/workspace/aip-analyst?workshopRids=ri.workshop.main.module.xyz789&initialMessage=Summarize+sales+by+region&autoStart=true
```

## View options

* **`embedded`:** Hides the workspace sidebar for a cleaner look when set to `true`.
* **`hideSettingsMenu`:** Hides the settings menu when set to `true`.
* **`theme`:** Set the color theme (`light` or `dark`).
* **`modelRid`:** Set a specific model to use for analysis.

:::callout{theme="neutral"}
URL parameters cover only a subset of the available settings. For anything you cannot configure with a parameter, create a Workshop module containing a single full-page [AIP Analyst widget](/docs/foundry/aip-analyst/workshop-widget/), configure it there, and embed that module instead. The widget exposes far more granular control, including which interface elements are visible, which tools are enabled by default, and how analyses are saved and loaded.
:::
