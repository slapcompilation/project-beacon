<!-- source: https://palantir.com/docs/foundry/transforms-python/incremental-reference/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Incremental usage guide

## Incremental decorator

:::callout{theme="success"}
This guide refers to incremental vs non-incremental builds. It is assumed that in all cases, the `incremental()` decorator is being used. Thus, this terminology just refers to whether the transform is actually run incrementally.
:::

The `incremental()`decorator can be used to wrap a transform's compute function with logic for enabling incremental computation:

```python tab="Polars"
import polars as pl
from transforms.api import transform, incremental, Input, Output

@incremental()
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.polars(mode='added')  # Or just students.polars() since 'added' is default
    processed.write_table(students_df.filter(pl.col("hair") == 'Brown'))
```

```python tab="DuckDB"
from transforms.api import transform, incremental, Input, Output

@incremental()
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(ctx, students, processed):
    conn = ctx.duckdb().conn
    # DuckDB automatically supports incremental read modes
    filtered_query = conn.sql("SELECT * FROM students WHERE hair = 'Brown'")
    processed.write_table(filtered_query)
```

```python tab="Pandas"
@incremental()
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.pandas(mode='added')  # Or just students.pandas() since 'added' is default
    processed.write_table(students_df[students_df.hair == 'Brown'])
```

```python tab="PySpark"
from transforms.api import transform, incremental, Input, Output

@incremental()
@transform.spark.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.dataframe('added')
    processed.write_dataframe(students_df.filter(students_df.hair == 'Brown'))
```

The `incremental()` decorator can be used to wrap any existing transform that uses the `transform()`, `transform.using()`, `transform_df()`, or `transform_pandas()` decorator. Note that the compute function for your transform *must* support being run both incrementally and non-incrementally. The `incremental()` decorator does two key things:

