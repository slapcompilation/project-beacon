<!-- source: https://palantir.com/docs/foundry/pipeline-builder/pipeline-builder-aip/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# AIP features in Pipeline Builder

Pipeline Builder has a collection of AIP capabilities to help you build custom workflows and better understand and manage your pipelines.

## AIP capabilities for custom workflows

:::callout{theme="neutral"}
To use the following features, users must be [granted permission for AIP capabilities for custom workflows](/docs/foundry/aip/enable-aip-features/#aip-and-capabilities-for-custom-workflows) by a platform administrator.
:::

### Use LLM node

The [Use LLM node](/docs/foundry/pipeline-builder/pipeline-builder-llm/) feature offers a convenient method for executing Large Language Models (LLMs) on your data at scale. You can seamlessly incorporate LLM processing logic between various data transformations, simplifying the integration of LLMs into your pipeline with no coding required.

Alongside Palantir-provided models, the **Use LLM** node supports [registered models](/docs/foundry/aip/bring-your-own-model/) backed by a [REST API source in Data Connection](/docs/foundry/aip/rest-api-backed-models/) or a [compute module](/docs/foundry/aip/compute-module-backed-models/). Select the **Registered** tab in the model selector to choose one of your registered models.

You can also configure fallback models to improve resilience. By specifying a prioritized list of models, if the primary model encounters a non-retryable error, subsequent models are automatically attempted in order. When a fallback is triggered, a debug message notifies you of the model switch.

![The Pipeline Builder model selector with the Registered tab showing a registered model.](./images/new-pb-model-selector.png)

### Text to embeddings

:::callout{theme="warning"}
Embedding text is computationally expensive and may result in slower previews and builds.
:::

You can embed text as vectors with the [`Text to embeddings`](/docs/foundry/pb-functions-expression/textToEmbeddingsV2/) expression by providing it with strings to convert to an embedded vector. These vectors are designed to capture the semantic meaning of words or phrases, enabling advanced text analysis and operations.

You can also select an embedding model backed by a [registered model](/docs/foundry/aip/bring-your-own-model/), whether registered through a [REST API source in Data Connection](/docs/foundry/aip/rest-api-backed-models/) or a [compute module](/docs/foundry/aip/compute-module-backed-models/).

![The Text to embeddings expression configured with a model in Pipeline Builder.](./images/text-to-embedding.png)

### LLM evaluation suite

:::callout{theme="neutral"}
Pipeline Builder LLM evaluation suite is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

The [LLM evaluation suite](/docs/foundry/pipeline-builder/evaluation-suite/) lets you test LLM transforms and logic before you deploy them in your pipeline. You can configure multiple evaluations in an evaluation suite and run them in an isolated test environment to observe their behavior.

The evaluation suite is designed to work with the [Use LLM node](#use-llm-node). Each evaluation runs a Use LLM node against testing data and one or more evaluators, then reports how the model output compares to your expected results.

:::callout{theme="neutral"}
AIP feature availability is subject to change and may differ between customers.
:::

## Pipeline Builder assistant features

### Explain

Use the **Explain** feature to dynamically obtain descriptions for your pipelines through every step of the development process. Keep your collaborators in sync on the current state, provide valuable context for new approvers, or facilitate knowledge transfer between new team members with minimal maintenance effort.

![The AIP Explain feature on the Pipeline Builder graph.](./images/aip-explain-button.png)

To use Explain, select the purple lightbulb labeled **AIP** in the top center of your Pipeline Builder graph. Following the instructions in the pop-up window, select tables on the graph as inputs. Hold and select on a node to add or remove it from your selection. Your selection must contain at least one transform node and be a connected set of nodes with a single output.

![Follow the instructions to select nodes in your graph,](./images/aip-explain-select-node.png)

Hold and select a node to add or remove it from your selection. Your selection must contain at least one transform node and be a connected set of nodes with a single output.

Finally, select **Explain xx nodes** to generate a transform explanation.

![The Explain feature will generate an explanation for the selected nodes.](./images/aip-explain-generate.png)

![Read the output to learn more about the selected nodes.](./images/aip-explain-node.png)

You can also explain a single node by selecting it and choosing the purple **Explain** button from the menu that appears to the right.

![Explain a single node on the graph](./images/aip-explain-single-node.png)

Additionally, you can choose to explain any set of transforms within a node.

![Explain a set of transforms when searching for transforms.](./images/aip-explain-transfrom-set.png)

Learn more about [transforms in Pipeline Builder](/docs/foundry/pipeline-builder/transforms-overview/).

### Suggest names and descriptions

You can also use AIP in Pipeline Builder to quickly document your work by generating a suggested name and description for any transform node.

Select the purple AIP star icon next to the default transform name to generate a suggested name.

![Generate a suggested transform node name.](./images/aip-transform-assist.png)

In this example, the suggested name of `Open claims by landlord...` adds more information than `Transform path`:

![Suggested names offer more information about the transform.](./images/aip-transform-suggested-name.png)

Select the purple **Generate** button to generate a suggested description.

![Generate a suggested transform node description.](./images/aip-transform-description.png)

In this example, the description provides more details about a transform that groups claims data by landlord ID:

![Suggested descriptions offer more information about the transform.](./images/aip-transform-suggested-description.png)

The generated suggestions are short summaries of the transform path. Once you save a generated name or description, the information is automatically persisted in the pipeline and visible to collaborators.

To suggest up to 10 nodes at a time, open the **Suggestions** tab at the bottom of the screen.

![A Pipeline Builder graph with multiple nodes in red and green. A purple Suggestions tab appears in the node preview.](./images/aip-bulk-suggest.png)

Select one or more nodes on your pipeline to generate a name and description if they do not already exist.

![The purple Suggestion tab in the node preview is empty because no nodes in the graph are selected.](./images/aip-bulk-select.png)

Select **Apply** on each suggestion to save the change to the node.

![Multiple red nodes are selected on the graph, and the Suggestion tab lists four suggestions.](./images/aip-bulk-apply.png)

### Transform Assist

The Transform Assist feature can help you make the best use of the many transformation options available to you in Pipeline Builder. Using the power of AIP, the regex helper can generate regular expressions based on your input and update existing expressions. Additionally, with the timestamp formatter, you can quickly transform cast board values from `string` into `timestamp`.

#### Regex helper

The regex helper simplifies the process of creating data pipelines by providing you with accurate and efficient regex patterns to extract, replace, and find strings within your data. To use the regex helper, first create a new transform board that uses regex parameters: regex extract, regex extract all, regex replace, regex find, or regex match. In the example below, we use the regex extract transform on the expression column `email_string`.

Select the purple AIP star icon next to the **Pattern** field, then describe the regular expression you want to create. In this example, we want to search for email domains.

![Use regex helper to help create precise regular expressions](./images/aip-regex-helper.png)

Select the purple **Generate** button to view the results.

![Easily create and apply regex to your data.](./images/aip-regex-helper-results.png)

##### Update existing expressions

You can also use the regex helper to update an existing regular expression.

Select the purple AIP start icon next to the **Pattern** field. Then, enter the regular expression you want to modify, followed by the modification. In the example below, the regular expression `@([\da-z\.-]+\.([a-z\.]{2,63})` should be modified to include uppercase.

![Use regex helper to modify an existing regex.](./images/aip-modify-regex.png)

Select the purple **Generate** button to view the result.

![Easily modify and apply updated regex to your data.](./images/aip-modify-regex-results.png)

#### Timestamp formatter

The timestamp formatter offers a time-saving solution for quickly casting strings to timestamps in cast boards. To use the timestamp formatter, first create a new cast board configured to cast from string to timestamp. In the example below, we have timestamps with different formats:

![An example of a cast to timestamp board in Pipeline Builder.](./images/aip-timestamp-formatter.png)

Then, select the purple **Generate** button to enter an example of the parsing format you want to use in the cast. In our example, we will paste all five timestamps:

![A box will appear to enter the parsing format you want to use.](./images/aip-generate-timestamp.png)

AIP will then generate a set of formats matching these timestamps and enter them into the cast board. Select **Apply.**

![Once the formats generate, they will automatically be added to the board.](./images/aip-apply-timestamp-format.png)

The string column is then parsed into a timestamp column.

![Your dataset now has a parsed timestamp column along with the original string column.](./images/aip-cast-string-to-timestamp.png)

Learn more about [transforms in Pipeline Builder](/docs/foundry/pipeline-builder/transforms-overview/).

#### Generate proposal descriptions

You can also use AIP in Pipeline Builder to quickly describe your changes by generating the proposal description when making your proposal.

![After changes have been made, create a proposal.](./images/aip-proposal-graph.png)

To do this, first select **Propose** in the top right corner. This will bring you to the proposal creation view.

![A new proposal.](./images/aip-proposal-new.png)

Now select the purple **Generate** button. AIP will write a proposal description of the changes to the pipeline on your branch.

![Generated proposal description.](./images/aip-proposal-description.png)

In this example, there were multiple changes, including changes to some pipeline settings. AIP describes all of them for you.

You can also type in additional context, bring attention to particular changes, or even start writing a rough proposal description into the text box before you select **Generate**. AIP will use this to enhance its proposal description. The generated description will be added below your text, with a clear separation.

![Another generated proposal description, with user prompt beforehand.](./images/aip-proposal-generated.png)

To generate again or change the description you have provided, ensure only the relevant text is in the text box before you select **Generate**. For best results, all other text, including any previously generated description should be deleted.

### Generate

Use the **Generate** feature to create new data transformation logic given a user prompt. AIP can access the full suite of data transformations available to you across Pipeline Builder, recommending the most suitable ones for your specific needs. This provides transparency into the reasoning and rationale used to suggest transformations, using metadata to generate logic, without exposing the underlying data. Finally, AIP transformations are saved into your pipeline logic like regular data transformations, enabling seamless integration into existing workflows.

![The AIP Generate feature on the Pipeline Builder graph.](./images/aip-generate-complete.png)

To use the generate feature, select the purple **AIP** icon with two stars at the top center of your Pipeline Builder graph. Following the instructions in the pop-up window, select nodes on the graph as inputs. Hold `Cmd` (MacOS) or `Ctrl` (Windows) and select a node to add or remove it from your selection.

![The AIP Generate feature starting state.](./images/aip-generate-starting-state.png)

Next, enter the prompt for AIP to evaluate, then select **Generate** to start the run.

![The AIP Generate feature with a user entered prompt.](./images/aip-generate-prompt.png)

This will return one or more transform nodes highlighted in purple alongside a description of the generated transforms.

![The AIP Generate feature with a union transform returned.](./images/aip-generate-union.png)

To continue transforming, select **Back to generate**. Choose the next set of nodes and enter the next prompt to continue building your pipeline.

![The AIP Generate feature with several joins returned.](./images/aip-generate-join.png)

To look back at your recent prompts, select the input box. You can retry any prompt by choosing a historical entry which will automatically select the original inputs.

![The AIP Generate feature with recent prompts shown.](./images/aip-generate-history.png)
