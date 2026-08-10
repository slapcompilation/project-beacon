<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/castMediaSchemaV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Cast media schema

> Supported in:

Casts a media reference to a specific media schema and format. This is useful when the input media has a generic schema (multimodal) but the actual content is known to be a specific type (such as a png image). The cast narrows the type metadata to allow downstream operations that require specific schema types.

**Expression categories:** Media

## Declared arguments

* **Media:** The media reference to cast the schema type of.<br>*Expression\<Media reference>*
* **Media format:** The specific format to cast to.<br>*Enum\<BMP, DOCX, EML, FLAC, JP2K, JPEG, MKV, MOV, MP2, MP3, and more ...>*

**Output type:** *Media reference*
