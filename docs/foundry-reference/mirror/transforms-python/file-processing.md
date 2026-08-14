<!-- source: https://palantir.com/docs/foundry/transforms-python/file-processing/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# File processing workflows

Lightweight transforms can process dataset files without schemas. To process dataset files without a schema, list the files with `my_input.filesystem().ls()`.

The statement `.filesystem().ls()` is available for datasets without schemas, but the `.path()`, `.pandas()`, `.polars()`, `.arrow()`, and `.filesystem().files()` statements are only available on datasets with schemas.

## Code example: File processing

The following code shows an example lightweight transform that processes files of a dataset without a schema.

```python
from transforms.api import incremental, Input, Output, transform
import polars as pl
from concurrent.futures import ThreadPoolExecutor

@incremental()
@transform.using(my_input=Input("my-input"), my_output=Output('my-output'))
def my_incremental_transform(my_input, my_output):
    fs = my_input.filesystem()
    files = list(fs.ls(glob="*.csv"))

    def process_file(dataset_file):
        file_path = dataset_file.path
        # Access the file
        with fs.open(file_path, "rb") as f:
            # <do something with the file>
            # return some data as a dataframe

    with ThreadPoolExecutor() as executor:
        polars_dataframes = list(executor.map(process_file, files))

    # Union all the DFs into one
    combined_df = pl.concat(polars_dataframes)
    out.write_table(combined_df)
```

The following example demonstrates how to parse Excel files:

```python
from transforms.api import transform, Input, Output
import tempfile
import shutil
import polars as pl
import pandas as pd
from concurrent.futures import ThreadPoolExecutor


@transform.spark.using(
    my_output=Output("/path/tabular_output_dataset"),
    my_input=Input("/path/input_dataset_without_schema"),
)
def compute(my_input, my_output):
    # Parse each file
    # Open the Excel file at the provided path, using the provided filesystem
    def read_excel_to_polars(fs, file_path):
        with fs.open(file_path, "rb") as f:
            with tempfile.TemporaryFile() as tmp:
                # Copy paste the file from the source dataset to the local filesystem
                shutil.copyfileobj(f, tmp)
                tmp.flush()  # shutil.copyfileobj does not flush

                # read the excel file (the file is now seekable)
                pandas_df = pd.read_excel(tmp)
                # Convert eventual integer columns to string columns
                pandas_df = pandas_df.astype(str)
                # Convert the pandas dataframe to a polars dataframe
                return pl.from_pandas(pandas_df)

    fs = my_input.filesystem()
    # List all files in the input dataset
    files = [f.path for f in fs.ls()]

    def process_file(curr_file_as_row):
        # print(curr_file_as_row)
        return read_excel_to_polars(fs, curr_file_as_row)

    def union_polars_dataframes(dfs):
        return pl.concat(dfs)

    # Union all the DFs into one
    with ThreadPoolExecutor() as executor:
        polars_dataframes = list(executor.map(process_file, files))
    combined_df = union_polars_dataframes(polars_dataframes)

    my_output.write_table(combined_df)
```
