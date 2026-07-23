<!-- source: https://palantir.com/docs/foundry/logic/evaluations-getting-started/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Evaluation suites for Logic functions

The Logic **Preview** panel is great for one-off testing, but for greater confidence in your Logic functions, it is important to test against many inputs.

This tutorial will walk you through creating an evaluation suite for a simple Logic function with AIP Evals.

## Create an evaluation suite from Logic

For this example, we have a Logic function that takes restaurant reviews as input and categorizes them as positive or negative based on review sentiment. We want to create test cases with review inputs and the expected sentiment output to validate our function.

There are a few options to create an evaluation suite after saving your Logic function:

* From the **Preview** panel, you can create a new evaluation suite and simultaneously add a first test case by selecting **Add as test case**.
* From the **Evals** panel, you can select **Set up tests manually** to create an empty evaluation suite or select **Generate evals**, if your Logic function is eligible, to have AIP bootstrap useful tests and evaluators for you.

:::callout{theme="neutral"}
Select **View limitations** to learn about cases where AIP cannot automatically generate tests and evaluators. If your Logic function is not eligible for AIP-generated evals, then the **Generate evals** button will be disabled and display an explanation to help you understand why.
:::

![Create your evaluation suite from AIP Logic.](/docs/resources/foundry/aip-evals/aip-evals-getting-started-create.png)

After creating or generating the evaluation suite, you can add or modify test cases by selecting **Edit tests** in the AIP Evals panel. This will open the test case editor, where you can configure inputs for each test case and save the evaluation suite.

![Add test cases to the evaluation suite.](/docs/resources/foundry/aip-evals/aip-evals-getting-started-add-test-cases.png)

AIP will attempt to provide a descriptive name for your test case based off of the input parameters when you select **Add as test case** in the **Preview** panel or **Generate evals** in the **Evals** panel. You can also select the purple AIP star icon next to the test case name to generate a suggested name.

![Generate a suggested test case name.](/docs/resources/foundry/aip-evals/aip-evals-generate-name.png)

In this example, the suggested name of `Negative Review On Food Quality` adds more information than `Test case 1`:

![Suggested names offer a brief description of the test case parameters.](/docs/resources/foundry/aip-evals/aip-evals-generated-name.png)

After adding test cases, you can run the evaluation suite by selecting **Run evaluation suite** in the **Evals** panel. This will run all test cases in the suite. When the suite is done running, review the results by selecting the card in the **Most recent run** section.

![Run evaluation suite and review results](/docs/resources/foundry/aip-evals/aip-evals-getting-started-view-results.png)

If you created the evaluation suite from the **Set up tests manually** in the **Evals** panel or **Add as test case** in the **Preview** panel, AIP Evals will output the function's return value, but will not provide aggregated performance metrics. To scale your evaluation suite, add an [evaluator](/docs/foundry/aip-evals/create-suite/#evaluators) to compare the outputs produced by the Logic function against the expected values and calculate aggregate metrics. For this example, use the built-in **Exact string match** evaluator. In practice, depending on the nature of your function, you may need to use other evaluators or write custom ones.

To add an evaluator, select **+ Add** in the test case configuration header, then select **Exact string match > Add**. This will add the evaluator and open the evaluator editor, where you can map evaluator inputs to function outputs and test case columns. In this case, map the function output to the actual value and create a new parameter for the expected value. This will add a new column to the test case editor where you can input the expected sentiment for each test case.

You can configure the objective for each metric. For Boolean metrics, select whether a `true` or `false` value is considered a passing result. For numeric metrics, choose whether higher or lower values are better, and set a threshold if needed. The evaluation suite will automatically determine a `passed` or `failed` status for each test case based on these objectives.

![Add exact string match evaluator.](/docs/resources/foundry/aip-evals/aip-evals-getting-started-add-evaluator.png)

After saving, you can run the evaluation suite again to view the aggregated metrics for your function and the `passed` or `failed` results for each test case based on your configured objectives.

![Review results with string match evaluator.](/docs/resources/foundry/aip-evals/aip-evals-getting-started-evaluator-results.png)

Note that you do not have to run the entire suite every time you make a change to your function. You can run individual test cases by selecting the play icon next to the test case in the sidebar. This is useful for debugging and quickly iterating on your function.

After creating an evaluation suite, learn more about [evaluation suite run configurations](/docs/foundry/aip-evals/run-suite/).
