<!-- source: https://palantir.com/docs/foundry/pipeline-builder/dataexpectations-unit-tests/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Unit testing in Pipeline Builder

Improve the reliability of your pipeline in Pipeline Builder through unit tests. These tests serve as a valuable tool for debugging, detecting breaking changes, and ultimately ensuring higher quality pipelines.

## What is a unit test?

![Unit test explanation diagram.](./images/unit-test-architecture.png)

Similar to unit tests in code, unit tests in Pipeline Builder are a way to check that your pipeline logic produces the expected outputs when tested with predefined inputs. Unit tests consist of:

* Test inputs
* Transform nodes
* Expected outputs

Test inputs and expected outputs are created with manually entered tables, but you can copy and paste for faster creation. The transform nodes you want to test can be selected in your main Pipeline Builder workspace. To learn more about creating a unit test see below.

## Create a unit test

1. In the main workspace on the right side panel, select the **Unit tests** icon. <br><br>
   ![The unit test side bar.](./images/unit-test-side-bar.png) <br><br>

2. Select **Create new test** in the center of the screen or **New test** in the top right. This will open a dialog at the top of your workspace, prompting you to choose the relevant nodes. <br><br>
   ![The unit test initial selection screen.](./images/unit-test-initial-selection.png) <br><br>

3. Once all relevant nodes are chosen, select **Start**. <br><br>
   ![The selected nodes to include in the unit test.](./images/unit-test-selected-boards.png) <br><br>

   This will take you to the unit test configuration window.

   * Yellow nodes correspond to previously selected transform nodes.
   * Green nodes correspond to test inputs.
   * Blue nodes correspond to test outputs.

   For every unit test, you must fill out the input and output data. <br><br>
   ![The initial edit screen in a unit test.](./images/unit-test-initial-edit-screen.png) <br><br>

4. Fill out the input data or expected output data by double clicking on the node. This will take you to the page below: <br><br>
   ![The add input or output data page in a unit test.](./images/unit-test-data.png) <br><br>

   On the left side select:

   * **Reuse schema:** To set the output schema to match the schema of the connected table.
   * **From dataset:** To use a schema from an existing dataset.
   * **Add column:** To manually enter the data schema.

   Once the schema is set, fill out the rows in the center table and select **Apply**, then **Back to graph**. <br><br>
   ![The add input or output data page in a unit test.](./images/unit-test-manual-data-fill.png) <br><br>

5. Repeat this step for all input and output datasets.

When you are done, you will be able to see the manually entered data on the right side panel detailing the number of rows and columns in each table.

![A unit test with inputs and outputs filled.](./images/unit-test-with-data-filled.png)

## Run a unit test

For each unit test, you have the option to **Run test** on the top right.

![The Run test button for a unit test.](./images/unit-test-run-test.png)

Once the test runs, you can see the test results underneath. To view the exact table results, select **View test result**.

![A failed and passed test result, respectively.](./images/unit-test-pass-fail.png)

This will open a view of the expected and received output at the bottom of your screen.

![The expected and received outputs shown at the bottom of the screen.](./images/unit-test-full-screen.png)

When you are done editing and viewing your unit test, you can select **Close unit test** in the top right.

## Delete a unit test

To delete a unit test, select it and open the options menu using the three dots in the top right corner. Select **Delete test case**.

![How to delete a unit test.](./images/unit-test-delete-test.png)

## Edit existing unit tests

Select the **Unit tests** icon to see a list of the unit tests in your pipeline. Select the pencil icon to edit the selected unit tests.

![The list of unit tests in the pipeline.](./images/unit-test-edit-unit-test.png)

To change the selected test transforms in a unit test, use the **Re-select** button. This will take you back to the selection page.

![The reselection process for a unit test.](./images/unit-test-selection.png)

:::callout{theme="neutral"}
If you add nodes between nodes that are already included as test transforms in a unit test, the added nodes will automatically show up in the existing unit test.
:::

To change any of the test inputs or expected outputs, you can double click directly on the nodes in the graph view, or select the pencil icon on the right side panel.

![The inputs and outputs edit page in a unit test.](./images/unit-test-edit-input-output.png)

When you are done editing the unit test, select **Close unit test** on the top right to return to the main graph.

## Unit testing in proposals

Any changes to unit tests will also show up in the proposals page under the **Unit Test** tab on the left side panel.

![Unit tests on the proposal page.](./images/unit-test-changes.png)

On the proposal page, you will see the **Unit tests succeeded** section. Pipeline Builder will check that unit tests pass before merging a proposal.

![Unit tests on the proposal page.](./images/unit-test-proposal-page.png)

## Unit testing in streaming

For streaming unit tests, test input data requires an additional `ordering` long type value for each row.

![Unit tests on the proposal page.](./images/unit-test-ordering-column.png)

The ordering column is a required metadata column for streaming unit tests that controls the global order in which the rows will be emitted, but does not impact the actual contents or schema of the test data. The ordering value should be a unique long type value for each row in all test data sources in a test, and rows will be emitted from the sources in order from lowest ordering value to highest.

Ordering is important to achieve deterministic and desired outputs from streaming transforms, especially for joins and unions.
