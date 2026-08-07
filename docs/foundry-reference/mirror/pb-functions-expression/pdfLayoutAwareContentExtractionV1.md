<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/pdfLayoutAwareContentExtractionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract layout-aware content from PDF

> Supported in: Batch, Faster

Extracts content from the specified document, while preserving the document's layout.

**Expression categories:** Media

## Declared arguments

* **Languages to detect:** Languages to detect in the input files.<br>*Set\<Enum\<Afrikaans, Albanian, Amharic, Arabic, Armenian, Assamese, Azerbaijani, Azerbaijani - Cyrilic, Basque, Belarusian, and more ...>>*
* **Media reference:** The PDF to extract content from.<br>*Expression\<Media reference>*
* **Output format:** The desired format of the output. Choose between a simple text-based output or a structured output with all details, including the bounding boxes.<br>*Enum\<Full extract, Text and tables>*
* *optional* **End page:** The end of the page range (inclusive). If no value is provided, it will default to the last page.<br>*Expression\<Integer>*
* *optional* **Error handling:** Determines the behavior of the pipeline for inputs that fail to process.<br>*Enum\<FAIL, NULL>*
* *optional* **Start page:** The start of the page range. If no value is provided, it will default to the first page.<br>*Expression\<Integer>*

**Output type:** *Array\<Array\<Struct\<block\_index:Integer, block\_id:String, page:Integer, block\_type:String, content:String, bounding\_box:String, languages:Array\<String>, confidence:Double>>> | Array\<String>*

## Examples

### Example 1: Base case

**Argument values:**

* **Languages to detect:** {`ENG`}
* **Media reference:** `mediaReference`
* **Output format:** `TEXT`
* **End page:** `End Page`
* **Error handling:** `FAIL_FAST`
* **Start page:** `Start Page`

| mediaReference | **Output** |
| ----- | ----- |
| {"mimeType":"application/pdf","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.main.media-set.a", "mediaItemRid":"ri.mio.main.media-item.a"}}} | extracted content |

***
