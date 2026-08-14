<!-- source: https://palantir.com/docs/foundry/transforms-python/lightweight-api-evolution/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Lightweight transforms API evolution

The transforms API for [lightweight compute](/docs/foundry/transforms-python/compute-engines/) has evolved over time to support more streamlined syntax options.

Reference this page for details on the evolution of the lightweight API.

To get started writing lightweight transforms, visit the [Getting started](/docs/foundry/transforms-python/getting-started/) page or any of the Polars or pandas examples in the [Python transforms](/docs/foundry/transforms-python/overview/) documentation; these pages provide guidance on using lightweight transforms as the default compute option.

## Legacy syntax: @lightweight decorator

The original syntax for lightweight compute is the `@lightweight` decorator. This syntax option remains fully supported.

```python
from transforms.api import transform, lightweight, Input, Output


@lightweight
@transform(
    output=Output("/path/data/output"),
    input=Input("/path/data/input"),
)
def clean(output, input):
    df = input.pandas()
    output.write_table(df)
```

## Updated syntax for Lightweight

The new recommended syntax for accessing lightweight transforms is `@transform.using`. This API removes the need for additional lightweight imports and streamlines the creation of lightweight transforms as the default.

The new API is available from transforms version 3.68.0 and higher. To make this available in Code Repositories, upgrade your repository with the [repository upgrade guide](/docs/foundry/code-repositories/repository-upgrades/). Ensure that the `transformsLangPythonPluginVersion` is equal to 1.978.0 or higher.

To learn more about transforms versions, see the [transforms versions overview](/docs/foundry/transforms-common/transforms-versions/).

```python
from transforms.api import transform, Input, Output


@transform.using(
    output=Output("/path/data/output"),
    input=Input("/path/data/input"),
)
def clean(output, input):
    df = input.pandas()
    output.write_table(df)
```

:::callout{theme="neutral"}
To summarize, you can create a Lightweight transform using any of the below syntax options:

* Updated API:<br>`@transform.using(...)`
* Updated API explicitly referencing Lightweight:<br>`@transform.lightweight(...)`
* Legacy API with @lightweight decorator:<br>`@lightweight` <br>`@transform(...)`
:::

## Updated syntax for Spark

Alongside the new, default lightweight API, there is a new transforms API for Spark. The recommended syntax is `@transform.spark.using`.

The new API is available from transforms version 3.95.0 and higher. To make this available in Code Repositories, upgrade your repository with the [repository upgrade guide](/docs/foundry/code-repositories/repository-upgrades/). Ensure that the `transformsLangPythonPluginVersion` is equal to 1.1003.0 or higher.

```python
from transforms.api import transform, Input, Output


@transform.spark.using(
    output=Output("/path/data/output"),
    input=Input("/path/data/input"),
)
def clean(output, input):
    df = input.dataframe()
    output.write_dataframe(df)
```

## Troubleshoot version errors with @transform.using

If you receive an error message similar to the following, you may be on an older version of the transforms library that does not support the updated syntax.

* `Usage of transform.using() on outdated repository`
* `A function object does not have an attribute using`

To resolve this issue, try the following options:

* Upgrade your repository to the latest version of the `transforms` library and repository template following [the repository upgrade guide](/docs/foundry/code-repositories/repository-upgrades/).
* Switch to [legacy syntax](#legacy-syntax-lightweight-decorator).
