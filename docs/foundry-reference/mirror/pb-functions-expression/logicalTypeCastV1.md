<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/logicalTypeCastV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Logical type cast

> Supported in: Batch, Faster, Streaming

Cast expression to given logical type. Unlike the regular cast expression, this expression will not change the underlying base representation of the data, but rather enforce the constraints associated with the specified logical type, so that the output can be used as the input to downstream expressions which specifically demand an instance of that logical type.

**Expression categories:** Cast

## Declared arguments

* **Expression:** Expression to cast.<br>*Expression\<C>*
* **Logical type:** Logical type to cast to.<br>*LogicalType*
* *optional* **Default value:** Default value in case the specified expression does not fulfill the constraints of the desired logical type. If not specified, this default value will be null. If the default value itself does not fulfill the constraints of the desired logical type, the result of this expression will be null.<br>*Expression\<C>*

**Type variable bounds:** *C accepts AnyType*

**Output type:** *C*

## Examples

### Example 1: Base case

**Description:** Unsuccessful cast to natural number with default

**Argument values:**

* **Expression:** -1234
* **Logical type:** Natural number
* **Default value:** -1

**Output:** *null*

***

### Example 2: Base case

**Description:** Successful cast to natural number

**Argument values:**

* **Expression:** 1234
* **Logical type:** Natural number
* **Default value:** *null*

**Output:** 1234

***

### Example 3: Base case

**Description:** Unsuccessful cast to natural number

**Argument values:**

* **Expression:** -1234
* **Logical type:** Natural number
* **Default value:** *null*

**Output:** *null*

***

### Example 4: Base case

**Description:** Unsuccessful cast to natural number with default

**Argument values:**

* **Expression:** -1234
* **Logical type:** Natural number
* **Default value:** 1

**Output:** 1

***
