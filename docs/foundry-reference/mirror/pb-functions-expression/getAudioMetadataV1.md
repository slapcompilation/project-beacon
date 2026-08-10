<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/getAudioMetadataV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract audio metadata

> Supported in: Batch

Extracts metadata fields from an audio file.

**Expression categories:** Media

## Declared arguments

* **Media reference:** The column containing media references to audio files in the media set.<br>*Expression\<Media reference>*
* **Metadata to include:** Select the metadata fields to include in the output.<br>*Set\<Enum\<Audio specification, Bytes, Format>>*

**Output type:** *Struct*

## Examples

### Example 1: Base case

**Argument values:**

* **Media reference:** `Media Reference`
* **Metadata to include:** \[`Format`, `Specification`, `Bytes`]

| Media Reference | **Output** |
| ----- | ----- |
| {"mimeType":"audio","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | {<br> **bytes**: 156700,<br> **format**: audio,<br> **specification**: {<br> \*\*b... |

***
