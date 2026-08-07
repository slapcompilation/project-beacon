<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/pdfOcrV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract text from PDF (using OCR)

> Supported in: Batch, Faster

Extracts text from the pages in a PDF file using optical character recognition (OCR).

**Expression categories:** Media

## Declared arguments

* **Languages to detect:** Languages to detect in the input files.<br>*Set\<Enum\<Afrikaans, Albanian, Amharic, Arabic, Armenian, Assamese, Azerbaijani, Azerbaijani - Cyrilic, Basque, Belarusian, and more ...>>*
* **Media reference:** The column containing media references to PDF files in a media set.<br>*Expression\<Media reference>*
* **OCR output format:** Output will be an array of strings. Each entry corresponds to one page of the PDF.<br>*Enum\<Text, hOCR>*
* **Scripts to detect:** Scripts to detect in the input files.<br>*Set\<Enum\<Arabic, Armenian, Bengali, Canadian Aboriginal, Cherokee, Cyrillic, Devanagari, Ethiopic, Fraktur, Georgian, and more ...>>*
* *optional* **End page:** The end of the page range (inclusive). Negative indexing is supported.<br>*Expression\<Integer>*
* *optional* **Error handling:** Determines the behavior of the pipeline for inputs that fail to process.<br>*Enum\<FAIL, NULL>*
* *optional* **Start page:** The start of the page range. If no value is provided, it will default to the first page.<br>*Expression\<Integer>*

**Output type:** *Array\<String>*

## Examples

### Example 1: Base case

**Argument values:**

* **Languages to detect:** {`ENG`}
* **Media reference:** `mediaReference`
* **OCR output format:** {`TEXT`}
* **Scripts to detect:** {`ARABIC`}
* **End page:** *null*
* **Error handling:** `FAIL_FAST`
* **Start page:** *null*

| mediaReference | **Output** |
| ----- | ----- |
| {"mimeType":"application/pdf","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.main.media-set.a", "mediaItemRid":"ri.mio.main.media-item.a"}}} | \[ This text came from the PDF document in the media set., So did this text. ] |

***
