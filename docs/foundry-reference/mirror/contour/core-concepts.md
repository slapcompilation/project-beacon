<!-- source: https://palantir.com/docs/foundry/contour/core-concepts/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Core concepts

## Paths

Contour is a tool for top-down analysis and data transformation and sharing your results with others. An *analysis* in Contour consists of one or more analytical *paths*.

Each Contour *path* should begin with a particular dataset you are interested in; you can then add different Contour [*boards*](#boards) to visualize, filter, or transform the data. You can also bring in additional datasets and join them to your current set.

You can save the results of your path as a new, separate dataset in Foundry. The sequence of transformations you performed in the path is saved as a Foundry *job*, and is executed as part of the Foundry build system. This means that if one of the underlying datasets changes, or you change some part of the path, you can easily recompute your new dataset. (See [Builds](/docs/foundry/data-integration/builds/) for more information on how Foundry manages data.)

You can also refresh a path from your analysis to get the latest version of its underlying datasets.

## Boards

Exploration and analysis in Contour are performed through the use of [*boards*](/docs/foundry/contour/boards-overview/) in series. Some boards create charts or perform calculations, while others are used to manipulate your dataset by filtering, removing columns, and so on.

## Dashboards

With Contour, you can build [*dashboards*](/docs/foundry/contour/dashboards-overview/) that display the results and findings of Contour analyses. These dashboards support chart-to-chart filtering, inline parameter references, a fullscreen presentation view, and PDF exports.

## Parameters

Contour analysis [*parameters*](/docs/foundry/contour/analysis-parameterize/) allow you to easily switch between different views of the data and results. After defining parameters, you can use them in your analytical paths and expose them in dashboard mode. This allows end users of a dashboard to interact live with the data and results presented in the dashboard.
