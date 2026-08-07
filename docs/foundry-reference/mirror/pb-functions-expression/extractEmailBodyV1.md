<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/extractEmailBodyV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract email body

> Supported in: Batch

Extracts the email body from an email media item as either plain text or html.

**Expression categories:** Media

## Declared arguments

* **Media reference:** The email media item to extract the body from.<br>*Expression\<Media reference>*
* *optional* **Error handling:** Determines the behavior of the pipeline for inputs that fail to process.<br>*Enum\<FAIL, NULL>*
* *optional* **Output format:** The format to return the extracted email body as. Defaults to plain text.<br>*Enum\<HTML, Plain Text>*

**Output type:** *String*
