<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/stringToDateV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert a string to date

> Supported in: Batch, Faster, Streaming

Returns the date given a formatted string in accordance to the Java DateTimeFormatter. The default formats are `yyyy-MM-dd` and `yyyy-MM-dd'T'HH:mm:ss.SSSXXX`. The formats are run in order, the first matching format will be returned.

**Expression categories:** Cast, Datetime

## Declared arguments

* **String:** String column to parse to date.<br>*Expression\<String>*
* *optional* **Formats:** Input a date format (e.g. yyyy-MM-dd or MM/dd/yyyy).<br>*List\<Literal\<String>>*

**Output type:** *Date*

## Examples

### Example 1: Base case

**Description:** Date formats are optional

**Argument values:**

* **String:** 2020-04-28
* **Formats:** *null*

**Output:** 2020-04-28

***

### Example 2: Base case

**Description:** Date formats are optional

**Argument values:**

* **String:** 2020-04-28T01:00:00.000Z
* **Formats:** *null*

**Output:** 2020-04-28

***

### Example 3: Base case

**Description:** Dates parsed with a single format.

**Argument values:**

* **String:** 28-2020-04
* **Formats:** \[dd-yyyy-MM]

**Output:** 2020-04-28

***

### Example 4: Base case

**Description:** Multiple formats used to parse dates

**Argument values:**

* **String:** 28-2020-04
* **Formats:** \[yyyy-MM-dd, dd-yyyy-MM]

**Output:** 2020-04-28

***

### Example 5: Base case

**Description:** If dates are missing leading zeros, they are still parsed correctly using this "yyyy-M-d" format.

**Argument values:**

* **String:** `date`
* **Formats:** \[yyyy-M-d]

| date | **Output** |
| ----- | ----- |
| 2020-04-08 | 2020-04-08 |
| 2020-4-8 | 2020-04-08 |
| 2020-10-10 | 2020-10-10 |

***

### Example 6: Base case

**Description:** Strings can contain a timestamp

**Argument values:**

* **String:** 28-2020-04 10:12:00 +01
* **Formats:** \[dd-yyyy-MM HH\:mm:ss X]

**Output:** 2020-04-28

***

### Example 7: Base case

**Description:** Timezone can change the date.

**Argument values:**

* **String:** 28-2020-04 10:12:00 +11
* **Formats:** \[dd-yyyy-MM HH\:mm:ss X]

**Output:** 2020-04-27

***

### Example 8: Null case

**Description:** Null columns remain null

**Argument values:**

* **String:** *null*
* **Formats:** \[dd-yyyy-MM]

**Output:** *null*

***

### Example 9: Edge case

**Description:** Invalid data is parsed to null

**Argument values:**

* **String:** 28-20201-14
* **Formats:** \[dd-yyyy-MM]

**Output:** *null*

***

### Example 10: Edge case

**Description:** Incorrect formats parse everything to null

**Argument values:**

* **String:** 04-2020-28
* **Formats:** \[dd-yyyy-MM]

**Output:** *null*

***

### Example 11: Edge case

**Description:** Year-only formats are not supported

**Argument values:**

* **String:** 2023
* **Formats:** \[yyyy]

**Output:** *null*

***
