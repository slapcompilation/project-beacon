<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/regexMatchV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Regex match

> Supported in: Batch, Faster, Streaming

Matches an expression against a regular expression. Regular expression must match the whole string.

**Expression categories:** Regex, String

## Declared arguments

* **Expression:** The expression to match against the regular expression.<br>*Expression\<String>*
* **Regex:** The regular expression to match against.<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Description:** Regex must match the entire string

**Argument values:**

* **Expression:** (
* **Regex:** abc

**Output:** false

***

### Example 2: Base case

**Description:** Regex must match the entire string

**Argument values:**

* **Expression:** abcdefg
* **Regex:** abc

**Output:** false

***

### Example 3: Base case

**Description:** You can match regex patterns

**Argument values:**

* **Expression:** abcdefg
* **Regex:** abc?d.+

**Output:** true

***

### Example 4: Base case

**Description:** Regex patterns sometimes don't match input strings

**Argument values:**

* **Expression:** abdefg
* **Regex:** ab?d.\*

**Output:** true

***

### Example 5: Null case

**Description:** Null pattern do not match

**Argument values:**

* **Expression:** foo
* **Regex:** *null*

**Output:** false

***

### Example 6: Null case

**Description:** Null columns do not match

**Argument values:**

* **Expression:** *null*
* **Regex:** ab?d.\*

**Output:** false

***

### Example 7: Null case

**Argument values:**

* **Expression:** `foo`
* **Regex:** `pattern`

| foo | pattern | **Output** |
| ----- | ----- | ----- |
| foo | ( | false |
| foo | *null* | false |
| *null* | foo | false |
| *null* | *null* | false |

***
