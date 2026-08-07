<!-- source: https://palantir.com/docs/foundry/dataset-preview/dataset-preview-faq/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Dataset Preview FAQ

The following are some frequently asked questions about Dataset Preview.

For general information, see the [Dataset Preview overview](/docs/foundry/dataset-preview/overview/).

* [CSV fails to parse due to unmatched quote character](#csv-fails-to-parse-due-to-unmatched-quote-character)
* [Dataset fails to parse because some underlying CSVs have more columns](#dataset-fails-to-parse-because-some-underlying-csvs-have-more-columns)
* [Why does my downloaded dataset look strange when I open it in Microsoft Excel?](#why-does-my-downloaded-dataset-look-strange-when-i-open-it-in-microsoft-excel)

***

## CSV fails to parse due to unmatched quote character

When uploading a CSV with nested double-quotes and embedded newline (`\n`) characters within quoted fields, the schema inference will fail, and you cannot use the Schema Editor to create a valid schema.

To troubleshoot, perform the following steps:

1. Upload the CSV to a dataset and select **Edit Schema**.
2. Set the **Column** and **Quotes** properties.
3. Ignore the schema validation errors and select **Save without Validating**, available in the dropdown menu next to the **Save and Validate** option. This will create a schema with the correct column definitions.
4. In the **Details** tab, open the schema in edit mode.
5. Change `dataFrameReaderClass` to `com.palantir.foundry.spark.input.DataSourceDataFrameReader`.
6. Add the following to the `"customMetadata"` object:

```
  "customMetadata": {
    "format": "csv",
    "options": {
      "header": true,
      "multiLine": true
    }
  }
```

[Return to top](#dataset-preview-faq)

***

## Dataset fails to parse because some underlying CSVs have more columns

When a dataset is composed of multiple CSVs (for example, through a Data Connection `APPEND` transaction), and some of those CSVs contain more columns, the schema inference will fail. One option is to ignore jagged rows (such as rows that are missing certain columns). To do this, select **Edit schema**, expand the **Parsing options** section, and check **Ignore jagged rows**.

However, if you want to keep the jagged rows and specify a standardized schema for the dataset, then this section applies. If the conditions outlined in the **Assumptions** section below hold for your data, then the troubleshooting steps will produce a dataset with a standard schema *defined by the user*, in which jagged rows are autopopulated with `null` for the columns which they are missing.

**Symptoms of parsing failures:**

You may encounter an error message such as the following: "Could not load preview: Encountered an error parsing the input CSV data. Make sure all data is correctly formatted."

You may also encounter the following error message after selecting **Edit Schema** and then **Save and Validate:** "Your dataset failed to validate on x rows."

**Assumptions**:

1. You can define the desired schema, such as all column names and types that the dataset should possess.

2. Your schema enforces strict column ordering. For example, if you want the dataset to contain and show columns *{a, b, c}*, an underlying CSV can have a column structure like:

* *{a}*
* *{a, b}*

but *cannot* have a column structure like:

* *{b, a}*

3. An underlying CSV must have all columns preceding the *n*-th column if it has the *(n+1)* th column. For example, if you want the dataset to contain and show columns *{a, b, c, d}*, an underlying CSV can have a column structure like:

* *{a}*
* *{a, b}*
* *{a, b, c}*

but *cannot* have a column structure like:

* *{b, c, d}*
* *{a, c, d}*
* *{a, b, d}*

Here is an example of a case in which the troubleshooting steps would be applicable and useful:

CSVs are regularly added to a dataset through `APPEND` transactions. One day, a new column is added and is the new last column in the CSV. In the dataset, rows from all previously-appended CSVs should have the new column, with field values autopopulated with `null` rather than being considered jagged.

The troubleshooting steps do not replicate the functionality of the `mergeSchema` option available for raw Parquet datasets (which are parsed with `com.palantir.foundry.spark.input.ParquetDataFrameReader` as the `dataFrameReaderClass`). A user-written transform is required to replicate such functionality on a raw CSV dataset.

To troubleshoot, perform the following steps:

1. In the **Details** tab, open the **Schema** tab, and select **Edit**
2. Modify the `fieldSchemaList` to ensure it includes all the columns that the dataset should possess. For example, if the dataset should have columns *{a, b, c}*, all with integer types, the `fieldSchemaList` may look like the following:

```
  "fieldSchemaList": [
    {
      "type": "INTEGER",
      "name": "a",
      "nullable": null,
      "userDefinedTypeClass": null,
      "customMetadata": {},
      "arraySubtype": null,
      "precision": null,
      "scale": null,
      "mapKeyType": null,
      "mapValueType": null,
      "subSchemas": null
    },
    {
      "type": "INTEGER",
      "name": "b",
      "nullable": null,
      "userDefinedTypeClass": null,
      "customMetadata": {},
      "arraySubtype": null,
      "precision": null,
      "scale": null,
      "mapKeyType": null,
      "mapValueType": null,
      "subSchemas": null
    },
    {
      "type": "INTEGER",
      "name": "c",
      "nullable": null,
      "userDefinedTypeClass": null,
      "customMetadata": {},
      "arraySubtype": null,
      "precision": null,
      "scale": null,
      "mapKeyType": null,
      "mapValueType": null,
      "subSchemas": null
    }
  ],
```

3. Change `"dataFrameReaderClass"` and its nested `customMetadata` object so that the end of your schema JSON looks like the following:

```
"dataFrameReaderClass": "com.palantir.foundry.spark.input.DataSourceDataFrameReader",
  "customMetadata": {
    "format": "csv",
    "options": {
      "multiLine": true,
      "header": true,
      "mode": "PERMISSIVE"
    }
  }
}
```

4. Select **Save**.

[Return to top](#dataset-preview-faq)

***

## Why does my downloaded dataset look strange when I open it in Microsoft Excel?

When exporting datasets from the platform, some files may appear squeezed when opened. This issue has been observed in certain regions and is caused by the default delimiter used in Excel. To fix this issue, you will need to change the delimiter pattern in your export settings:

1. Open the file in Excel.
2. Select the **Data** tab in the ribbon.
3. Select the **Text to Columns** option in the **Data Tools** group.
4. In the **Convert text to columns wizard** window, select the **Delimited** option and then **Next**.
5. In the **Delimiters** section, select the delimiter you want to use (such as comma, semicolon, tab).
6. Select **Next** and then **Finish** to complete the process.

[Return to top](#dataset-preview-faq)
