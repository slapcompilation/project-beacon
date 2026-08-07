<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isValidMediaReferenceV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is valid media reference

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid Foundry media reference.

**Expression categories:** Boolean

## Declared arguments

* **Expression:** String representing a media reference.<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `mediaRef`

| mediaRef | **Output** |
| ----- | ----- |
| {"mimeType":"PDF","reference":{"type":"datasetFile","datasetFile":{"fileReference":{"datasetRid":"ri.foundry.main.dataset.a","ref":"master","logicalFilePath":"file.pdf"}}}} | true |
| {"mimeType":"PDF","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.main.media-set.a", "mediaItemRid":"ri.mio.main.media-item.a"}}} | true |
| not a media reference | false |

***
