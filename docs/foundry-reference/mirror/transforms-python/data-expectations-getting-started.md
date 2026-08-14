<!-- source: https://palantir.com/docs/foundry/transforms-python/data-expectations-getting-started/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Getting started

This guide will show you how to set up data expectations in a Python transforms repository. For a high-level overview of data expectations, refer to the [documentation](/docs/foundry/maintaining-pipelines/define-data-expectations/).

### Repository setup: transforms-expectations library

Open the library search panel on the left side of your Code Repository. The `transforms-expectations` library should already be installed. Validate this by checking the list of installed libraries. If `transforms-expectations` is not already installed, search for and install it now.

### Transform setup

Import the `expectations` and `Check` into your transforms file:

```python
from transforms.api import transform_df, Input, Output, Check
from transforms import expectations as E
```

For some common schema and column expectations you may want to import `types` as well:

```python
from pyspark.sql import types as T
```

### Create checks

The basic structure of a single check:

```python
Check(expectation, 'Check unique name', on_error='WARN/FAIL')
```

* **expectation** - a single [expectation](/docs/foundry/transforms-python/data-expectations-reference/), which can be a composite expectation (e.g. using an any/all operator) of multiple sub-expectations
* **Check unique name** - This must be unique in the transform (the same name cannot be shared among outputs and inputs) and will identify the check across apps (e.g. Data Health, Builds application)
* **on\_error** - Defines the behavior of the job when expectations are not met:
  * `FAIL` (default) - Job will be aborted if check fails
  * `WARN` - Job will continue and a warning will be generated and handled by Data Health

:::callout{theme="warning" title="Warning"}
Setting `on_error='FAIL'` is not supported for [virtual table](/docs/foundry/data-integration/virtual-tables/) outputs in single-node transforms.
:::

**Assign checks to dataset**

Each check should be passed to a single input or output. Pass a single check as `checks=check1` or multiple checks in an array:  `checks=[check1, check2, ...]`

:::callout{title="Multiple checks"}
Use multiple checks to create more legible Expectations structure and control the behavior of each meaningful check separately.
:::

An example for a simple primary key check on the output:

```python tab="Polars"
from transforms.api import transform, Input, Output, Check
from transforms import expectations as E
import polars as pl


@transform.using(
    output=Output(
        "/path/dataset",
        checks=Check(E.primary_key('id'), 'Primary Key', on_error='FAIL')
    ),
    input=Input("/path/input"),
)
def compute(output, input):
    input_df = input.polars()
    return output.write_table(input_df)
```

```python tab="DuckDB"
from transforms.api import transform, Input, Output, Check
from transforms import expectations as E


@transform.using(
    output=Output(
        "/path/dataset",
        checks=Check(E.primary_key('id'), 'Primary Key', on_error='FAIL')
    ),
    input=Input("/path/input"),
)
def compute(ctx, output, input):
    query = ctx.duckdb().conn.sql("SELECT * FROM input")
    return output.write_table(query)
```

```python tab="Pandas"
from transforms.api import transform, Input, Output, Check
from transforms import expectations as E
import pandas as pd


@transform.using(
    output=Output(
        "/path/dataset",
        checks=Check(E.primary_key('id'), 'Primary Key', on_error='FAIL')
    ),
    input=Input("/path/input"),
)
def compute(output, input):
    input_df = input.pandas()
    return output.write_table(input_df)
```

```python tab="PySpark"
from transforms.api import transform_df, Input, Output, Check
from transforms import expectations as E


@transform_df(
    Output(
        "/path/dataset",
        checks=Check(E.primary_key('id'), 'Primary Key', on_error='FAIL')
    ),
    input=Input("/path/input")
)
def my_compute_function(input):
    return input
```

### Complex checks

You can also add more complex checks using composite expectations. For example, let us check that column `age` is not null in a given range. Notice that we can define the composite expectation and use it in multiple checks within the transform, applying different behavior on errors.

:::callout{theme="neutral"}
A check is monitored as a whole even when it consists of a composite expectation. If you want to monitor (that is, watch and get notifications) specific parts of the composite expectation, it is recommended that you split it to several different checks.
:::

```python tab="Polars"
from transforms.api import transform, Input, Output, Check
from transforms import expectations as E
import polars as pl


# We assume an age is valid if it is between 0 and 200.
expect_valid_age = E.all(
    E.col('age').non_null(),
    E.col('age').gte(0),
    E.col('age').lt(200)
)


@transform.using(
    output=Output(
        "/path/dataset",
        checks=[
            Check(E.primary_key('id'), 'Primary Key', on_error='FAIL'),
            Check(expect_valid_age, 'Valid age on output', on_error='FAIL')
        ]
    ),
    input=Input(
        "Users/data/input",
        checks=Check(expect_valid_age, 'Valid age on input', on_error='WARN')
    )
)
def compute(output, input):
    input_df = input.polars()
    return output.write_table(input_df)
```

```python tab="DuckDB"
from transforms.api import transform, Input, Output, Check
from transforms import expectations as E


# We assume an age is valid if it is between 0 and 200.
expect_valid_age = E.all(
    E.col('age').non_null(),
    E.col('age').gte(0),
    E.col('age').lt(200)
)


@transform.using(
    output=Output(
        "/path/dataset",
        checks=[
            Check(E.primary_key('id'), 'Primary Key', on_error='FAIL'),
            Check(expect_valid_age, 'Valid age on output', on_error='FAIL')
        ]
    ),
    input=Input(
        "Users/data/input",
        checks=Check(expect_valid_age, 'Valid age on input', on_error='WARN')
    )
)
def compute(ctx, output, input):
    conn = ctx.duckdb().conn
    query = conn.sql("SELECT * FROM input")
    return output.write_table(query)
```

```python tab="Pandas"
from transforms.api import transform, Input, Output, Check
from transforms import expectations as E
import pandas as pd


# We assume an age is valid if it is between 0 and 200.
expect_valid_age = E.all(
    E.col('age').non_null(),
    E.col('age').gte(0),
    E.col('age').lt(200)
)


@transform.using(
    output=Output(
        "/path/dataset",
        checks=[
            Check(E.primary_key('id'), 'Primary Key', on_error='FAIL'),
            Check(expect_valid_age, 'Valid age on output', on_error='FAIL')
        ]
    ),
    input=Input(
        "Users/data/input",
        checks=Check(expect_valid_age, 'Valid age on input', on_error='WARN')
    )
)
def compute(output, input):
    input_df = input.pandas()
    return output.write_table(input_df)
```

```python tab="PySpark"
from transforms.api import transform_df, Input, Output, Check
from transforms import expectations as E


# We assume an age is valid if it is between 0 and 200.
expect_valid_age = E.all(
    E.col('age').non_null(),
    E.col('age').gte(0),
    E.col('age').lt(200)
)


@transform_df(
    Output(
        "/Users/data/dataset",
        checks=[
            Check(E.primary_key('id'), 'Primary Key', on_error='FAIL'),
            Check(expect_valid_age, 'Valid age on output', on_error='FAIL')
        ]
    ),
    input=Input(
        "Users/data/input",
        checks=Check(expect_valid_age, 'Valid age on input', on_error='WARN')
    )
)
def my_compute_function(input):
    return input
```
