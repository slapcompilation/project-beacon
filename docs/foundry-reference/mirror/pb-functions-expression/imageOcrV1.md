<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/imageOcrV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract text from images (using OCR)

> Supported in: Batch, Faster

Extracts text from an image using optical character recognition (OCR).

**Expression categories:** Media

## Declared arguments

* **Languages to detect:** Languages to detect in the input files.<br>*Set\<Enum\<Afrikaans, Albanian, Amharic, Arabic, Armenian, Assamese, Azerbaijani, Azerbaijani - Cyrilic, Basque, Belarusian, and more ...>>*
* **Media reference:** The column containing media references to image files in a media set.<br>*Expression\<Media reference>*
* **OCR output format:** Output will be a string.<br>*Enum\<Text, hOCR>*
* **Scripts to detect:** Scripts to detect in the input files.<br>*Set\<Enum\<Arabic, Armenian, Bengali, Canadian Aboriginal, Cherokee, Cyrillic, Devanagari, Ethiopic, Fraktur, Georgian, and more ...>>*
* *optional* **Error handling:** Determines the behavior of the pipeline for inputs that fail to process.<br>*Enum\<FAIL, NULL>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Languages to detect:** {`ENG`}
* **Media reference:** `mediaReference`
* **OCR output format:** {`TEXT`}
* **Scripts to detect:** {`ARABIC`}
* **Error handling:** `FAIL_FAST`

| mediaReference | **Output** |
| ----- | ----- |
| {"mimeType":"image/png","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.main.media-set.a", "mediaItemRid":"ri.mio.main.media-item.a"}}} | This text came from the image in the media set. |

***
