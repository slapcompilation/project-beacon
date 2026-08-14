<!-- source: https://palantir.com/docs/foundry/transforms-python/getting-started/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Getting started

:::callout{theme="success" title="Tip"}
The instructions below will guide you through a simple Python data transformation. If you are just getting started with data transformation, consider going through the batch pipeline tutorial for [Pipeline Builder](/docs/foundry/building-pipelines/create-batch-pipeline-pb/) or [Code Repositories](/docs/foundry/building-pipelines/create-batch-pipeline-cr/) first.
:::

This tutorial walks through how you can use Python transforms to transform a spreadsheet of recent meteorite discoveries to a usable dataset ready for analysis.

## About the dataset

This tutorial uses data from [NASA’s Open Data Portal ↗](https://data.nasa.gov/). You can follow along on your own code repository with this sample dataset:

[`Download meteorite_landings`](/docs/resources/foundry/transforms-python/meteorite_landings.csv)

This dataset contains data about meteorites that have been found on Earth. Note that the data has been cleaned to make it easier to work with.

The dataset includes name, mass, classification, and other identifying information for each meteorite, along with the year it was discovered and coordinates of where it was found. It is good practice to open the CSV to review the data before uploading it into Foundry.

## Set up a Python code repository

Get started by creating a Python code repository.

1. Navigate to a project, and select **+ New > Code repository**.
2. In the **Repository type** section, select **Pipelines**.
3. Select **Python** as the **Language**.
4. Choose to **Initialize repository**.

### Optional: Use a local Python repository

Alternatively, you can copy your local Python repository into Code Repositories with the following steps:

1. Create a new Python code repository, as described above.

2. On your local repository, remove your previous Git origin (if you cloned it from GitHub, for example): `git remote remove origin`

3. Add your code repository's Git remote URL: `git remote add origin <repository_url>`

   You can find your code repository URL in the top right corner of the GitHub interface. Select the green **Clone** button, then copy the Git remote URL. Confirm this by running `git remote -v` to return the code repository URL.

4. Merge the current `master` branch (or another branch of your choosing) in Code Repositories into your local branch: `git merge master`

   If an error about `refusing to merge unrelated histories` occurs, run the command: `git merge master --allow-unrelated-histories`. This will remove the current Git history associated with your previous remote GitHub repository.

   This merge will bring essential files to your local repository that are required to make commits and changes in Code Repositories.

5. Create a new branch and name it (`testbranch`, for example): `git checkout -b testbranch`.

6. Make your changes and commit them to your branch.

7. Perform `git push`, and confirm that the new branch appears in the Code Repositories interface. Verify that checks are successful.

Learn more about [local development](/docs/foundry/transforms-python/local-development/) in Code Repositories.

## Write a Python data transformation

Navigate to your Python transforms repository. The default `examples.py` file contains example code to help you get started. Note that you can choose between pandas, Polars, and Spark compute engines. For more information on choosing a compute engine, refer to the [compute engine comparison](/docs/foundry/transforms-python/compute-engines/) documentation.
Start by creating a new file in `src/myproject/datasets`, and call it `meteor_analysis.py` to organize your analysis. Make sure you import the required functions and classes. Define a transformation that takes your `meteor_landings` dataset as input and creates `meteor_landings_cleaned` as its output:

```python tab="Polars"
from transforms.api import transform, Input, Output


@transform.using(
    # Replace this with your output dataset path
    output=Output("/Users/jsmith/meteorite_landings_cleaned"),
    # Replace this with your input dataset path
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
)
def clean(output, meteorite_landings):
    df = meteorite_landings.polars()
    # Your data transformation logic
    output.write_table(df)
```

```python tab="DuckDB"
from transforms.api import transform, Input, Output


@transform.using(
    # Replace this with your output dataset path
    output=Output("/Users/jsmith/meteorite_landings_cleaned"),
    # Replace this with your input dataset path
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
)
def clean(ctx, output, meteorite_landings):
    conn = ctx.duckdb().conn
    # Your data transformation logic using SQL
    query = conn.sql("SELECT * FROM meteorite_landings")
    output.write_table(query)
```

```python tab="Pandas"
from transforms.api import transform, Input, Output


@transform.using(
    # Replace this with your output dataset path
    output=Output("/Users/jsmith/meteorite_landings_cleaned"),
    # Replace this with your input dataset path
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
)
def clean(output, meteorite_landings):
    df = meteorite_landings.pandas()
    # Your data transformation logic
    output.write_table(df)
```

```python tab="PySpark"
from transforms.api import transform, Input, Output


@transform.spark.using(
    # Replace this with your output dataset path
    output=Output("/Users/jsmith/meteorite_landings_cleaned"),
    # Replace this with your input dataset path
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
)
def clean(output, meteorite_landings):
    df = meteorite_landings.dataframe()
    # Your data transformation logic
    output.write_dataframe(df)
```

Now, suppose you want to filter your input dataset down to any “Valid” meteors that happened after the year 1950. Update your data transformation logic to filter the meteorites by `nametype` and `year`:

```python tab="Polars"
import polars as pl
from transforms.api import transform, Input, Output


@transform.using(
    output=Output("/Users/jsmith/meteorite_landings_cleaned"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
)
def clean(output, meteorite_landings):
    df = (
        meteorite_landings.polars()
        .filter(pl.col("nametype") == "Valid")
        .filter(pl.col("year") >= 1950)
    )
    output.write_table(df)
```

```python tab="DuckDB"
from transforms.api import transform, Input, Output

@transform.using(
    output=Output("/Users/jsmith/meteorite_landings_cleaned"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
)
def clean(ctx, output, meteorite_landings):
    conn = ctx.duckdb().conn
    query = conn.sql("""
        SELECT *
        FROM meteorite_landings
        WHERE nametype = 'Valid' AND year >= 1950
    """)
    output.write_table(query)
```

```python tab="Pandas"
from transforms.api import transform, Input, Output


@transform.using(
    output=Output("/Users/jsmith/meteorite_landings_cleaned"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
)
def clean(output, meteorite_landings):
    df = meteorite_landings.pandas()
    df = df[
        (df["nametype"] == "Valid") &
        (df["year"] >= 1950)
    ]
    output.write_table(df)
```

```python tab="PySpark"
from transforms.api import transform, Input, Output


@transform.spark.using(
    output=Output("/Users/jsmith/meteorite_landings_cleaned"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
)
def clean(output, meteorite_landings):
    df = (
        meteorite_landings.dataframe().filter(
            meteorite_landings.dataframe().nametype == 'Valid'
        ).filter(
            meteorite_landings.dataframe().year >= 1950
        )
    )
    output.write_dataframe(df)
```

## Build your output dataset

To build your resulting dataset, commit your changes and select **Build** in the top right corner. For more information about building datasets in Code Repositories, review the [Create a simple batch pipeline](/docs/foundry/building-pipelines/create-batch-pipeline-cr/) tutorial.

## Add to your data transformation

:::callout{theme="neutral"}
With Python transforms, you can create multiple output datasets in a single Python file.
:::

Let’s say you want to filter down even further to only meteors that were particularly large for their meteorite type. To do so, you will need to:

1. Find the average mass for each meteorite type, and
2. Compare each meteor’s mass to the average mass for its meteor type.

First, add a data transformation to `meteor_analysis.py` that finds the average mass for each meteorite type. This transformation takes your `meteor_landings` dataset as input and creates `meteorite_stats` as its output:

```python tab="Polars"
import polars as pl
from transforms.api import transform, Input, Output


@transform.using(
    # Output dataset name must be unique
    output=Output("/Users/jsmith/meteorite_stats"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
)
def stats(output, meteorite_landings):
    df = (
        meteorite_landings.polars()
        .groupby("class")
        .agg(pl.col("mass").mean().alias("avg_mass_per_class"))
    )
    output.write_table(df)
```

```python tab="Pandas"
from transforms.api import transform, Input, Output


@transform.using(
    # Output dataset name must be unique
    output=Output("/Users/jsmith/meteorite_stats"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
)
def stats(output, meteorite_landings):
    df = (
        meteorite_landings.pandas()
            .groupby("class", as_index=False)["mass"]
            .mean()
            .rename(columns={"mass": "avg_mass_per_class"})
    )
    output.write_table(df)
```

```python tab="PySpark"
from transforms.api import transform, Input, Output


@transform.spark.using(
    # Output dataset name must be unique
    output=Output("/Users/jsmith/meteorite_stats"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
)
def stats(output, meteorite_landings):
    df = (
        meteorite_landings.dataframe().groupBy("class").agg(
            F.mean("mass").alias("avg_mass_per_class")
        )
    )
    output.write_dataframe(df)
```

Next, create a data transformation that compares each meteor’s mass to the average mass for its meteor type. The information needed for this transformation is spread across the `meteorite_landings` and `meteorite_stats` tables that you created in this tutorial. You must join the two datasets and filter the resulting dataset to find meteorites that have a greater-than-average mass, as shown below:

```python tab="Polars"
import polars as pl
from transforms.api import transform, Input, Output


@transform.using(
    output=Output("/Users/jsmith/meteorite_enriched"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
    meteorite_stats=Input("/Users/jsmith/meteorite_stats"),
)
def enriched(output, meteorite_landings, meteorite_stats):
    df_landings = meteorite_landings.polars()
    df_stats = meteorite_stats.polars()

    enriched = df_landings.join(df_stats, on="class", how="inner")
    enriched = enriched.with_columns(
        (pl.col("mass") > pl.col("avg_mass_per_class")).alias("greater_mass")
    )
    result = enriched.filter(pl.col("greater_mass"))
    output.write_table(result)
```

```python tab="Pandas"
from transforms.api import transform, Input, Output


@transform.spark.using(
    output=Output("/Users/jsmith/meteorite_enriched"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
    meteorite_stats=Input("/Users/jsmith/meteorite_stats"),
)
def enriched(output, meteorite_landings, meteorite_stats):
    df_landings = meteorite_landings.pandas()
    df_stats = meteorite_stats.pandas()

    enriched = df_landings.merge(df_stats, on="class", how="inner")
    enriched["greater_mass"] = enriched["mass"] > enriched["avg_mass_per_class"]
    result = enriched[enriched["greater_mass"]]
    output.write_table(result)
```

```python tab="PySpark"
from transforms.api import transform, Input, Output


@transform.spark.using(
    output=Output("/Users/jsmith/meteorite_enriched"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
    meteorite_stats=Input("/Users/jsmith/meteorite_stats"),
)
def enriched(output, meteorite_landings, meteorite_stats):
    df_landings = meteorite_landings.dataframe()
    df_stats = meteorite_stats.dataframe()

    enriched_together = df_landings.join(df_stats, "class")
    greater_mass=enriched_together.withColumn(
        'greater_mass', (enriched_together.mass > enriched_together.avg_mass_per_class)
    )
    result = greater_mass.filter("greater_mass")
    output.write_dataframe(result)
```

Now, you can further analyze the resulting `meteorite_enriched` dataset by exploring it in Contour.

## Apply your data transformation to multiple inputs

So far, you created a dataset that contains meteorites of all types with a greater-than-average mass. The next step is to create separate datasets for each meteorite type. With Python transforms, you can use a for-loop to apply the same data transformation to each type of meteorite. For more information on applying the same data transformation to different inputs, refer to the section on [transform generation](/docs/foundry/transforms-python/pipelines/#transform-generation).

Create a new file in `src/myproject/datasets` and name it `meteor_class.py`. Note that you can continue writing your data transformation code in the `meteor_analysis.py` file, but this tutorial uses a new file to separate the data transformation logic.

To create separate datasets for each meteorite type, filter the `meteorite_enriched` dataset by class. Then, define a `transform_generator` function that applies the same data transformation logic to each of the meteorite types you want to analyze:

```python tab="Polars"
import polars as pl
from transforms.api import transform, Input, Output


def transform_generator(sources):
    transforms = []
    for source in sources:
        @transform.using(
            output=Output(f'/Users/jsmith/meteorite_{source}'),
            my_input=Input('/Users/jsmith/meteorite_enriched')
        )
        def filter_by_source(output, my_input, source=source):
            df = my_input.polars()
            result = df.filter(pl.col("class") == source)
            output.write_table(result)
        transforms.append(filter_by_source)
    return transforms

TRANSFORMS = transform_generator(["L6", "H5", "H4"])
```

```python tab="Pandas"
from transforms.api import transform, Input, Output


def transform_generator(sources):
    transforms = []
    for source in sources:
        @transform.using(
            output=Output(f'/Users/jsmith/meteorite_{source}'),
            my_input=Input('/Users/jsmith/meteorite_enriched')
        )
        def filter_by_source(output, my_input, source=source):
            df = my_input.pandas()
            result = df[df["class"] == source]
            output.write_table(result)
        transforms.append(filter_by_source)
    return transforms

TRANSFORMS = transform_generator(["L6", "H5", "H4"])
```

```python tab="PySpark"
from transforms.api import transform, Input, Output


def transform_generator(sources):
    transforms = []
    for source in sources:
        @transform.spark.using(
            output=Output(f'/Users/jsmith/meteorite_{source}'),
            my_input=Input('/Users/jsmith/meteorite_enriched')
        )
        def filter_by_source(output, my_input, source=source):
            result = my_input.dataframe().filter(my_input["class"] == source)
            output.write_table(result)
        transforms.append(filter_by_source)
    return transforms

TRANSFORMS = transform_generator(["L6", "H5", "H4"])
```

This will create a transformation that filters our meteorite dataset by class. Note that we must pass `source=source` into the `filter_by_source` function in order to capture the `source` parameter in the function’s scope.

:::callout{theme="success" title="Tip"}
For the initial data transformation created in the `meteor_analysis.py` file, you did not have to do any additional configuration to add Transforms to your project’s pipeline. This is because the default Python project structure uses automatic registration to discover all transform objects within your `datasets` folder.

To add this final transformation to your project’s pipeline using automatic registration, you must add the generated transforms to a variable as a list. In the example above, we used the variable `TRANSFORMS`. For more information about automatic registration and transforms generators, refer to the section on [transforms generation](/docs/foundry/transforms-python/pipelines/#transform-generation) in the Python transforms documentation.
:::