* It allows the transform to look up information about its previous build. Using this information, the `incremental()`decorator then decides whether or not the transform can be run incrementally according to the [requirements described below](#requirements-for-incremental-computation).
* It converts the input, output, and context objects into the incremental subclasses that provide additional functionality. Specifically, `TransformInput` becomes `IncrementalTransformInput`, `TransformOutput` becomes `IncrementalTransformOutput`, and `TransformContext` becomes `IncrementalTransformContext`. These incremental objects are then passed into the transform wrapped by the decorator.

The incremental decorator takes six arguments:

```python
transforms.api.incremental(
    require_incremental=False,
    semantic_version=1,
    snapshot_inputs=None,
    allow_retention=False,
    strict_append=False,
    v2_semantics=False
)
```

Setting the `require_incremental` argument to `True` makes the transform fail if it cannot run incrementally. There are two cases where the transform is allowed to run as a snapshot, even if `require_incremental=True`:

1. One of the outputs has never been built before.
2. The semantic version has changed, meaning a snapshot was explicitly requested.

To debug the cause of a transform failing to run incrementally, look in the driver logs for warning `transforms.api._incremental: Not running incrementally`.

The `semantic_version` argument on the \:func:`~transforms.api.incremental` decorator allows you to force the next run of the transform to be non-incremental.

* If the semantic version of the current run is different than the semantic version of the previous run, the transform will run non-incrementally.
* If not specified, the semantic version is set to `1`.
* If the semantic version of the previous run does not exist (for example, when converting an existing transform to incremental transform), value `1` is assumed. This allows the transform to start running incrementally without requiring a new snapshot.
* To force a subsequent run of the transform to be non-incremental, you can bump the `semantic_version` argument on the `@incremental()` decorator.

The `snapshot_inputs` argument allows you to define some inputs as snapshot inputs which, unlike non-snapshot inputs, support update and delete modifications. See [snapshot inputs](#snapshot-inputs) for more information.

Setting the `allow_retention` argument to `True` allows deletion of files in input and output datasets by retention policies while maintaining incrementality of your transform.

If the `strict_append` parameter is set to `True` and the input datasets are incremental, then the underlying Foundry [transaction](/docs/foundry/data-integration/datasets/#transactions) type is set to be an `APPEND`, and an `APPEND` transaction will be used for incremental writes. Trying to overwrite an existing file will lead to an exception.
If the input datasets are not incremental, `strict_append` will run as `SNAPSHOT`. You should use `require_incremental=True` to ensure the code runs incrementally as `APPEND`. Trying to overwrite an existing file will succeed.
Note that the write operation may not overwrite any files, even auxiliary ones such as Parquet summary metadata or Hadoop `SUCCESS` files. Incremental writes for all Foundry formats should support `strict_append` mode.

If the `v2_semantics` parameter is set to `True`, v2 incremental semantics will be used. There should be no difference in behavior between v2 and v1 incremental semantics, and we recommend all users set this to `True`. Non-Catalog input and output resources may only be read from/written to incrementally if using v2 semantics.

### Important information

As mentioned above, the compute function for your transform wrapped with the `incremental()` decorator *must* support being run both incrementally and non-incrementally. Default read and write modes (explained in more detail throughout the rest of this guide) can assist with this dual-logic requirement, but it may still be necessary to branch based on the `is_incremental` property of the [compute context](#incrementaltransformcontext).

Another key point is that using the `incremental()` decorator with `transform_df()` or `transform_pandas()` only gives you access to the default read and write modes. This is sufficient if you have a transform where the added output rows are a function only of the added input rows (refer to the [append example](#append-only-input-changes)). If, however, your transform performs more complex logic (such as joins, aggregations, or distinct) that requires you to set the input read mode or the output write mode, then you should use the `incremental()` decorator with `transform()`. Using the incremental decorator with `transform()` allows you to set the read and write modes.

:::callout{theme="warning" title="Warning"}
Note that the Code Repositories preview feature will always run transforms in non-incremental mode. This is true even when `require_incremental=True` is passed into the `incremental()` decorator. This is unlike the VS Code preview feature which respects incrementality.
:::

## Incremental modes of inputs and outputs

Incremental transforms are a powerful feature. However, the API can be unintuitive when using for the first time. Incremental transforms behave the same way in [VS Code preview](/docs/foundry/palantir-extension-for-visual-studio-code/transforms-preview/#understanding-incremental-preview-results) as they would during a build. We recommend using [VS Code preview](/docs/foundry/palantir-extension-for-visual-studio-code/transforms-preview/#understanding-incremental-preview-results) when experimenting with the API and understanding it in practice.

### IncrementalTransformInput

The `transforms.api.IncrementalTransformInput` object extends the data reading methods to take an optional read mode parameter.

If you define a transform using the incremental decorator, the read modes behave differently depending on whether your transform is run incrementally or non-incrementally:

| Read mode    | Incremental behavior                                                                                                                                                                                               | Non-incremental behavior                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `added` \*  | Returns a [`DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) containing any new rows appended to the input since the last time the transform ran. | Returns a [`DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) containing the entire dataset since all rows are considered *unseen*.                        |
| `previous` | Returns a [`DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) containing the entire input given to the transform the last time it ran.         | Returns an empty [`DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html).                                                                                      |
| `current`  | Returns a [`DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) containing the entire input dataset for the current run.                         | Returns a [`DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) containing the entire input dataset for the current run. This will be the same as `added`. |

The default read mode is `added`.

There are instances where it is undesirable for an input to be treated in an incremental fashion despite the transform being marked as `incremental()`. See the [snapshot inputs](#snapshot-inputs) section for more information and how the read mode behavior differs for these types of inputs.

Note that the default output read mode is `current`, and the available output read modes are `added`, `current`, and `previous`. For more information about output read modes, refer to the section below.

The nature of incremental transforms means that we load all of the past transactions on the input datasets from the last `SNAPSHOT` transaction to build the input view. If you begin to see progressive slowness in your incremental transform, we recommend running a SNAPSHOT build on your incremental input datasets.

### IncrementalTransformOutput

The `transforms.api.IncrementalTransformOutput` object provides access to read and write modes for the output dataset. The key to writing logic compatible with both incremental and non-incremental builds is the default write mode of `modify`. There are two write modes:

* `modify`: This mode modifies the existing output with data written during the build. For example, calling `write_dataframe()` or `write_table()` when the output is in `modify` mode will append the written DataFrame to the existing output.
* `replace`: This mode fully replaces the output with data written during the build.

When a transform is run incrementally, the default write mode for the output is set to `modify`. When a transform is run non-incrementally, the default write mode for the output is set to `replace`.

Recall that the default read mode for input DataFrames is `added`. Because of the default input read mode of `added` and the default output write mode of `modify`, writing logic compatible with incremental and non-incremental builds becomes much easier:

```python tab="Polars"
import polars as pl

@incremental()
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def incremental_filter(students, processed):
    # Read only the rows we haven't seen before.
    new_students_df = students.polars()  # this is equivalent to students.polars('added')

    # When non-incremental, we read all rows and replace the output.
    # When incremental, we read only new rows, and append them to the output.
    processed.write_table(
        new_students_df.filter(pl.col("hair") == 'Brown')
    )
```

```python tab="DuckDB"
@incremental()
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def incremental_filter(ctx, students, processed):
    # Read only the rows we haven't seen before.
    conn = ctx.duckdb().conn
    new_students_df_filtered = conn.sql("SELECT * FROM students WHERE hair = 'Brown'")

    # When non-incremental, we read all rows and replace the output.
    # When incremental, we read only new rows, and append them to the output.
    processed.write_table(
        new_students_df_filtered
    )
```

```python tab="Pandas"
@incremental()
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def incremental_filter(students, processed):
    # Read only the rows we haven't seen before.
    new_students_df = students.pandas()  # this is equivalent to students.pandas('added')

    # When non-incremental, we read all rows and replace the output.
    # When incremental, we read only new rows, and append them to the output.
    processed.write_table(
        new_students_df[new_students_df.hair == 'Brown']
    )
```

```python tab="PySpark"
@incremental()
@transform.spark.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def incremental_filter(students, processed):
    # Read only the rows we haven't seen before.
    new_students_df = students.dataframe()  # this is equivalent to students.dataframe('added')

    # When non-incremental, we read all rows and replace the output.
    # When incremental, we read only new rows, and append them to the output.
    processed.write_dataframe(
        new_students_df.filter(new_students_df.hair == 'Brown')
    )
```

There are more complex use cases for incremental computation when it might be required to compute the correct write mode and set it manually. This can be done using the `set_mode()` method on the incremental output.

:::callout{theme="neutral"}
The output write mode can be set manually when using the `transform()` or `transform.using()` decorators. With these decorators, you can use `set_mode()` before you explicitly call the write method to save the output. The `transform_df()` and `transform_pandas()` decorators, however, call `write_dataframe()` and `write_pandas()` to save the DataFrame output. This means the write mode used will be determined by the `incremental()` decorator.
:::

:::callout{theme="warning" title="Warning"}
When using `set_mode()`, ensure that this is valid behavior both when the transform is run incrementally or non-incrementally. If this is not the case, you should use the `is_incremental` property.
:::

In addition to the write mode, the `transforms.api.IncrementalTransformOutput` makes it possible to read DataFrames from the output dataset. This can be done using the data reading methods such as `pandas()`, `polars()`, or `dataframe()`, which take an optional read mode parameter. When using `transform.using()`, specify the mode as a keyword argument: `output.pandas(mode='previous')`. Default read mode is set to `current` and other available output read modes are `added` and `previous`. Read mode behaves differently depending on what the dataset's write mode is set to.

:::callout{theme="success"}
Although default read mode is `current`, in most cases you should use `previous`. Other read modes should be used to read dataset after writing to it.
:::

#### Valid combination for reading data from the previous run

The transform must be running incrementally (`ctx.is_incremental is True`) to access the previous output of the transform. If the transform is running non-incrementally, read modes that would ordinarily allow access to the previous output will return no rows for the previous output data. The behavior described in the table below is motivated by the semantics of incrementality and the fact that the transactions of the `current` and `previous` read modes are resolved at the beginning of the transform run.

| Output read mode | Output write mode      | Was new data written? | Behavior                                                                                                                                                                                                              |
| ---------------- | ---------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `current`      | `modify`             | No                             | There is no use case for these settings. Use `previous` mode instead.                                                                                                                                               |
| `current`      | `modify`             | Yes                            | `dataframe()` returns the full content of the output of the transform (as it was at the beginning of the build), plus data written to output in the currently running build.                                         |
| `current`      | `replace`            | No                             | There is no use case for these settings. Use `previous` mode instead.                                                                                                                                               |
| `current`      | `replace`            | Yes                            | `dataframe()` returns data written to output in the currently running build.                                                                                                                                        |
| `added`        | `modify`/`replace` | No                             | There is no use case for these settings. Use `previous` mode instead.                                                                                                                                               |
| `added`        | `modify`/`replace` | Yes                            | `dataframe()` returns data written to output in the currently running build.                                                                                                                                        |
| `previous`     | `modify`             | Yes/No                         | `dataframe()` returns the full content of the output  of the transform (as it was at the beginning of the build). Schema is a required field when reading with `previous` if the transform is running non-incrementally. |
| `previous`     | `replace`            | Yes/No                         | `dataframe()` returns the full content of the output of the transform (as it was at the beginning of the build). Schema is a required field when reading with `previous` if the transform is running non-incrementally. |

The [schema ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.types.StructType.html) you provide when reading the previous Dataframe is used to generate an empty Dataframe in the case where the transform is running non-incrementally. If the transform is running incrementally, this schema will be compared against the actual schema of the last output. An exception will be raised if the column types, column nullability, or order of the columns do not match. To make sure the order of the columns stays the same, you can use the following construct:

```python
previous = out.dataframe('previous', schema)  # schema is a pyspark.sql.types.StructType

out.write_dataframe(df.select(schema.fieldNames()))
```

:::callout{theme="neutral"}
Foundry saves all columns as nullable, regardless of the schema used in your transform. As a result, your build will fail with a `SchemaMismatchError` when reading from the output in `previous` mode if you supply a schema with some fields set to non-nullable.
:::

Review the [merge and replace](/docs/foundry/transforms-python-spark/incremental-examples/#merge-and-replace) example for more information.

:::callout{theme="neutral"}
The same read modes are used for both the `dataframe()` and `filesystem()` methods to allow working with both structured and unstructured datasets.
:::

Note that there is no built-in way for accessing the data written by the previous invocation of a transform. If that data is needed, you can add an auxiliary output dataset to where each transform run can write a copy (or related metadata) of the written outputs, but in `replace` write mode. This will allow you to only reference the written outputs of the previous transform in the future.

#### Valid combinations for reading data written in the current run

| Output read mode         | Output write mode        | Was new data written? |
| ------------------------ | ------------------------ | ------------------------------ |
| `current` or `added` | `modify` / `replace` | Yes                            |

Prefer `added` as it makes your intentions clearer.
A scenario that would benefit from reading the data written by the current transformation is when validating the entire content of the dataset so that the build can be failed on validation failure. This way, recomputing or caching data in Spark to run the checks is not necessary.

### IncrementalTransformContext

Compared to the `TransformContext` object, the `IncrementalTransformContext` object provides an additional property: `is_incremental`. This property is set to `True` if the transform is run incrementally, this means:

* the default output write mode is set to `modify`, and
* the inputs default read mode is set to `added`.

### Summary of incremental modes

The incremental decorator lets you access the previous inputs and outputs of the transform by specifying read mode "previous". This way you can base the current build on historical context. If the transform is run in snapshot mode, the "previous" dataframes will be empty because this is the first run, or because the logic or data changed significantly necessitating a recompute.

However, the most common case is to use "added" mode for inputs and "modify" mode for outputs. These modes are used by default. They let you retrieve the newly added rows from an input dataset, process them, and append them to an output dataset.

Instead of appending rows to the output, you may want to modify some existing rows already present in an output dataset. For that, use the "replace" mode as demonstrated in the examples for common scenarios.

## Requirements for incremental computation

Below, we will analyze an incremental transform that filters students to only include those with brown hair:

```python tab="Polars"
import polars as pl

@incremental()
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.polars()
    processed.write_table(students_df.filter(pl.col("hair") == 'Brown'))
```

```python tab="DuckDB"
@incremental()
@transform.using(
students=Input('/examples/students_hair_eye_color'),
processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(ctx, students, processed):
    conn = ctx.duckdb().conn
    filtered_query = conn.sql("SELECT * FROM students WHERE hair = 'Brown'")
    processed.write_table(filtered_query)
```

```python tab="Pandas"
@incremental()
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.pandas()
    processed.write_table(students_df[students_df.hair == 'Brown'])
```

```python tab="PySpark"
@incremental()
@transform.spark.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.dataframe()
    processed.write_dataframe(students_df.filter(students_df.hair == 'Brown'))
```

Suppose the `/examples/students_hair_eye_color` input dataset is fully replaced with a new set of students. As we can see, appending the new set of students to the previous output results in an incorrect output dataset. This is an example of a situation where the `incremental()` decorator would decide to **not** run the transform incrementally.

For a transform to be run incrementally, the following requirements must be met:

All of the transform's non\_snapshot input datasets [had only files added to them since the last run](#append-only-input-changes) or [had deletions coming from retention](#inputs-with-deletions-coming-from-retention).

* If an input's last transaction was an `UPDATE` that modified existing files or a deletion that did not come from retention, this input will only run incrementally if it is marked as a [snapshot input](#snapshot-inputs).
* The list of the transform's [inputs may be modified](#changes-to-inputs) without compromising the incrementality of the build.
* For multi-output transforms, all [outputs were last built via the same transform](#outputs-last-built-by-same-transform).

If a transform has the `incremental()` decorator but any of the above requirements are not met, the transform will automatically be run non-incrementally. This means the default output write mode will be set to `replace` instead of `modify` and inputs will be presented non-incrementally. It also means that reading from output in the transform will return an empty dataframe, because the previous history is not accessible. Similarly, inputs will also be presented non-incrementally. If we set `require_incremental=True`, the transform will fail rather than running non-incrementally.

:::callout{theme="neutral"}
It is often desirable to allow certain inputs to be fully rewritten without affecting the ability to run the transform incrementally. See [Snapshot Inputs](#snapshot-inputs) for more information.
:::

:::callout{theme="success"}
It is possible to force a transform to only run incrementally (unless it has never been run before or the semantic version was bumped) with the `require_incremental=True` argument passed into the `incremental` decorator. If the transform cannot run incrementally it will deliberately fail rather than attempt to run non-incrementally.
:::

### Append-only input changes

A transform can be run incrementally if all its incremental inputs had only files added to them (with `APPEND` or `UPDATE` [transactions](/docs/foundry/data-integration/datasets/#transactions)) since the last run.

Conversely, a transform cannot be run incrementally if any of the following is true of its incremental inputs:

* The incremental inputs were fully rewritten (for example, had `SNAPSHOT` transactions).
* The incremental inputs had `UPDATE` transactions that modified or overwrote existing files (as opposed to only adding new files), or had `DELETE` transactions that removed files outside of [retention](#inputs-with-deletions-coming-from-retention).

For instance, if the list of students in `students_hair_eye_color` completely changes, the previous output of filtered students is invalid and must be replaced.

### Inputs with deletions coming from retention

If an upstream dataset grows indefinitely and you want to be able to delete old rows (using [retention in Foundry](/docs/foundry/retention/overview/)) without affecting incrementality of downstream computations, the incremental transform depending on that dataset must be explicitly set to allow retained input. This can be done by using the `allow_retention` argument of the `transforms.api.incremental` decorator.

* If this field is set to `True`, all deletions coming from retention policies will be ignored when evaluating if the inputs preserve incrementality. This means that `removed` inputs coming from Retention will not compromise incrementality, and that if the only non-`added` inputs are inputs with retained rows, the transform will still run incrementally.
* If the field is `False` (default), any `removed`-type changes in the input dataset will cause the transform to run a snapshot.

```python tab="Polars"
import polars as pl

@incremental(allow_retention=True)
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.polars()
    processed.write_table(students_df.filter(pl.col("hair") == 'Brown'))
```

```python tab="DuckDB"
@incremental(allow_retention=True)
@transform.using(
students=Input('/examples/students_hair_eye_color'),
processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(ctx, students, processed):
    conn = ctx.duckdb().conn
    filtered_query = conn.sql("SELECT * FROM students WHERE hair = 'Brown'")
    processed.write_table(filtered_query)
```

```python tab="Pandas"
@incremental(allow_retention=True)
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.pandas()
    processed.write_table(students_df[students_df.hair == 'Brown'])
```

```python tab="PySpark"
@incremental(allow_retention=True)
@transform.spark.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.dataframe()
    processed.write_dataframe(students_df.filter(students_df.hair == 'Brown'))
```

In the above example, if the transform is run after a set of changes in the dataset `/examples/students_hair_eye_color` that includes only `added` changes and `removed` changes made using retention policies, the transform will run incrementally. If any `removed` changes made in other ways or any `modified` changes are present, a snapshot will be triggered.

:::callout{theme="warning" title="Warning"}
Specifying `allow_retention=True` only prevents effects on incrementality from `removed` changes that come from retention policies. Any other delete in the input dataset would still cause the transform to run a snapshot instead of incremental computation.
:::

### Snapshot inputs

In some cases, inputs can be fully rewritten without invalidating the incrementality of the transform. For example, suppose you have a simple reference dataset that maps phone number country codes to countries and is periodically rewritten. Changes to this dataset do not necessarily invalidate the results of any previous computation and therefore should not prevent the transform being run incrementally.

By default, as described above, a transform cannot be run incrementally if any input has been fully rewritten since the transform was last run. Snapshot inputs are excluded from this check and their start transaction allowed to differ between runs.

Snapshot inputs can be configured by using the `snapshot_inputs` argument on the `incremental()` decorator.

If your incremental transform uses [Cipher resources](/docs/foundry/cipher/core-concepts/) and `bellaso_python_lib`, these encrypters, decrypters, and hashers need to be listed as snapshot inputs.

```python tab="Polars"
@incremental(snapshot_inputs=['country_codes'])
@transform.using(
    phone_numbers=Input('/examples/phone_numbers'),
    country_codes=Input('/examples/country_codes'),
    output=Output('/examples/phone_numbers_to_country')
)
def map_phone_number_to_country(phone_numbers, country_codes, output):
    # this will be all unseen phone numbers since the previous run
    phone_numbers_df = phone_numbers.polars()
    # this will be all country codes, regardless of what has been seen previously
    country_codes_df = country_codes.polars()

    output.write_table(
        phone_numbers_df.join(country_codes_df, left_on='country_code', right_on='code', how='left')
    )
```

```python tab="DuckDB"
@incremental(snapshot_inputs=['country_codes'])
@transform.using(
    phone_numbers=Input('/examples/phone_numbers'),
    country_codes=Input('/examples/country_codes'),
    output=Output('/examples/phone_numbers_to_country')
)
def map_phone_number_to_country(ctx, phone_numbers, country_codes, output):
    conn = ctx.duckdb().conn
    joined_query = conn.sql("""
        SELECT *
        FROM phone_numbers
        LEFT JOIN country_codes
        ON phone_numbers.country_code = country_codes.code
    """)
    output.write_table(joined_query)
```

```python tab="Pandas"
@incremental(snapshot_inputs=['country_codes'])
@transform.using(
    phone_numbers=Input('/examples/phone_numbers'),
    country_codes=Input('/examples/country_codes'),
    output=Output('/examples/phone_numbers_to_country')
)
def map_phone_number_to_country(phone_numbers, country_codes, output):
    # this will be all unseen phone numbers since the previous run
    phone_numbers_df = phone_numbers.pandas()
    # this will be all country codes, regardless of what has been seen previously
    country_codes_df = country_codes.pandas()

    output.write_table(
        phone_numbers_df.merge(country_codes_df, left_on='country_code', right_on='code', how='left')
    )
```

```python tab="PySpark"
@incremental(snapshot_inputs=['country_codes'])
@transform.spark.using(
    phone_numbers=Input('/examples/phone_numbers'),
    country_codes=Input('/examples/country_codes'),
    output=Output('/examples/phone_numbers_to_country')
)
def map_phone_number_to_country(phone_numbers, country_codes, output):
    # this will be all unseen phone numbers since the previous run
    phone_numbers = phone_numbers.dataframe()
    # this will be all country codes, regardless of what has been seen previously
    country_codes = country_codes.dataframe()

    cond = [phone_numbers.country_code == country_codes.code]
    output.write_dataframe(phone_numbers.join(country_codes, on=cond, how='left_outer'))
```

The behavior of snapshot inputs are identical when a transform runs incrementally or non-incrementally. As such, `added` and `current` read modes will always return the entire dataset. All other read modes will return the empty dataset.

:::callout{theme="neutral"}
Given that there are no constraints around previously seen versions of snapshot inputs, it is possible to add or remove snapshot inputs while retaining the ability to run the transform incrementally. Remember that if the modification of the inputs fundamentally changes the semantics of the transform, it is worth reviewing whether the `semantic_version` argument on the `incremental()` decorator should be updated.
:::

### Changes to inputs

The list of existing inputs can be modified. Incrementality will be preserved in the case where either of the following is true:

* New inputs or new snapshot inputs are added.
* Existing inputs or existing snapshot inputs are removed.

Note that an incremental transform must have at least one input.

The start transactions for each of the non-snapshot input datasets must be consistent with those used for the previous run.

### Outputs last built by same transform

For [multiple-output incremental transforms](/docs/foundry/transforms-common/optimize-multi-output-transforms/#multi-output-transforms), the last committed transaction of every previously built output must be generated by the same transform.

Outputs with no prior build history will be exempt from the above condition and will not prevent the build from running incrementally.

### Input and output datasets for transforms must be different

Data transformations take an input dataset, perform operations, and generate an output dataset. The input dataset and output dataset for a transform must be different. Having the same dataset as both input and output will result in a cyclic (circular) dependency, making the transform impossible to execute.

### Summary of requirements for incremental computation

A transform can be run incrementally if and only if all its incremental inputs only had files appended to them; where files were deleted, those files were only deleted using retention with `allow_retention=True`. Snapshot inputs are excluded from this check.
