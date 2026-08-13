<!-- source: https://palantir.com/docs/foundry/transforms-python-spark/output-column-metadata/ · mirrored 2026-08-13 from Palantir Foundry docs -->

# Output column metadata

You can read and write the column descriptions and column typeclasses for your output datasets in Code Repository Transforms.

## Updating column descriptions in Code Repository Transforms

You can add output column descriptions to your output datasets by providing the optional `column_descriptions` argument to the `write_dataframe()` function of the [`TransformOutput`](/docs/foundry/api-reference/transforms-python-library/api-transformoutput/#transforms.api.TransformOutput).

* This argument should be a [dict ↗](https://docs.python.org/3/library/stdtypes.html#dict) with keys of column names and values of column descriptions. Column descriptions are limited up to 800 characters in length.
* The code will automatically compute the intersection of the column names available on your [DataFrame ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) and the keys in the [dict ↗](https://docs.python.org/3/library/stdtypes.html#dict) you provide, so it will not try to put descriptions on columns that don't exist.

### Example: Write column descriptions in Code Repository Transforms

```python
from transforms.api import transform, Input, Output


@transform(
    my_output=Output("/my/output"),
    my_input=Input("/my/input"),
)
def my_compute_function(my_input, my_output):
    my_output.write_dataframe(
        my_input.dataframe(),
        column_descriptions={
            "col_1": "col 1 description"
        }
    )
```

## Column typeclasses

The `column_typeclasses` property gives back a structured `Dict<str, List<Dict<str, str>>>`, which maps column names to their column typeclasses.

* Each typeclass in the `List` is a `Dict[str, str]` object.
  * This `Dict` object must only use the keys `"name"` and `"kind"`. Each of these keys maps to the corresponding string the user wants.

An example `column_typeclasses` value would be `{"my_column": [{"name": "my_typeclass_name", "kind": "my_typeclass_kind"}]}`.

### Example: Read and write column descriptions and typeclasses in Code Repository Transforms

```python
from transforms.api import transform, Input, Output


@transform(
    my_output=Output("ri.foundry.main.dataset.my-output-dataset"),
    my_input=Input("ri.foundry.main.dataset.my-input-dataset"),
)
def my_compute_function(my_input, my_output):
    recent = my_input.dataframe().limit(10)

    existing_typeclasses = my_input.column_typeclasses
    existing_descriptions = my_input.column_descriptions

    my_output.write_dataframe(
        recent,
        column_descriptions=existing_descriptions,
        column_typeclasses=existing_typeclasses
    )
```
