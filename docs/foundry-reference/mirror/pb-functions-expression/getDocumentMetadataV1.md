<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/getDocumentMetadataV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract document metadata

> Supported in: Batch, Faster

Extracts metadata fields from a document.

**Expression categories:** Media

## Declared arguments

* **Media reference:** The column containing media references to PDF files in a media set.<br>*Expression\<Media reference>*
* **Metadata to include:** Select the metadata columns to include in the output.<br>*Set\<Enum\<Bytes, Document author, Document title, Page count>>*

**Output type:** *Struct*

## Examples

### Example 1: Base case

**Argument values:**

* **Media reference:** `Media Reference`
* **Metadata to include:** \[`Document Author`, `Page Count`, `Document Title`]

| Media Reference | **Output** |
| ----- | ----- |
| {"mimeType":"application/pdf","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | {<br> **author**: Jane Doe,<br> **page\_count**: 23,<br> **title**: Document Title,<br>} |

***

### Example 2: Base case

**Argument values:**

* **Media reference:** `Media Reference`
* **Metadata to include:** \[`Document Title`]

| Media Reference | **Output** |
| ----- | ----- |
| {"mimeType":"application/pdf","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | {<br> **title**: Who Framed Roger Rabbit - Final Script,<br>} |

***

### Example 3: Base case

**Argument values:**

* **Media reference:** `Media Reference`
* **Metadata to include:** \[`Document Author`, `Page Count`]

| Media Reference | **Output** |
| ----- | ----- |
| {"mimeType":"application/pdf","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | {<br> **author**: John Smith,<br> **page\_count**: 78,<br>} |

***

### Example 4: Null case

**Argument values:**

* **Media reference:** `Media Reference`
* **Metadata to include:** \[]

| Media Reference | **Output** |
| ----- | ----- |
| {"mimeType":"application/pdf","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | *null* |

***
