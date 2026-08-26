<!-- source: https://palantir.com/docs/foundry/contour/expressions-syntax/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Syntax and supported functions

For an orientation to the Expression board, see the [guide on using the expression board](/docs/foundry/contour/expressions-use-board/). This document is a resource for using Contour's rich expression language and can be used as a reference for types, operations and functions.

***

## Data types

You can use the following data types in expressions:

* [String](#string)
* [Integer](#integer)
* [Double](#double)
* [Boolean](#boolean)
* [Date](#date)

### String

Strings are expressed in single quotes:

`'This is a string'`

> This is a string

Escape single quotes within the string by adding a second single quote:

`'I''m a string'`

> I’m a string

Concatenate columns as strings with the `||` operator:

`"Gender" || "MaritalStatus"`

You can also concatenate columns with constants.

`'$' || ("salaryColumn"/1000.0) || 'k'`

### Integer

Integers are non-floating point numbers:

`5`

### Double

Doubles are floating point numbers:

`5.7`

### Boolean

Boolean variables can be either `true` or `false`. Boolean variables are case-insensitive.

### Date

You can cast strings in the format YYYY-MM or YYYY-MM-DD as dates:

`CAST('2016-12-06' AS DATE)`

You can also cast strings as timestamps:

`CAST('2016-12-06 01:12:34' AS TIMESTAMP)`

When performing operations with timestamps, it is easiest to first cast the timestamp to a long, or to a double if you need millisecond precision. This gives you the number of seconds in UNIX time.

For example, say you have two timestamp columns: “start” and “end.” To determine the number of minutes between the two times, you can use the following expression:

`(CAST("end" as LONG) - CAST("start" as LONG)) / 60`.

Casting longs to timestamps assumes that long values are in seconds. If your data is in milliseconds, divide by 1000 prior to casting.

***

## Operations

The following sections give an overview over the operations that you can use in expressions and their precedence:

* [Arithmetic](#arithmetic)
* [Comparison](#comparison)
* [Equality comparison](#equality-comparison)
* [Boolean comparison](#boolean-comparison)
* [Casting](#casting)
* [Case/When/End](#casewhenend)
* [Like](#like)
* [Null checks](#null-checks)
* [Precedence](#precedence)

### Arithmetic

Add, subtract, multiply, and divide numeric columns (integers or doubles) by other numeric columns or by constants: `+`, `-`, `*`, `/`

* `"tipAmount" / "fare"`
* `"diameter" * 3.14`

### Comparison

Compare columns of any type against each other and against constants with `>` (greater than), `>=` (greater than or equal to), `<` (less than), `<=` (less than or equal to). Results in a column of booleans.

* `"age" > "averageAge"`
* `"totalDistance" < 5`

### Equality comparison

Check whether a row has the *same* value in two columns with `==`, or *different* values with `!=`.

* `"cityOfBirth" == "cityOfResidence"`

You can also compare column values with constants.

* `"Gender" == 'M'`

:::callout{theme="neutral" title="String comparisons"}
When comparing two strings, lexicographical ordering is used. Note that this can be counterintuitive when comparing strings that contain numbers. For example:

* `'Alligator' < 'Boat'` => TRUE because the encoding of 'A' is less than that of 'B'
* `'Alliance' < 'Alligator'` => TRUE because 'a' is less than 'g'
* `'Zoo' < 'alpha'` => TRUE because 'Z' is less than 'a'
* `'Zoo' < 'Zoologist'` => TRUE because if one string is the prefix of the other, the shorter one is considered to be lesser
* `'1' < '2'` => TRUE because the string character '1' is less than the string character '2'
* `'10' < '2'` => TRUE because its first string character '1' is less than the string character '2'; note that this is a comparison of the strings '10' and '2', not the integers 10 and 2
* `'10' < '20'` => TRUE because '1' is less than '2'
:::

:::callout{theme="neutral" title="Behavior differences with Spark SQL"}
In the Contour expression language, equality comparisons with `NULL` have the below behavior.

* `NULL = 'DATA'` => FALSE
* `NULL != 'DATA'` => TRUE
* `NULL = NULL` => TRUE
* `NULL != NULL` => FALSE

However, in Spark SQL, all of these expressions return `NULL`. When translating between Contour expressions and Spark SQL, it is important to consider this difference in behavior in order to produce consistent results.
:::

### Boolean comparison

Derive a new column of booleans by evaluating one or more columns with boolean logic.

* `"Age" >=70 AND "Gender" = 'M'`

### Casting

Casting lets you change the type of a column or expression. You can cast to booleans, integers, doubles, dates, and timestamps.

* `CAST("startDate" AS DATE)`
* `CAST("startTime" AS TIMESTAMP)`
* `CAST("numParticipants" AS INTEGER)`

### Case/When/End

Case statements let you evaluate multiple possibilities in one expression. Each statement is evaluated in order, and the `THEN` statement is executed for the first one to evaluate to true.

```sql
CASE
    WHEN "age" < 13 THEN 'Child'
    WHEN "age" > 19 THEN 'Adult'
    ELSE 'Teenager'
END
```

```sql
CASE MaritalStatus
    WHEN 'S' THEN 'Single'
    WHEN 'M' THEN 'Married'
    ELSE 'Unknown'
END
```

### Like

Search for a specified pattern in a column. See the documentation on [SQL LIKE ↗](https://www.w3schools.com/sql/sql_like.asp) to learn more.

### Null Checks

Check whether a value `IS NULL` or `IS NOT NULL`. Returns a boolean.

### Precedence

The precedence of operations within expressions is detailed in the following list, from highest precedence to the lowest. Operations that are on the same line all have the same precedence.

1. +, -, NOT (unary)
2. || (binary)
3. \*, /, % (binary)
4. +, - (binary)
5. <, <=, >, >= (binary)
6. \=, ==, !=, <>, IS, IS NOT, LIKE, RLIKE (binary)
7. IS NULL, NOT NULL (unary)
8. IN, NOT IN
9. AND (binary)
10. OR (binary)

***

## Functions

The following is a complete list of functions available in column expressions.

* [Math & numerical functions](#math--numerical-functions)
* [String functions](#string-functions)
* [Date/time functions](#datetime-functions)
* [Array functions](#array-functions)
* [Window functions](#window-functions)
* [Aggregate functions](#aggregate-functions)
* [Misc functions](#misc-functions)

### Math & numerical functions

* ABS: Computes the absolute value.
* CBRT: Computes the cube-root of the given value.
* CEIL: Computes the ceiling of the given value.
* COS: Computes the cosine of the given value.
* EXP: Computes the exponential of the given value.
* FACTORIAL: Computes the factorial of the given value.
* FLOOR: Computes the floor of the given value.
* FORMAT\_NUMBER: Formats numeric column arg0 to a format like ‘#,###,###.##’, rounded to arg1 decimal places, and returns the result as a string column (note: arg1 must be an integer literal).
* ISNAN: Return true if, and only if, the column is NaN.
* LN: Computes the natural logarithm of the given value.
* LOG: Computes the logarithm of the arg1 with a base of the arg0 (note: arg0 must be a numeric literal).
* POW: Returns the value of the arg0 raised to the power of arg1.
* RAND: Returns a random number between 0 and 1 for each row, based on the provided seed arg0.
* ROUND: Returns the value of arg0 rounded to arg1 decimal places (note: arg1 must be an integer literal).
* RTRIM: Trim the spaces from right end for the specified string value.
* SIN: Computes the sine of the given column.
* SQRT: Computes the square root of the specified float value.
* TAN: Computes the tangent of the given value.

### String functions

Examples that reference the `name` column assume it contains the value `Jane`.

* CONCAT: Concatenates multiple input string columns together into a single string column. For example, `CONCAT("firstName", "lastName")` returns `JaneDoe` when `firstName` is `Jane` and `lastName` is `Doe`.
* CONCAT\_WS: Concatenates multiple input string columns together into a single string column, using the given separator (note: arg0 must be a string literal). For example, `CONCAT_WS(' ', "firstName", "lastName")` returns `Jane Doe` when `firstName` is `Jane` and `lastName` is `Doe`.
* FORMAT\_STRING: Formats the arguments according to [Java Formatter ↗](https://docs.oracle.com/javase/7/docs/api/java/util/Formatter.html) and returns the result as a string column. For example, `FORMAT_STRING('%.2f', "salary")` returns `1234.50` when `salary` is `1234.5`.
* LENGTH: Computes the length of a given string or binary column. For example, `LENGTH("name")` returns `4`.
* LEVENSHTEIN: Computes the edit distance between two string columns. For example, `LEVENSHTEIN("wordA", "wordB")` returns `3` when `wordA` is `kitten` and `wordB` is `sitting`.
* LOWER: Converts a string column to lower case. For example, `LOWER("name")` returns `jane`.
* LPAD: Returns the string column arg0, left-padded up to length arg1, with the string arg2 (note: arg1 must be an integer literal and arg2 must be a string literal). For example, `LPAD("id", 5, '0')` returns `00042` when `id` is `42`.
* LTRIM: Trim the spaces from left end for the specified string value. For example, `LTRIM("name")` returns `Jane` when `name` is `  Jane` (leading spaces removed).
* REGEXP\_EXTRACT: Match string column arg0 against regex arg1 and extract a specific group arg2 (1-indexed). If the regex did not match, or the specified group did not match, an empty string is returned. (note: arg1 must be a string literal and arg2 must be an integer literal). For example, `REGEXP_EXTRACT("email", '([^@]+)@', 1)` returns `jane` when `email` is `jane@example.com`.
* REGEXP\_REPLACE: Replaces all text in arg0 that matches arg1 with arg2. For example, `REGEXP_REPLACE("phone", '[^0-9]', '')` returns `5551234` when `phone` is `555-1234`.
* REVERSE: Reverses the string column and returns it as a new string column. For example, `REVERSE("name")` returns `enaJ`.
* RPAD: Returns the string column arg0, right-padded up to length arg1, with the string arg2 (note: arg1 must be an integer literal and arg2 must be a string literal). For example, `RPAD("code", 5, '*')` returns `AB***` when `code` is `AB`.
* SPLIT: Splits string column arg0 around regex string arg1 (note: arg1 must be a string literal). For example, `SPLIT("fullName", ' ')` returns the array `['Jane', 'Doe']` when `fullName` is `Jane Doe`.
* SUBSTRING: Returns part of arg0, starting at index arg1 (1-indexed) and of length arg2 (note: arg1 and arg2 must be integer literals). For example, `SUBSTRING("name", 1, 3)` returns `Jan`.
* TRIM: Trim the spaces from both ends for the specified string column. For example, `TRIM("name")` returns `Jane` when `name` is `  Jane  `.
* UPPER: Converts a string column to upper case. For example, `UPPER("name")` returns `JANE`.

### Date/time functions

More info and examples on deriving relative date is available in the [reference documentation on deriving relative dates](/docs/foundry/contour/expressions-relative-dates/).

* ADD\_MONTHS: Returns the date that is arg1 months after arg0 (note: arg1 must be an integer literal)
* CURRENT\_DATE: Returns the current date as a date column. **These values are updated only when the path is recalculated. To avoid inconsistent values across boards, updating the path daily is recommended.**
* CURRENT\_TIMESTAMP: Returns the current timestamp as a timestamp column. **These values are updated only when the path is recalculated.**
* CURRENT\_UNIX\_TIMESTAMP: Returns the current timestamp as number in seconds. **These values are updated only when the path is recalculated.**
* DATE\_ADD: Returns the date that is arg1 days after arg0 (note: arg1 must be an integer literal).
* DATE\_FORMAT: Converts a date/timestamp arg0 to a string in the format specified by arg1 (note: arg1 must be a string literal).
* DATE\_SUB: Returns the date that is arg1 days before arg0 and according to [Java SimpleDateFormat ↗](https://docs.oracle.com/javase/8/docs/api/java/text/SimpleDateFormat.html) (note: arg1 must be an integer literal).
* DATE\_TRUNC: Returns the date/timestamp arg1 truncated to the unit specified by the format arg0.
* DATE\_DIFF: Returns the number of days from arg1 to arg0.
* DAY\_OF\_MONTH: Extracts the day of the month as an integer from a given date/timestamp/string.
* DAY\_OF\_WEEK: Extracts the day of the week as an integer from a given date/timestamp/string. Ranges from 1 for a Sunday through to 7 for a Saturday.
* DAY\_OF\_YEAR: Extracts the day of the year as an integer from a given date/timestamp/string.
* FROM\_UTC\_TIMESTAMP: Given a timestamp column arg0, which corresponds to a certain time of day in UTC, returns another timestamp that corresponds to the same time of day in the given timezone arg1. (note: arg1 must be a string literal).
* HOUR: Extracts the hours as an integer from a given date/timestamp/string.
* LAST\_DAY: Given a date column, returns the last day of the month which the given date belongs to.
* MINUTE: Extracts the minutes as an integer from a given date/timestamp/string.
* MONTH: Extracts the month as an integer from a given date/timestamp/string.
* MONTHS\_BETWEEN: Returns number of months between dates arg0 and arg1.
* QUARTER: Extracts the quarter as an integer from a given date/timestamp/string.
* SECOND: Extracts the seconds as an integer from a given date/timestamp/string.
* TO\_UNIX\_TIMESTAMP: Convert time string arg0 with given pattern string arg1, return null if fail (note: arg1 must be a string literal).
* TO\_UTC\_TIMESTAMP: Given a timestamp column arg0, which corresponds to a certain time of day in the given timezone arg1, returns another timestamp that corresponds to the same time of day in UTC. (note: arg1 must be a string literal).
* WEEK\_OF\_YEAR: Extracts the [ISO week ↗](https://en.wikipedia.org/wiki/ISO_week_date) number as an integer from a given date/timestamp/string.
* YEAR: Extracts the year as an integer from a given date/timestamp/string.

### Array functions

More info and examples on Array functions is available in the [reference documentation on array functions](/docs/foundry/contour/expressions-arrays/).

* ARRAY: Creates an array of all the input columns.
* ARRAY\_CONTAINS: Returns true if the array column arg0 contains value arg1 (note: arg1 must be a literal).
* ARRAY\_GET\_AT\_INDEX: Returns the element at index arg1 (1-indexed) from array column arg0 (note: arg1 must be an integer literal). Explicitly cast the result of this function to use the column in subsequent boards.
* ARRAY\_LENGTH: Returns the length of the given array. Returns -1 when the input is `null`.
* ARRAY\_JOIN: Returns a string of the array column arg0 joined by the separator string arg1 (note: arg1 must be a string literal).
* ARRAY\_SORT: Sorts the input array arg0 in ascending order if arg1 is true, or descending order if arg1 is false (note: arg1 must be a boolean literal).

:::callout{theme="warning" title="Warning"}
When using `ROW_NUMBER`, `FIRST`, `LAST`, `ARRAY_AGG`, or `ARRAY_AGG_DISTINCT`, in a window function, be careful of nondeterminism. Imagine we are partitioning by column A and ordering by column B. If for the same value of column A, there are multiple rows with the same value of column B, the results of these window functions may be non-deterministic -- they may produce different results given the same input data and logic.
:::

### Window functions

Window functions need an OVER clause; more info and examples in the [reference documentation on window functions](/docs/foundry/contour/expressions-window-functions/).

* CUME\_DIST: Returns the cumulative distribution of values within a window partition, i.e. the fraction of rows that are below the current row.
* DENSE\_RANK: Returns the rank of rows within a window partition, without any gaps.
* EXPLODE: Creates a new row for each element in the given array column, dropping rows with nulls. Explicitly cast the result of this function to use the column in subsequent boards.
* EXPLODE\_OUTER: Creates a new row for each element in the given array column. Explicitly cast the result of this function to use the column in subsequent boards.
* FIRST: Returns the first value in a group.
* LAG: Returns the value that is arg1 rows before the current row in column arg0, and null if there are less than arg1 rows before the current row. For example, an arg1 of one will return the previous row at any given point in the window partition (note: arg1 must be an integer literal).
* LAST: Returns the last value in a group.
* LEAD: Returns the value that is arg1 rows after the current row in column arg0, and null if there are less than arg1 rows after the current row. For example, an arg1 of one will return the next row at any given point in the window partition (note: arg1 must be an integer literal).
* NTILE: Returns the ntile group id (from 1 to arg0 inclusive) in an ordered window partition. For example, if arg0 is 4, the first quarter of the rows will get value 1, the second quarter will get 2, the third quarter will get 3, and the last quarter will get 4 (note: arg0 must be an integer literal).
* PERCENT\_RANK: Returns the relative rank (i.e. percentile) of rows within a window partition.
* RANK: Returns the rank of rows within a window partition.
* ROW\_NUMBER: Returns a sequential number starting at 1 within a window partition.

### Aggregate functions

Aggregate functions can be used in aggregation expressions and window functions.

* ARRAY\_AGG: Returns an array of aggregated values from the input column.
* ARRAY\_AGG\_DISTINCT: Returns an array of distinct aggregated values from the input column.
* AVG: Returns the average of the values in a group.
* COUNT: Returns the number of items in a group.
* COUNT\_DISTINCT: Returns the number of items in a group (note: can only be used with the **Aggregate** option in the expression board. Cannot be used with **Add new column**, **Filter** or **Replace Column**).
* CORR: Returns the Pearson Correlation Coefficient for two columns.
* MAX: Returns the maximum value of the expression in a group.
* MEAN: Returns the average of the values in a group.
* MIN: Returns the minimum value of the expression in a group.
* STDDEV: Returns the sample standard deviation of the expression in a group.
* SUM: Returns the sum of all values in the expression.
* SUM\_DISTINCT: Returns the sum of distinct values in the expression (note: cannot be used in window functions).
* VARIANCE: Returns the unbiased variance of the values in a group.

### Misc functions

* COALESCE: Returns the first column that is not null, or null if all inputs are null.
* GREATEST: Returns the greatest value of the list of values, skipping null values.
* HASH: Calculates the hash code of given columns, and returns the result as an int column.
* ISNULL: Return true if, and only if, the column is null.
* LEAST: Returns the least value of the list of values, skipping null values.
* MD5: Calculates the MD5 digest of a binary column and returns the value as a 32 character hex string.
* MONOTONICALLY\_INCREASING\_ID: Returns a monotonically increasing ID. **These values may change each time the path is calculated.**
* SHA1: Calculates the SHA-1 digest of a binary column and returns the value as a 40 character hex string.
* GET\_JSON\_OBJECT: Extracts a JSON object from the JSON string based on the [JSON path ↗](https://goessner.net/articles/JsonPath/) specified, and returns a JSON string of the extracted JSON object. Some examples of this are:
  * `$.field`
  * `$['field']`
