<!-- source: https://palantir.com/docs/foundry/dataset-preview/csv-parsing/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# CSV parsing

Foundry supports **CSV datasets**. These are datasets that contain files in the CSV format.

The CSV format can use different delimiters, quote characters, and escape characters. To manage this, you can define parameters that control how CSV files are parsed. These parameters are stored in the schema of a dataset. Foundry will use inference to suggest a sensible set of parameters for a given dataset, but results should be validated and changes made if necessary.

## Parsing in Foundry

Foundry CSV datasets will generally have the `TextDataFrameReader` defined as their `dataFrameReaderClass` in the schema. This supports a set of custom parameters that can help deal with messy data effectively. At execution time, this delegates to the [Spark CSV DataFrameReader ↗](https://spark.apache.org/docs/latest/sql-data-sources-csv.html) for the best possible performance and reliability.

## Configuration

In Foundry, you can view the schema on any dataset in the [Dataset Preview](/docs/foundry/dataset-preview/overview/) application by navigating to the **Details** tab and selecting **Schema**. For more details on the schema, see the [Dataset](/docs/foundry/data-integration/datasets/) documentation.

CSV schemas can be manipulated in the **Edit Schema** UI, available from [Dataset Preview](/docs/foundry/dataset-preview/overview/) when viewing the preview tab. This will help visualize the options available and how they affect the output dataset. In cases where CSVs are particularly malformed, you may need to manually edit the schema to get the desired output.

### TextDataFrameReader options

To manually configure the `TextDataFrameReader` options in the schema, you can navigate to the schema page in the **Details** tab of [Dataset Preview](/docs/foundry/dataset-preview/overview/) and select **Edit**. At the bottom of the schema, there should be a section as follows:

```json
  "dataFrameReaderClass": "com.palantir.foundry.spark.input.TextDataFrameReader",
  "customMetadata": {
    "textParserParams": {
      "parser": "CSV_PARSER",
      "charsetName": "UTF-8",
      "fieldDelimiter": ",",
      "recordDelimiter": "\n",
      "quoteCharacter": "\"",
      "dateFormat": {},
      "skipLines": 1,
      "jaggedRowBehavior": "THROW_EXCEPTION",
      "parseErrorBehavior": "THROW_EXCEPTION",
      "addFilePath": false,
      "addFilePathInsteadOfUri": false,
      "addImportedAt": false,
      "initialReadTimeout": "1 hour"
    }
  }
}
```

The following options are available for the `TextDataFrameReader`:

| Property           | Purpose                                                                              | Accepted values                                                        | Required?                       | Parsers supported                                 |
| -------------------| -------------------------------------------------------------------------------------| -----------------------------------------------------------------------| --------------------------------| --------------------------------------------------|
| parser             | The parser type to use.                                                              | CSV\_PARSER, MULTILINE\_CSV\_PARSER, SIMPLE\_PARSER, SINGLE\_COLUMN\_PARSER  | Yes                             | N/A                                               |
| nullValues         | The values that should be parsed to null.                                            | A list of strings                                                      | Yes                             | all                                               |
| fieldDelimiter     | The delimiter character for splitting a record into multiple fields.                 | A one-character string                                                 | No, default to , (comma)        | CSV\_PARSER, MULTILINE\_CSV\_PARSER, SIMPLE\_PARSER   |
| recordDelimiter    | The end of line symbols for splitting a CSV file into multiple records.              | A string ends with newline character                                   | No, default to \n (newline)      CSV\_PARSER, MULTILINE\_CSV\_PARSER                   |
| quoteCharacter     | The quote character for CSV parsing.                                                 | A one-character string                                                 | No, default to " (doublequote)  | CSV\_PARSER, MULTILINE\_CSV\_PARSER                  |
| dateFormat         | Format strings for date parsing in certain columns.                                  | A map that maps column names to JodaTime DateTimeFormat patterns       | No, default to empty map        | CSV\_PARSER, MULTILINE\_CSV\_PARSER, SIMPLE\_PARSER   |
| skipLines          | The number of lines to skip parsing at the start of each file.                       | A non-negative number                                                  | No, default to 0                | all                                               |
| jaggedRowBehavior  | Behavior when there are more or fewer columns than types specified in the header.    | THROW\_EXCEPTION, DROP\_ROW                                              | No, defaults to THROW\_EXCEPTION | N/A                                               |
| parseErrorBehavior | Behavior when a value fails to parse into the requested type specified in the header.| THROW\_EXCEPTION, REPLACE\_WITH\_NULL                                     | No, defaults to THROW\_EXCEPTION | N/A                                               |
| addFilePath        | Each row is augmented by a file path.                                                | Boolean                                                                | No, default to false            | all                                               |
| addImportedAt      | Each row is augmented by the import time.                                            | Boolean                                                                | No, default to false            | all                                               |
| initialReadTimeout | Limits the time the parser will wait to read the first row.                          | A human-readable duration                                              | No, default to 1 hour           | all                                               |

### Spark CSV options

If you are already familiar with the Spark CSV DataFrameReader, you can configure the `dataFrameReaderClass` to be `DataSourceDataFrameReader` and the `format` to be `csv` in the `customMetadata`.

See the [Spark CSV DataFrameReader documentation ↗](https://spark.apache.org/docs/latest/sql-data-sources-csv.html) for a list of supported options. You can add the configurations as key-value pairs like this:

```json
  "dataFrameReaderClass": "com.palantir.foundry.spark.input.DataSourceDataFrameReader",
  "customMetadata": {
    "format": "csv",
    "options": {
      "unescapedQuoteHandling": "STOP_AT_DELIMITER",
      "multiline": true,
      ...
    }
  }

```

:::callout{theme="neutral"}
Note that the schema options listed above are only applicable to datasets constructed from CSV files.
:::
