<!-- source: https://palantir.com/docs/foundry/integrate-models/experiments-visualize/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Visualize experiments

Once published alongside a model version, experiments are immediately available to view and compare on the model page under the **Experiments** tab.

![Example experiments view showing three selected experiments.](/docs/resources/foundry/integrate-models/experiments-basic-view.png)

Experiment data is displayed with a hyperparameter table at the top, followed by line charts for each of the metrics. Each row of the hyperparameter table represents a single experiment, with each experiment's metric data overlaid on the charts.

## Select experiments

By default, only the latest experiment is selected for visualization. To populate the view with more experiments, select the **+** icon next to any experiment in the left sidebar.

![Select experiment button](/docs/resources/foundry/integrate-models/experiments-select-experiment.png)

Up to five experiments can be selected for comparison at once.

## Expand charts

Metric charts can be expanded to a larger view for a more in-depth view of the metric data.

![Full screen metric data.](/docs/resources/foundry/integrate-models/experiments-expand-button.png)

Select the expand button to open the experiment in a pop-up dialog.

![The expanded metric view.](/docs/resources/foundry/integrate-models/experiments-full-screen.png)

## Parallel coordinate plot

A parallel coordinate plot can help users understand how a change in a parameter value might affect the end result of a training job. To add a parallel coordinate plot to the view, select **Add** and then **Parallel coordinate plot**.

![Controls to add parallel coordinate plot](/docs/resources/foundry/integrate-models/add-parallel-coordinate-plot-control.png)

Once the new chart has been added, you can configure which parameters to show and what output metric value to render. Any parameter logged to any of the currently selected experiments may be added to the view.

![Parallel coordinate plot parameter config](/docs/resources/foundry/integrate-models/parallel-coordinate-plot-parameter-config.png)

The output metric value is one of the metric series logged to the experiment, where you can choose to view the **Last**, **Min**, or **Max** value.

![Parallel coordinate plot output metric config](/docs/resources/foundry/integrate-models/parallel-coordinate-plot-output-metric-config.png)

## Images

Images can be viewed on the **Images** tab; selecting experiments will populate the view with the image series for that experiment.

![Experiment images tab.](/docs/resources/foundry/integrate-models/experiment-images-tab.png)

Each card represents a single image series, where each segment of the card represents the series for a given experiment. You can scroll through the images using the controls in the top right, or switch to the **Grid** view to see more images at once.

![Experiment images grid view.](/docs/resources/foundry/integrate-models/experiment-images-grid-view.png)

Selecting an image will show a larger view of the image; you can also download the image from this view.

![Experiment images dialog view.](/docs/resources/foundry/integrate-models/experiment-image-dialog-view.png)

## Plots

Plots can be viewed in the **Plots** tab. Selecting experiments will populate the view with the plot series for that experiment.

![Experiment plots tab.](/docs/resources/foundry/integrate-models/experiment-plots-tab.png)

Each card represents a single plot series, where each segment of the card represents the series for a given experiment. You can scroll through the plots using the controls in the top right. Plots are interactive: hover to inspect points, zoom, and pan.

## Tables

Tables can be viewed in the **Tables** tab. If multiple experiments are selected, their tables will be displayed inline.

![The "Tables" tab under "Experiments".](/docs/resources/foundry/integrate-models/experiment-tables-tab.png)

Each card represents a single table, where each experiment's table is displayed inline within the card, color-coded to match the color assigned to the experiment.
