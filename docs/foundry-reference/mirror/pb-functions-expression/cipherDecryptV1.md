<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/cipherDecryptV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Cipher decrypt

> Supported in: Batch, Faster, Streaming

Decrypts expression with cipher.

**Expression categories:** Other

## Declared arguments

* **Cipher license rid:** Cipher license to use.<br>*ResourceIdentifier*
* **Expression:** Expression to apply cipher decryption on.<br>*Expression\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Cipher license rid:** ri.bellaso.main.cipher-license.1-decrypt
* **Expression:** `string`

| string | **Output** |
| ----- | ----- |
| CIPHER::ri.bellaso.main.cipher-channel.1::OCRBIW3iHDltOGa6MEHwb7f/Dw==::CIPHER | bar |

***

### Example 2: Null case

**Argument values:**

* **Cipher license rid:** ri.bellaso.main.cipher-license.1-decrypt
* **Expression:** `string`

| string | **Output** |
| ----- | ----- |
| *null* | *null* |

***
