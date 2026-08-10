<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/soundexV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Soundex

> Supported in: Batch, Faster

Compute the soundex encoding (a phonetic representation) for a word.

**Expression categories:** String

## Declared arguments

* **Expression:** Input string (ideally a single word) to be encoded.<br>*Expression\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `input_string`

| input\_string | **Output** |
| ----- | ----- |
| cat | C300 |
| caat | C300 |
| two | T000 |
| too | T000 |
| to | T000 |
| four | F600 |
| for | F600 |
| fore | F600 |
| fur | F600 |
| meow | M000 |
| me ow | M000 |

***

### Example 2: Null case

**Argument values:**

* **Expression:** `input_string`

| input\_string | **Output** |
| ----- | ----- |
| *null* | *null* |
| *empty string* | *empty string* |

***
