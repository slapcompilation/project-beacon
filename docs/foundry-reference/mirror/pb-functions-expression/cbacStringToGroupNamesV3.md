<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/cbacStringToGroupNamesV3/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Parse classification string

> Supported in: Batch, Streaming

Returns the markings parsed from a given classification string. This output is formatted as a struct, where the first element of the struct is an array comprising the classification markings that represent the input. This list is null if the classification string is invalid, or if there are other errors that occur while parsing the markings. The second element of the struct is the string of error message(s). If there are no errors, the error field will be null. This expression is called asynchronously for performance.

**Expression categories:** Other

## Declared arguments

* **Expression:** A classification string.<br>*Expression\<String>*

**Output type:** *Struct\<markingIds:Array\<Classification>, errors:String>*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `cbacString`

| cbacString | **Output** |
| ----- | ----- |
| MS//MNF | \[ MS, MNF ] |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `cbacString`

| cbacString | **Output** |
| ----- | ----- |
| *empty string* | \[  ] |

***
