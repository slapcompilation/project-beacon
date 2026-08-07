<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/pdfTableOfContentsV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract table of contents from PDF

> Supported in: Batch, Faster

Produces a table of contents from a PDF based on the headings used within the document.

**Expression categories:** Media

## Declared arguments

* **Media reference:** The column containing media references to PDF files in a media set.<br>*Expression\<Media reference>*

**Output type:** *Array\<Struct\<level:Integer, title:String, page:Integer>>*

## Examples

### Example 1: Base case

**Argument values:**

* **Media reference:** `Media Reference`

| Media Reference | **Output** |
| ----- | ----- |
| {"mimeType":"application/pdf","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | \[ {<br> **level**: 0,<br> **page**: 2,<br> **title**: Chapter 1,<br>}, {<br> \*\*l... |

***
