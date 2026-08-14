<!-- source: https://palantir.com/docs/foundry/transforms-r/getting-started/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Getting started

This page explains the structure and configuration options available when using the Palantir R SDK to write data transformations in Foundry.

## Repository structure

Each R transform is defined and configured by a transforms spec, with the definition written in YAML format and saved in the `.transforms` folder. The full content of the repo project will be available at runtime and can be used for the transform.

```
.
├── .transforms
|    └── happiness_ranking.yml
|
├── project
|    └── src
|        └── top_10.R
└── .Rprofile
```

For R transforms published from [Code Workspaces](/docs/foundry/code-workspaces/overview/), transform spec files are rendered and configurable via the UI.

## Write and configure a simple R transform

In the example below, we write a simple data transformation that reads a tabular dataset, applies a filter using the R package `dplyr`, and produces an output dataset with the filtered result.

```R
library(foundry)
library(dplyr)

happiness_2019 <- datasets.read_table("happiness_2019")
top_10 <- happiness_2019 %>% filter(Overall_rank <= 10)
datasets.write_table(top_10, "top_10_happiest_countries")

```

Here, we have the corresponding transform spec file that contains the definition of the transform:

Replace the `dataset.rid` fields with the dataset RID of your input and output datasets. Note that output datasets must first be created manually as we do not currently support creating new output datasets during checks time.

You can add additional inputs and outputs by adding a new item to the `inputs` or `outputs` list.

```yaml
inputs:
- alias: "happiness_2019"
  properties:
    type: "dataset"
    dataset:
      rid: "<input dataset rid here>"
outputs:
- alias: "top_10_happiest_countries"
  properties:
    type: "dataset"
    dataset:
      rid: "<output dataset rid here>"
- alias: "second-output"
  properties:
    type: "dataset"
    dataset:
      rid: "<second output dataset rid here>"
runtime:
  type: "rscript"
  rscript:
    identifier: "R.4.1.x"
    filePath: "project/src/top_10.R"
```

Runtime configurations:

* `identifier`: Identifies the runtime for the transform; for example, R.4.1.x refers to R minor version release 4.1.
* `filePath`: The relative file path from the root of the project to the R script file that will be executed.

## Write unstructured data

In this example, we use `ggplot2` to generate a plot with a linear regression line and save the plot as a PNG to an output dataset.

```R
library(foundry)
library(ggplot2)

happiness_2019 <- datasets.read_table("happiness_2019")

png("/tmp/model_plot.png")
plot <- ggplot(happiness_2019, aes(GDP_per_capita, Overall_rank)) + geom_point() 
plot + stat_smooth(method = "lm", formula = y ~ x, geom = "smooth")
dev.off()

datasets.upload_files("/tmp/model_plot.png", "happinessGDP_plot")

```

```yaml
inputs:
- alias: "happiness_2019"
  properties:
    type: "dataset"
    dataset:
      rid: "<input dataset rid here>"
outputs:
- alias: "happinessGDP_plot"
  properties:
    type: "dataset"
    dataset:
      rid: "<output dataset rid here>"
runtime:
  type: "rscript"
  rscript:
    identifier: "R.4.1.x"
    filePath: "project/src/gdp_plot.R"
```

## Manage R packages and environments

By default, R transform repositories are configured with [Artifacts Repositories](/docs/foundry/code-repositories/artifact-repositories-overview/) that mirror Posit™ Package Manager and Bioconductor. We recommend that users use [renv ↗](https://rstudio.github.io/renv/articles/renv.html) to install R packages and manage the R environment for their transforms.

In [Code Workspace RStudio® Workbench](/docs/foundry/code-workspaces/rstudio/), `renv` is installed and available by default. Users can search for available packages in the **Packages** panel and generate the corresponding R code to install them.

R transforms also support restoring from `renv.lock`. If there is a `renv.lock` file present in the repositories, you can run `renv.restore()` at the beginning of your transform or in `.Rprofile` to restore the R environment.

The following examples show R commands that can be run to install packages needed for an R transform and generate a `renv.lock` file to save the state of the project libraries. The generated lock file can then be committed and used to restore the project later.

```R
renv::install("dplyr")
renv::install("arrow")
renv::snapshot()
```

***

*RStudio® is a trademark of Posit™.*

All third-party trademarks (including logos and icons) referenced remain the property of their respective owners. No affiliation or endorsement is implied.
