<!-- source: https://palantir.com/docs/foundry/pipeline-builder/evaluation-suite/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# LLM evaluation suite in Pipeline Builder

:::callout{theme="neutral" title="Beta"}
Pipeline Builder LLM evaluation suite is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

The large language model (LLM) evaluation suite in Pipeline Builder lets you test LLM transforms and logic before you deploy them in your pipeline. You can configure multiple evaluations in an evaluation suite and run them in an isolated test environment to observe their behavior.

The evaluation suite is designed to work with the [Use LLM node](/docs/foundry/pipeline-builder/pipeline-builder-llm/). Each evaluation runs a Use LLM node against testing data and one or more evaluators, then reports how the model output compares to your expected results.

This guide covers how to:

* Navigate to the evaluation suite
* Create a new evaluation
* Configure your evaluation
* Run your evaluation and check the results

## Navigate to the evaluation suite

Open the evaluation suite by selecting its icon at the bottom of the toolbar on the right side of your screen.

![The evaluation suite icon at the bottom of the right-side toolbar in Pipeline Builder.](./images/eval-suite-navigate.png)

In the **Evaluation suites** panel, you can either select an existing evaluation or create a new one. To create a new evaluation, select **+ New** in the top right of the panel.

## Create a new evaluation

Select the Use LLM node you want to evaluate on the graph, then select **Start**.

![The prompt to select a Use LLM node on the graph, with the Start option.](./images/eval-suite-select-node.png)

After you start a new evaluation, Pipeline Builder opens the evaluation suite configuration view.

![The evaluation suite configuration view showing the testing data, output, and evaluators fields.](./images/eval-suite-config-view.png)

## Configure your evaluation

Configure your evaluation by adding testing data, naming the evaluation, adding evaluators, and selecting an output dataset.

### Add testing data

Select the testing data you want to use in this evaluation by selecting **+ Add** in the **Testing data** field in the right-side panel.

![The Add option for the Testing data field in the evaluation suite configuration.](./images/eval-suite-add-testing-data.png)

:::callout{theme="neutral"}
Your testing data should include all the columns you want to evaluate as inputs for your Use LLM node. It should also include a column that contains the expected LLM outputs.
:::

### Name the evaluation and add evaluators

Name your evaluation in the text box at the top right of the panel. Then, add your evaluators by selecting the **+** icon next to the **Evaluators** label. A menu of available evaluators appears, from which you can select one or more evaluators.

![The Evaluators menu showing available evaluators such as Exact string match.](./images/eval-suite-evaluators-menu.png)

When you select an evaluator, Pipeline Builder opens a configuration page for that evaluator. The example below uses the **Exact string match** evaluator, which compares an **Actual value** column to an **Expected value** column and returns a Boolean result based on the **Passing condition**. You can also set the optional **Match case** and **Trim whitespace** parameters. After you apply your configuration, exit this view by selecting **Close** in the top right.

![The configuration page for the Exact string match evaluator.](./images/eval-suite-exact-string-match.png)

### Select the output dataset

Select the dataset where you want to store the output of your evaluation in the **Evaluation suite output** field. You can select an existing dataset or create a new one.

![The Evaluation suite output field with the option to select an existing dataset or create a new one.](./images/eval-suite-output-run.png)

## Run your evaluation and check the results

:::callout{theme="warning"}
You must have edit permissions on the pipeline to run an evaluation suite.
:::

After you configure your evaluation, select **Run evaluation suite** in the top right of your screen.

To track the progress of your evaluation, select the **Open build report** link in the top right of your screen.

![The Running status and the Open build report link in the evaluation suite panel.](./images/eval-suite-build-report-link.png)

In the build report, you can track your build live as it progresses.

![The build report showing the live progress of an evaluation suite build.](./images/eval-suite-build-report.png)

When your evaluation finishes building, view the results in the **Evaluation results** tab at the bottom of your screen. In this view, you can view a preview or the full set of results.

![The Evaluation results tab showing the evaluator output column and the passing result for each row.](./images/eval-suite-results.png)
