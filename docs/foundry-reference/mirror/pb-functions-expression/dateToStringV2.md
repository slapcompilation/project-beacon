<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/dateToStringV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Format date as string

> Supported in: Batch, Faster, Streaming

Returns the date as formatted string in accordance to the Java DateTimeFormatter. The default format is ISO8601.

**Expression categories:** Cast, String

## Declared arguments

* **Date:** The date to format as a string.<br>*Expression\<Date>*
* *optional* **Format:** The format to use. The default format is ISO8601.<br>*Literal\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Date:** 2022-12-20
* **Format:** yy-MM-dd

**Output:** 22-12-20

***

### Example 2: Base case

**Argument values:**

* **Date:** 2022-12-20
* **Format:** *null*

**Output:** 2022-12-20

***

### Example 3: Base case

**Argument values:**

* **Date:** 2023-10-01
* **Format:** yyyy\_Q

**Output:** 2023\_4

***

### Example 4: Base case

**Argument values:**

* **Date:** 2023-10-01
* **Format:** yyyy\_q

**Output:** 2023\_4

***

### Example 5: Null case

**Argument values:**

* **Date:** *null*
* **Format:** yyyy-MM-dd

**Output:** *null*

***

### Example 6: Edge case

**Argument values:**

* **Date:** 2022-12-20
* **Format:** E

**Output:** Tue

***

### Example 7: Edge case

**Argument values:**

* **Date:** 2022-12-20
* **Format:** EEEE

**Output:** Tuesday

***

### Example 8: Edge case

**Argument values:**

* **Date:** 2023-10-01
* **Format:** DDD

**Output:** 274

***

### Example 9: Edge case

**Argument values:**

* **Date:** 2023-10-01
* **Format:** yyyy GG

**Output:** 2023 AD

***

### Example 10: Edge case

**Argument values:**

* **Date:** 2022-12-20
* **Format:** MMM, MMMM

**Output:** Dec, December

***

### Example 11: Edge case

**Argument values:**

* **Date:** 2023-10-01
* **Format:** YYYY

**Output:** 2023

***

### Example 12: Edge case

**Argument values:**

* **Date:** 2022-12-20
* **Format:** W

**Output:** 4

***

### Example 13: Edge case

**Argument values:**

* **Date:** 2022-12-20
* **Format:** F

**Output:** 6

***

### Example 14: Edge case

**Argument values:**

* **Date:** 2023-10-01
* **Format:** uuuu

**Output:** 2023

***
