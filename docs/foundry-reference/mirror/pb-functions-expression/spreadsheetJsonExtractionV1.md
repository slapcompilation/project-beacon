<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/spreadsheetJsonExtractionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract content from spreadsheets in JSON

> Supported in: Batch

Extract content from all sheets a spreadsheet in JSON format.

**Expression categories:** Media

## Declared arguments

* **Media reference:** The spreadsheet to extract content from.<br>*Expression\<Media reference>*
* *optional* **Error handling:** Determines the behavior of the pipeline for inputs that fail to process.<br>*Enum\<FAIL, NULL>*
* *optional* **Output fields:** Output fields to include.<br>*Set\<Enum\<Merged cells, Table>>*

**Output type:** *Map\<String, Struct>*
