<!-- source: https://palantir.com/docs/foundry/vertex/chained-models/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Configure chained models \[Sunset]

:::callout{theme="warning" title="Sunset"}
Model chaining in Vertex is in the [sunset](/docs/foundry/platform-overview/development-life-cycle/) phase of development and will be deprecated at a future date. Full support remains available. To continue using models in Vertex scenarios, we recommend [configuring a function for the model](/docs/foundry/model-integration/model-functions-guide/) and [importing that function](/docs/foundry/functions/functions-on-models/) into a [function-backed Action](/docs/foundry/action-types/function-actions-getting-started/).
:::

As you begin to connect systems and processes throughout your modeled universe, you must be able to understand how each individual aspect of your system interacts globally. Vertex allows you to chain together connected models to understand and quantify the end-to-end impact of changes, allowing for optimal decision-making.

Once you add a model to a case study, you can select **+ Add New Model** to search and select additional related models. Any value produced for a model output that is mapped to a parameter and used as input to a later model will propagate as the input value to that model. This value is denoted in the input cell using a link icon.

Selected models will be added to the scenario pane where you can select from the input/output parameters to display in the case study. These are selected per model shown.

Adding overrides in any of the selected model inputs will show impacted inputs in the chained models as you run "what if" simulations, and will trigger a baseline scenario to be run if the option is enabled.
