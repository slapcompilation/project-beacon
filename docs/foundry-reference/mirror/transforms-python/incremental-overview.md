<!-- source: https://palantir.com/docs/foundry/transforms-python/incremental-overview/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Incremental transforms

Incremental computation is an efficient method of performing transforms on an input dataset to generate an output dataset. By leveraging the build history of a transform, incremental computation avoids the need to recompute the entire output dataset every time a transform is run. Note that the input dataset and output dataset cannot be the same; the input and output datasets must be different to avoid creating a cyclic (circular) dependency.

For end-to-end guidance on how to create and manage incremental pipelines, see the [building pipelines](/docs/foundry/building-pipelines/incremental-overview/) section.

## Example: Non-incremental and incremental transforms

In this section, we examine the benefits of incremental transforms by first considering a code example that does not use incremental transforms:

```python tab="Polars"
import polars as pl
from transforms.api import transform, Input, Output


@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.polars()

    # This is inefficient because the filter function is performed over the entire input rather than on new data only
    processed.write_table(students_df.filter(pl.col('hair') == 'Brown'))
```

```python tab="Pandas"
from transforms.api import transform, Input, Output


@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.polars()

    # This is inefficient because the filter function is performed over the entire input rather than on new data only
    processed.write_table(students_df[students_df['hair'] == 'Brown'])
```

```python tab="DuckDB"
from transforms.api import transform, Input, Output

@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(ctx, students, processed):
    conn = ctx.duckdb().conn
    query = conn.sql("SELECT * FROM students WHERE hair = 'Brown'")
    processed.write_table(query)
```

```python tab="PySpark"
from transforms.api import transform, Input, Output


@transform.spark.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.dataframe()

    # This is inefficient because the filter function is performed over the entire input rather than on new data only
    processed.write_dataframe(students_df.filter(students_df.hair == 'Brown'))
```

If any new data is added to the `/examples/students_hair_eye_color` input dataset, the `filter()` is performed over the entire input, rather than just the new data added to the input. This is wasteful of both compute resources and time.

If a transform can become aware of its build history, it can be smarter about how to compute its output. More specifically, it can use the changes made to the inputs to modify the output dataset. This process of using already materialized data when re-materializing tables is called **incremental computation**. Without incremental computation, the output dataset is always replaced by the latest transform output.

Let’s go back to the example transform shown above. The transform performs a `filter()` over the `students` dataset to write out students with brown hair. With incremental computation, if data about two new students is appended to `students`, the transform can use information about its build history to append only the new brown-haired students to the output:

```
+---+-----+-----+------+                  +---+-----+-----+------+
| id| hair|  eye|   sex|                  | id| hair|  eye|   sex|
+---+-----+-----+------+     Build 1      +---+-----+-----+------+
| 17|Black|Green|Female|    --------->    | 18|Brown|Green|Female|
| 18|Brown|Green|Female|                  +---+-----+-----+------+
| 19|  Red|Black|Female|
+---+-----+-----+------+
        ...                                         ...
+---+-----+-----+------+     Build 2      +---+-----+-----+------+
| 20|Brown|Amber|Female|    --------->    | 20|Brown|Amber|Female|
| 21|Black|Blue |Male  |                  +---+-----+-----+------+
+---+-----+-----+------+
```

The example transform above can therefore be rewritten using incremental logic with the following syntax:

```python tab="Polars"
import polars as pl
from transforms.api import transform, incremental, Input, Output

@incremental()
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.polars('added')
    processed.write_table(students_df.filter(pl.col('hair') == 'Brown'))
```

```python tab="Pandas"
from transforms.api import transform, incremental, Input, Output

@incremental()
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(students, processed):
    students_df = students.pandas('added')
    processed.write_table(students_df[students_df['hair'] == 'Brown'])
```

```python tab="DuckDB"
from transforms.api import transform, incremental, Input, Output

@incremental()
@transform.using(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_hair_color(ctx, students, processed):
    conn = ctx.duckdb(read_modes={students: "added"}).conn
    query = conn.sql("SELECT * FROM students WHERE hair = 'Brown'")
    processed.write_table(query)
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

For more information on incremental transforms and the `@incremental` decorator, refer to the [incremental transforms reference](/docs/foundry/transforms-python/incremental-usage/).

:::callout{theme="warning" title="Empty inputs in incremental transforms for streaming datasets"}
When running an incremental lightweight transform on a streaming dataset, the incremental window may contain no new files to process. In this case, calling `.polars(lazy=True)` on the empty input can trigger a `BinderException` because the underlying integration expects a non-empty list of files.

To avoid this error, add a check for empty input before reading. You can use the `is_incremental` property on the context and check the input for data before calling `.polars(lazy=True)`:

```python
from transforms.api import transform, incremental, Input, Output


@incremental()
@transform.using(
    my_output=Output('/path/to/output'),
    my_input=Input('/path/to/input'),
)
def compute(ctx, my_output, my_input):
    if ctx.is_incremental and my_input.polars().is_empty():
        return
    df = my_input.polars(lazy=True)
    my_output.write_table(df)
```

Alternatively, you can ensure that the incremental window always contains at least one file before running the transform.
:::

:::callout{theme="neutral"}
It is safe to compute joins when one of the datasets is a reference table that gets [read fully](/docs/foundry/transforms-python/incremental-usage/#snapshot-inputs) and the other one is an incremental dataset that is read incrementally. However, reading both datasets that take part in a join incrementally requires special handling. Refer to the example [leveraging incremental transforms to join large datasets](/docs/foundry/transforms-python-spark/incremental-examples/#leverage-incremental-transforms-to-join-large-datasets) for more information.
:::

### Use with media sets

Incremental computation is now supported for [media sets](/docs/foundry/transforms-python/media-sets/). See the [incremental media set documentation](/docs/foundry/transforms-python-spark/incremental-media-sets/) for details.

### Limit the batch size of an incremental input

You can configure [transactional dataset](/docs/foundry/data-integration/datasets/#transactions) batching for incremental transforms. Review the documentation on [limiting batch sizes of incremental inputs](/docs/foundry/transforms-python-spark/incremental-transaction-limits/) for more details.
