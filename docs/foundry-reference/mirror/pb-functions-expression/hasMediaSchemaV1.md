<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/hasMediaSchemaV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Has media schema

> Supported in: Batch

Checks if a media reference has a specific schema type and format. This expression can be used as a filter condition to filter media sets by media type and allow downstream schema-specific transformations.

**Expression categories:** Media

## Declared arguments

* **Media format:** The format to assert.<br>*Enum\<BMP, DOCX, EML, FLAC, JP2K, JPEG, MKV, MOV, MP2, MP3, and more ...>*
* **Media reference:** The media reference to check.<br>*Expression\<Media reference>*
* **Media schema:** The schema to assert.<br>*Enum\<Audio, Document, Email, Image, Spreadsheet, Video>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Media format:** `png`
* **Media reference:** `mediaReference`
* **Media schema:** `imagery`

| mediaReference | **Output** |
| ----- | ----- |
| {"mimeType":"image/png","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | true |

***

### Example 2: Base case

**Argument values:**

* **Media format:** `wav`
* **Media reference:** `mediaReference`
* **Media schema:** `audio`

| mediaReference | **Output** |
| ----- | ----- |
| {"mimeType":"image/png","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | false |

***

### Example 3: Null case

**Argument values:**

* **Media format:** `png`
* **Media reference:** `mediaReference`
* **Media schema:** `imagery`

| mediaReference | **Output** |
| ----- | ----- |
| *null* | false |

***
