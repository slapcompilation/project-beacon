<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/regexExtractAllV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract all regex matches

> Supported in: Batch, Faster, Streaming

Extract all instances of a regex match into an array.

**Expression categories:** Regex, String

## Declared arguments

* **Expression:** String to extract values from.<br>*Expression\<String>*
* **Group:** Group number to extract. If 0, the whole regex pattern is matched.<br>*Literal\<Integer>*
* **Pattern:** The regex pattern to match.<br>*Expression\<String>*

**Output type:** *Array\<String>*

## Examples

### Example 1: Base case

**Description:** Extract the first two initials from each code.

**Argument values:**

* **Expression:** MT-112, XB-967
* **Group:** 1
* **Pattern:** (\w\w)(-)

**Output:** \[ MT, XB ]

***

### Example 2: Base case

**Description:** Extract all match groups, this includes first two initials and the dash.

**Argument values:**

* **Expression:** MT-112, XB-967
* **Group:** 0
* **Pattern:** (\w\w)(-)

**Output:** \[ MT-, XB- ]

***

### Example 3: Base case

**Description:** Extract the second match group if present.

**Argument values:**

* **Expression:** hel1o code 2 1
* **Group:** 2
* **Pattern:** (\[0-9]+)\s\*(\[a-z]\*)

**Output:** \[ o, *empty string*, *empty string* ]

***

### Example 4: Base case

**Description:** Extract the second match group if present.

**Argument values:**

* **Expression:** hel1o code 2 1
* **Group:** 2
* **Pattern:** (\[0-9]+)\s\*(\[a-z]+)?

**Output:** \[ o, *empty string*, *empty string* ]

***

### Example 5: Base case

**Description:** Extract the pattern with no match group defined.

**Argument values:**

* **Expression:** this code\[123]
* **Group:** 0
* **Pattern:** code\[

**Output:** \[ code\[ ]

***

### Example 6: Base case

**Description:** Extract the second match group.

**Argument values:**

* **Expression:** hel1o code 2 app
* **Group:** 2
* **Pattern:** (\[0-9]+)\s\*(\[a-z]+)

**Output:** \[ o, app ]

***

### Example 7: Base case

**Description:** Extract with backtracking.

**Argument values:**

* **Expression:** hello hello hello hello
* **Group:** 1
* **Pattern:** (hello) \1

**Output:** \[ hello, hello ]

***

### Example 8: Base case

**Description:** Extract with lookahead.

**Argument values:**

* **Expression:** helloworld goodbyeworld
* **Group:** 1
* **Pattern:** (\w+)(?=world)

**Output:** \[ hello, goodbye ]

***

### Example 9: Null case

**Description:** Null inputs give null outputs.

**Argument values:**

* **Expression:** *null*
* **Group:** 1
* **Pattern:** (\w\w)(-)

**Output:** *null*

***
