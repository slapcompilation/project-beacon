<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/regexIndexV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Regex index

> Supported in: Batch, Faster, Streaming

Returns an array of indices (counted as Unicode code points) at which the regular expression pattern is found in the given expression.

**Expression categories:** Regex, String

## Declared arguments

* **Expression:** The expression to match against the regular expression.<br>*Expression\<String>*
* **Regex:** The regular expression to find indices for.<br>*Expression\<String>*

**Output type:** *Array\<Integer>*

## Examples

### Example 1: Base case

**Description:** You can find regex patterns and their indices.

**Argument values:**

* **Expression:** ababab
* **Regex:** ab

**Output:** \[ 0, 2, 4 ]

***

### Example 2: Base case

**Description:** Overlapping matches are not considered separately; the entire matching segment is treated as a single match.

**Argument values:**

* **Expression:** abcdcef
* **Regex:** .*c.*

**Output:** \[ 0 ]

***

### Example 3: Base case

**Description:** Regex patterns sometimes don't match input strings, resulting in an empty array.

**Argument values:**

* **Expression:** abdefg
* **Regex:** cd

**Output:** \[  ]

***

### Example 4: Base case

**Argument values:**

* **Expression:** `string`
* **Regex:** `pattern`

| string | pattern | **Output** |
| ----- | ----- | ----- |
| Hello 👋 World | World | \[ 8 ] |
| café123 | \d+ | \[ 4 ] |
| a🎉b🎊c🎁d | \[a-z] | \[ 0, 2, 4, 6 ] |
| Hi\_café\_😀\_end | end | \[ 10 ] |

***

### Example 5: Null case

**Argument values:**

* **Expression:** `string`
* **Regex:** `pattern`

| string | pattern | **Output** |
| ----- | ----- | ----- |
| foofoo | \[def | *null* |
| foofoo | \[def] | \[ 0, 3 ] |
| *null* | ab | *null* |
| *null* | *null* | *null* |

***

### Example 6: Null case

**Description:** If the expression is null, the output is null.

**Argument values:**

* **Expression:** *null*
* **Regex:** ab

**Output:** *null*

***

### Example 7: Null case

**Description:** If the pattern is null, the output is null.

**Argument values:**

* **Expression:** ababab
* **Regex:** *null*

**Output:** *null*

***

### Example 8: Null case

**Argument values:**

* **Expression:** `string`
* **Regex:** `pattern`

| string | pattern | **Output** |
| ----- | ----- | ----- |
| foofoo | foo | \[ 0, 3 ] |
| foo | *null* | *null* |
| *null* | ab | *null* |
| *null* | *null* | *null* |

***
