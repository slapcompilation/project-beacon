<!-- source: https://palantir.com/docs/foundry/questions-answers/pipeline-builder/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Pipeline Builder

### How can I drop malformed CSV lines in a data pipeline build to avoid errors?

From the dataset preview section, use the **Parsing options -> Drop jagged rows** feature to drop malformed rows.

*Timestamp:* March 1, 2024

### How can I union multiple datasets in a single transform without unioning different pairs of datasets?

You can connect all the datasets into the union board which takes an unlimited number of inputs, or you can drag-select all of the inputs and then click the union transform option.

*Timestamp:* April 11, 2024

### Is there a batch operation for calling the LLM on the Use LLM board, or is it called per row?

The LLM is called per row, but the operations are parallelized across executors for speed.

*Timestamp:* March 28, 2024

### Is there a way to extract text from an image in a PDF using OCR in Pipeline Builder?

Yes, in Pipeline Builder, you can extract text from images in a PDF by using the OCR (Optical Character Recognition) extraction method in the **PDF text extraction** transform.

*Timestamp:* April 10, 2024

### What does the "Time bounded drop duplicates" function do when a row arrives later than the configured event time window?

The **Time bounded drop duplicates** function will drop any row that arrives later than the configured event time window, regardless of whether it is a duplicate or not.

*Timestamp:* March 20, 2024

### Can I replace the output for pipeline A with new datasets and then have the previous output datasets from pipeline A be the output for a different pipeline (pipeline B), ensuring all pipeline output schemas are the same?

Yes, you can overwrite a dataset with a new output in Pipeline Builder, which is a one-time action that changes the ownership of an existing dataset to a new output. You can configure the desired datasets as outputs for pipeline B, provided you have the necessary permissions and follow the required steps. It's crucial that all pipeline output schemas match the input transform node schema to avoid errors and successfully deploy the pipeline.

*Timestamp:* April 13, 2024

### How can I implement a custom User-Defined Function (UDF) to use in Pipeline Builder?

To implement a custom User-Defined Function (UDF) in Pipeline Builder, refer to [documentation on creating and using UDFs](/docs/foundry/transforms-java/user-defined-functions/) as well as how to run arbitrary Java code in Pipeline Builder.

*Timestamp:* April 19, 2024

### How can I add row numbers to a dataset that is built by uploading CSV files?

You can enable the **Row number** via the **Edit schema** option in the dataset preview.

*Timestamp:* April 18, 2024

### How can I convert struct columns to JSON strings in Pipeline Builder?

The `JSON to string` expression can be used to convert struct columns to JSON strings.

*Timestamp:* June 14, 2024

### Why is there a discrepancy in row counts between the preview of a deployed dataset in Pipeline Builder and the actual dataset view?

The discrepancy could be caused if [input sampling strategies](/docs/foundry/pipeline-builder/management-input-sampling/) are applied in the preview. Also, consider that non-deterministic transformations may vary row counts.

*Timestamp:* June 28, 2024

### How do you clean up checkpoint datasets created by a pipeline?

Move the pipeline that created the checkpoint dataset to the trash, and it should also move the checkpoint dataset to the trash.

*Timestamp:* April 24, 2024

### How can `null` string values be mapped to a specific string (for example, "no data") in a Pipeline Builder pipeline?

There are two methods to achieve this in a Pipeline Builder pipeline:

1. Use the `Coalesce` function. For instance, `A = coalesce(A, "no data")`. If A is `null`, it will return "no data".
2. Use the `Case` board.

Both methods allow for the mapping of `null` values to a specified string.

*Timestamp:* July 11, 2024

### Is there a method to impute `null` values in a group of columns?

Yes, you can use the `Apply To Multiple Columns` transform to impute `null` values across different columns.

*Timestamp:* April 24, 2024
