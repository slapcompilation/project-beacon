<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/gpuJsonAudioTranscriptionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Transcribe audio into JSON using GPU

> Supported in: Batch

Transcribe audio files into JSON using GPU.

**Expression categories:** Media

## Declared arguments

* **Media reference:** The column containing media references to audio files in the media sets.<br>*Expression\<Media reference>*
* *optional* **Language:** The language to detect in the input file. If no language is provided, it will be inferred from the first 30 seconds of audio.<br>*Enum\<Afrikaans, Albanian, Amharic, Arabic, Armenian, Assamese, Azerbaijani, Bashkir, Basque, Belarusian, and more ...>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Description:** Transcribe the audio file

**Argument values:**

* **Media reference:** `mediaReference`
* **Language:** *null*

| mediaReference | **Output** |
| ----- | ----- |
| {"mimeType":"audio/mpeg","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.main.media-set.a", "mediaItemRid":"ri.mio.main.media-item.a"}}} | {"version":1,"segments":\[{"id":"a1f69f02-f780-465b-94da-0930e2e2e7d2","channel":"1d38a2f7-e234-419e-... |

***

### Example 2: Base case

**Description:** Transcribe the audio file

**Argument values:**

* **Media reference:** `mediaReference`
* **Language:** *null*

| mediaReference | **Output** |
| ----- | ----- |
| {"mimeType":"audio/mpeg","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.main.media-set.a", "mediaItemRid":"ri.mio.main.media-item.a"}}} | {"version":1,"segments":\[{"id":"a1f69f02-f780-465b-94da-0930e2e2e7d2","channel":"1d38a2f7-e234-419e-... |

***

### Example 3: Null case

**Argument values:**

* **Media reference:** `Media Reference`
* **Language:** *null*

| mediaReference | **Output** |
| ----- | ----- |
| *null* | *null* |

***
