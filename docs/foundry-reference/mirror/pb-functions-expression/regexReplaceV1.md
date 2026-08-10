<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/regexReplaceV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Regex replace

> Supported in: Batch, Faster, Streaming

Replace a string using a regex pattern.

**Expression categories:** Regex, String

## Declared arguments

* **Expression:** Input string to replace.<br>*Expression\<String>*
* **Pattern:** The regex pattern to match.<br>*Expression\<String>*
* **Replace:** Replacement string.<br>*Expression\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `tail_number`
* **Pattern:** (\w\w)(-)
* **Replace:** \*\*-

| tail\_number | **Output** |
| ----- | ----- |
| MT-123 | \*\*-123 |
| XB-434 | \*\*-434 |
| MT-123, XB-434 | \*\*-123, \*\*-434 |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `tail_number`
* **Pattern:** \\
* **Replace:** \\\\

| tail\_number | **Output** |
| ----- | ----- |
| this is a backslash \ etc | this is a backslash \ etc |

***

### Example 3: Base case

**Argument values:**

* **Expression:** `path`
* **Pattern:** \\
* **Replace:** /

| path | **Output** |
| ----- | ----- |
| path\to\file | path/to/file |
| C:\Users\John | C:/Users/John |

***

### Example 4: Base case

**Argument values:**

* **Expression:** `price`
* **Pattern:** $
* **Replace:** USD

| price | **Output** |
| ----- | ----- |
| Price is $50 | Price is USD 50 |
| $100 and $200 | USD 100 and USD 200 |

***

### Example 5: Base case

**Argument values:**

* **Expression:** `price`
* **Pattern:** $(\d+)
* **Replace:** $1 dollars

| price | **Output** |
| ----- | ----- |
| I have $100 | I have 100 dollars |
| $50 and $75 | 50 dollars and 75 dollars |

***

### Example 6: Base case

**Argument values:**

* **Expression:** `tail_number`
* **Pattern:** (\w\w)(-)
* **Replace:** \\

| tail\_number | **Output** |
| ----- | ----- |
| MT-123 | \123 |
| XB-434 | \434 |
| MT-123, XB-434 | \123, \434 |

***

### Example 7: Base case

**Argument values:**

* **Expression:** `text`
* **Pattern:** foo
* **Replace:** \\$

| text | **Output** |
| ----- | ----- |
| foo | $ |
| foo bar foo | $ bar $ |

***

### Example 8: Base case

**Argument values:**

* **Expression:** `tail_number`
* **Pattern:** (\w\w)(-)
* **Replace:** $

| tail\_number | **Output** |
| ----- | ----- |
| MT-123 | $123 |
| XB-434 | $434 |
| MT-123, XB-434 | $123, $434 |

***

### Example 9: Base case

**Argument values:**

* **Expression:** `tail_number`
* **Pattern:** (\w\w)(-)
* **Replace:** $1

| tail\_number | **Output** |
| ----- | ----- |
| MT-123 | MT123 |
| XB-434 | XB434 |
| MT-123, XB-434 | MT123, XB434 |

***

### Example 10: Null case

**Argument values:**

* **Expression:** `tail_number`
* **Pattern:** `regex`
* **Replace:** foo

| tail\_number | regex | **Output** |
| ----- | ----- | ----- |
| MT-123 | ( | *null* |

***

### Example 11: Null case

**Description:** Null inputs give null outputs.

**Argument values:**

* **Expression:** *null*
* **Pattern:** (\w\w)(-)
* **Replace:** \*\*

**Output:** *null*

***

### Example 12: Null case

**Description:** Null inputs give null outputs.

**Argument values:**

* **Expression:** foo
* **Pattern:** bar
* **Replace:** *null*

**Output:** *null*

***
