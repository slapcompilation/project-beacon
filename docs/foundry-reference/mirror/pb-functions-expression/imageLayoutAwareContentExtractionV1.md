<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/imageLayoutAwareContentExtractionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract layout-aware content from images

> Supported in: Batch, Faster

Extracts content from images, while preserving the original layout.

**Expression categories:** Media

## Declared arguments

* **Languages to detect:** Languages to detect in the input files.<br>*Set\<Enum\<Afrikaans, Albanian, Amharic, Arabic, Armenian, Assamese, Azerbaijani, Azerbaijani - Cyrilic, Basque, Belarusian, and more ...>>*
* **Media reference:** The image to extract content from.<br>*Expression\<Media reference>*
* **Output format:** Output will be a string.<br>*Enum\<Full extract, Text and tables>*
* *optional* **Error handling:** Determines the behavior of the pipeline for inputs that fail to process.<br>*Enum\<FAIL, NULL>*

**Output type:** *Array\<Struct\<block\_index:Integer, block\_id:String, block\_type:String, content:String, bounding\_box:String, languages:Array\<String>, confidence:Double>> | String*

## Examples

### Example 1: Base case

**Argument values:**

* **Languages to detect:** {`ENG`}
* **Media reference:** `mediaReference`
* **Output format:** `TEXT`
* **Error handling:** `FAIL_FAST`

| mediaReference | **Output** |
| ----- | ----- |
| {"mimeType":"image/png","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.main.media-set.a", "mediaItemRid":"ri.mio.main.media-item.a"}}} | extracted content |

***
