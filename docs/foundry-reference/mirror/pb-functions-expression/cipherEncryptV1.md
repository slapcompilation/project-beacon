<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/cipherEncryptV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Cipher encrypt

> Supported in: Batch, Faster, Streaming

Encrypts expression with cipher.

**Expression categories:** Other

## Declared arguments

* **Cipher license rid:** Cipher license to use.<br>*ResourceIdentifier*
* **Expression:** Expression to apply cipher encryption on.<br>*Expression\<String>*

**Output type:** *Cipher Text*

## Examples

### Example 1: Base case

**Argument values:**

* **Cipher license rid:** ri.bellaso.main.cipher-license.1-encrypt
* **Expression:** `string`

| string | **Output** |
| ----- | ----- |
| bar | CIPHER::ri.bellaso.main.cipher-channel.1::OCRBIW3iHDltOGa6MEHwb7f/Dw==::CIPHER |

***

### Example 2: Null case

**Argument values:**

* **Cipher license rid:** ri.bellaso.main.cipher-license.1-encrypt
* **Expression:** `string`

| string | **Output** |
| ----- | ----- |
| *null* | *null* |

***
