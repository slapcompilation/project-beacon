<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/levenshteinDistanceV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Edit distance

> Supported in: Batch, Faster, Streaming

Compute the edit distance between two strings. Supports Levenshtein, indel, and Damerau-Levenshtein distance.

**Expression categories:** Distance measurement, String

## Declared arguments

* **Distance function:** Distance function used to calculate the edit distance between the two strings.<br>*Enum\<Damerau-Levenshtein Distance, Indel Distance, Levenshtein Distance>*
* **Ignore case:** Do you want to ignore case when comparing the left and right strings?<br>*Literal\<Boolean>*
* **Left:** Left string to compare.<br>*Expression\<String>*
* **Right:** Right string to compare.<br>*Expression\<String>*
* *optional* **Normalize distance:** Do you want to normalize the distance to a value between 0 and 1, where 0 means no difference between strings and 1 means no similarity?<br>*Literal\<Boolean>*

**Output type:** *Double | Integer*

## Examples

### Example 1: Base case

**Description:** String edit distance calculated using Levenshtein distance

**Argument values:**

* **Distance function:** `levenshtein`
* **Ignore case:** false
* **Left:** `left`
* **Right:** `right`
* **Normalize distance:** false

| left | right | **Output** |
| ----- | ----- | ----- |
| hello | hello | 0 |
| hallo | hello | 1 |
| hlelo | hello | 2 |
| hello | hEllO | 2 |
| hello | hello, world! | 8 |
| hello | farewell | 6 |

***

### Example 2: Base case

**Description:** By setting ignore case to true, letters of different case are treated as equal. Here calculated using Damerau-Levenshtein distance.

**Argument values:**

* **Distance function:** `damerau_levenshtein`
* **Ignore case:** true
* **Left:** `left`
* **Right:** `right`
* **Normalize distance:** false

| left | right | **Output** |
| ----- | ----- | ----- |
| hello | hello | 0 |
| hallo | hello | 1 |
| hlelo | hello | 1 |
| hello | hEllO | 0 |
| hello | hello, world! | 8 |
| hello | farewell | 6 |

***

### Example 3: Base case

**Description:** By setting normalize to true, the edit distance is normalized to a value between 0 and 1. Here calculated using indel distance.

**Argument values:**

* **Distance function:** `indel`
* **Ignore case:** false
* **Left:** `left`
* **Right:** `right`
* **Normalize distance:** true

| left | right | **Output** |
| ----- | ----- | ----- |
| hello | hello | 0.0 |
| hallo | hello | 0.2 |
| hlelo | hello | 0.2 |
| hello | hEllO | 0.4 |
| hello | hello, world! | 0.4444444444444444 |
| hello | farewell | 0.5384615384615384 |

***

### Example 4: Null case

**Argument values:**

* **Distance function:** `levenshtein`
* **Ignore case:** false
* **Left:** `left`
* **Right:** `right`
* **Normalize distance:** false

| left | right | **Output** |
| ----- | ----- | ----- |
| hello | *null* | *null* |
| *null* | hello | *null* |
| *null* | *null* | *null* |

***
