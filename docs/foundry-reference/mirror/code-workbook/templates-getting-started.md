<!-- source: https://palantir.com/docs/foundry/code-workbook/templates-getting-started/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Getting started

In this tutorial, we will run through:

* [Creating a chart](#creating-a-chart)
* [Creating a Template](#creating-a-template)
* [Using Templates](#using-templates)

## Creating a chart

Since `titanic_dataset` contains rows (representing passengers) and columns (representing information about the passengers), we can visualize passenger count for a given passenger property (such as Sex or Pclass) using a bar chart. For example, here is a breakdown of passengers by sex:

![template-bar-chart](./images/template-bar-chart.png)

In this example, you will create a transform that creates the desired chart. Create a Python transform named `bar_chart_of_row_counts` and insert the following code:

```python
def bar_chart_of_row_counts(titanic_dataset):
    import matplotlib.pyplot as plt
    from pyspark.sql import functions as F
    import numpy as np

    input_df = titanic_dataset
    categorical_column = "Sex"

    # calculate the counts
    total = input_df \
        .groupBy(categorical_column) \
        .agg(F.count("*").alias("count")) \
        .orderBy("count")

    # convert summarized dataset to pandas
    total_pdf = total.toPandas()

    # plotting code
    fig = plt.figure()
    ax = fig.add_subplot(111)

    y_pos = np.arange(len(total_pdf[categorical_column]))
    ax.set_yticks(y_pos)
    ax.barh(y_pos,total_pdf["count"])
    ax.set_yticklabels(total_pdf[categorical_column])
    plt.xlabel("count")
    plt.ylabel(categorical_column)

    plt.tight_layout()
    plt.show()

    # return the aggregated dataframe to save it as a dataset
    return total
```

When you run this transform, the chart shown above will appear in your Workbook in the transform node in the graph. You can also jump into a full screen image view by hovering over the chart in the transform node and selecting **View Image**. This image viewer can also be reached from the contents sidebar and the Visualization tab.

To create the chart as an SVG, use the following code before creating your plot:

```python
set_output_image_type('svg')
```

Or use the decorator for better visibility:

```python
@output_image_type('svg')
def bar_chart_of_row_counts(titanic_dataset):
    # ...
```

## Creating a Template

Next, convert this transform into a Template so it can be generalized and reused. Click on the **Actions** button in the top-right of your code editor and click **Create template**.

![creating\_a\_template\_1](./images/creating_a_template_1.png)

You will now be brought into a template creation view in the full screen editor.
In the Template editor, you can edit the Template’s name, description, and parameters. Name this Template `Bar Chart of Row Counts by Categorical Variable`, and give it a description as follows: `Create a transform with a bar chart of the row counts of 1 categorical column in any input dataset.`

![creating\_a\_template\_2](./images/creating_a_template_2.png)

Any input datasets — in this case, just `titanic_dataset` — are automatically added as parameters of type `dataset` for the Template. Click on `titanic_dataset` in the Template editor to change it. Since this template should be generic, change the parameter name from `titanic_dataset` to `input_dataset` and add a description.

![creating\_a\_template\_3](./images/creating_a_template_3.png)

Two instances of `{{{input_dataset}}}` will be highlighted in the transform code. Next, parameterize the input column. To assign a variable in the code body as an input parameter for the template, click **Add new parameter** in the top-right of the transform and highlight the appropriate variables in the code. Highlight the string `"Sex"` as shown below:

![creating\_a\_template\_4](./images/creating_a_template_4.png)

This adds this part of the code as a parameter of type `column` with the Source Dataset as `input_dataset`. In the Template editor, edit the `param1` parameter name and rename it to `selected_column`.

In this example code, we defined the column name as a variable at the top of the transform so that we only need to parameterize it once. When you are templatizing other transforms, you can use the **Add** button to add more instances of the same parameter.

Next, choose whether this template should be saved as a dataset by default. By checking the **Save as dataset** box, when added the template will be added as a persisted transform by default. If **Save as dataset** is left unchecked, the template will be applied as an unpersisted transform by default. In this case, choose to Save as Dataset by default because the output will be used in other applications.

![template-persistence](./images/template-persistence.png)

Finally, click the **Create template** button to create and save the Template. Whenever you create a new Template, you will have to choose a folder to save it in. For this example, you can save the Template in your home folder.

Templates can only be discovered and used by users who have access, so you can save a Template in your home folder while you are still working on it, and move it to a shared folder once you want to promote it for broader use. Templates can also be added to the [Data Catalog](/docs/foundry/compass/data-catalog/).

## Using Templates

After creating and saving a template, you can use the Template in a point-and-click manner.

![use-template-initial-screen](./images/use-template-initial-screen.png)

To view available templates, click **Browse all templates** in the transform creation view.

![template-library](./images/template-library.png)

Browse Templates supports searching for templates by name, description, and tags, or browsing based on Favorites, Recently used templates, or the Files structure. To apply a template, click its name and choose "Select". Add the template you just created.

After adding the template to the graph, you can rename the transform and fill out the inputs. Assign the `input_dataset` parameter by clicking **Click here to add dataset** and clicking the `titanic_dataset` in the graph. Now you can select any column as the `selected_column` parameter to create charts based on that column.

Select **Run** to compute the transform. For transforms that output a visualization, graph view is the default in the Graph. You can right-click, choose **Edit** and then **Show table view** to view the node as a table.

## Editing Templates

If you would like to update the code backing a template, click on **Actions** and then **Edit Template** to enter the code editor and edit the template.

![edit-template-button](./images/edit-template-button.png)
