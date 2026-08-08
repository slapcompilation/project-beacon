<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/unicodeNormalizeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Unicode normalize

> Supported in: Batch, Faster, Streaming

Perform unicode normalization as per Unicode Standard Annex #15.

**Expression categories:** Data preparation, String

## Declared arguments

* **Expression:** *no description*<br>*Expression\<String>*
* **Normalization form:** *no description*<br>*Enum\<NFC, NFD, NFKC, NFKD>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `string`
* **Normalization form:** `nfc`

| string | **Output** |
| ----- | ----- |
| １２３ | １２３ |
| イナゴ | イナゴ |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `string`
* **Normalization form:** `nfd`

| string | **Output** |
| ----- | ----- |
| １２３ | １２３ |
| イナゴ | イナゴ |

***

### Example 3: Base case

**Argument values:**

* **Expression:** `string`
* **Normalization form:** `nfkc`

| string | **Output** |
| ----- | ----- |
| １２３ | 123 |
| イナゴ | イナゴ |

***

### Example 4: Base case

**Argument values:**

* **Expression:** `string`
* **Normalization form:** `nfkd`

| string | **Output** |
| ----- | ----- |
| １２３ | 123 |
| イナゴ | イナゴ |

***
