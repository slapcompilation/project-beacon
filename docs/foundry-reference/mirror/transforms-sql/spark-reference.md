<!-- source: https://palantir.com/docs/foundry/transforms-sql/spark-reference/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Spark SQL Reference

This section covers some key differences between writing Spark SQL data transformations and other types of SQL queries. It also contains a list of the available Spark SQL functions.

:::callout{theme="success" title="Tip"}
As you’re looking for resources, keep in mind that Spark SQL is actually based on the HiveQL dialect. You can find more information online about HiveQL.
:::

## Getting started

### Basic query format

Each SQL data transformation query must create a table. The general format for your SQL query is:

```sql
CREATE TABLE _____ AS SELECT _____
```

**Do not include semicolons at the end of your statements.** Including semicolons will result in an error.

### Comment syntax

You can include comments in your SQL code like this:

```sql
-- You can create comments using
-- this syntax

/* You can also create comments using
   this syntax */
```

### Referencing datasets

To reference a dataset, provide the dataset path surrounded by back-ticks:

```sql
CREATE TABLE `/path/to/target/dataset` AS
SELECT * FROM `/path/to/source/dataset`

-- Alternative syntax

CREATE TABLE `/path/to/target/dataset` AS (
    SELECT * FROM `/path/to/source/dataset`
)
```

Note that dataset names are case-sensitive.

### Referencing columns

To reference a specific column from a dataset, provide the column name:

```sql
SELECT Name FROM `/path/to/source/dataset`
```

Note that column names are case-sensitive.

### Derived columns & aliases

A derived column is the result of calling a function on your dataset column(s). You must define an alias for any derived column:

```sql
SELECT Sum(Val) AS Total FROM `/path/to/source/dataset`
```

The following query will result in an error:

```sql
SELECT Sum(Val) FROM `/path/to/source/dataset`
```

Note that alias names are case-sensitive.

### Derived columns in SQL clauses

You cannot use an alias within the following SQL clauses: **WHERE** and **GROUP BY**. Thus, you must refer to the actual function and dataset column(s) in a **WHERE** or **GROUP BY** clause:

```sql
SELECT Lower(Name) AS LowercaseName
FROM `/path/to/source/dataset` WHERE Lower(Name) = "sara"

SELECT Lower(Name) AS LowercaseName, Sum(Val) AS Total
FROM `/path/to/source/dataset` GROUP BY Lower(Name)
```

You can use an alias within the following SQL clauses: **ORDER BY** and **HAVING**. Thus, any of the following queries will work:

```sql
-- Both of the following queries are valid

SELECT Lower(Name) AS LowercaseName, Sum(Val) AS Total
FROM `/path/to/source/dataset` GROUP BY Lower(Name) ORDER BY Total

SELECT Lower(Name) AS LowercaseName, Sum(Val) AS Total
FROM `/path/to/source/dataset` GROUP BY Lower(Name) ORDER BY Sum(Val)

-- Both of the following queries are valid

SELECT Lower(Name) AS LowercaseName, Sum(Val) AS Total
FROM `/path/to/source/dataset` GROUP BY Lower(Name) HAVING Total > 100

SELECT Lower(Name) AS LowercaseName, Sum(Val) AS Total
FROM `/path/to/source/dataset` GROUP BY Lower(Name) HAVING Sum(Val) > 100
```

### Type conversion

You can cast an expression to convert it from one type to another. The syntax for casting is:

```sql
CAST(expr AS <TYPE>)
```

Note that `expr` represents the expression you want to cast, and `<TYPE>` represents what you type you want to convert your expression to. If ``CAST(expr` `AS` `<TYPE>)`` does not succeed, it will return null. The available values for `<TYPE>` are:

* boolean
* tinyint
* smallint
* int
* bigint
* float
* double
* decimal
* date
* timestamp
* binary
* string

### Formatting dates

You may want to reformat your date values or convert your strings into date format. A `date` has the form yyyy-MM-dd and doesn't have a time component. You can use the `CAST` function along with the available [datetime functions](#datetime-functions) to convert strings to dates. Here are some quick examples:

```sql
-- Convert a string with the format 'yyyy-MM-dd' to a date
CAST('2016-07-30' AS DATE)

-- Convert a string with the format 'yyyy-MM-dd' to a timestamp (the timestamp will be based on midnight of the date provided)
CAST('2016-07-30' AS TIMESTAMP)

-- Convert a date string with the format 'ddMMyyyy' to a date
TO_DATE(CAST(UNIX_TIMESTAMP('07302016', 'MMddyyyy') AS TIMESTAMP))

-- Convert a timestamp string with the format 'ddMMyyyy HH:mm:ss' to just a date
CAST('2016-07-30 11:29:27' AS DATE)

-- Extract just the date from an ISO 8601 timestamp
TO_DATE('2016-07-30T11:29:27.000+00:00')

-- Extract just the date from a timestamp with the format 'yyyy-MM-dd HH:mm:ss'
TO_DATE('2016-07-30 11:29:27')
```

Note that you cannot cast a string as a date if the string is not formatted as a date/timestamp. Thus, something like `CAST('20160730' AS DATE)` will return null.

## Aggregate functions

|Function	|Description	|
|---	|---	|
|[APPROX\_COUNT\_DISTINCT](#approx_count_distinct)	|Returns the approximate number of distinct items in a group.	|
|[AVG](#avg)	|Returns the average of the values in a group.	|
|[COLLECT\_LIST](#collect_list)	|Returns a list of objects with duplicates.	|
|[COLLECT\_SET](#collect_set)	|Returns a set of objects with duplicate elements eliminated.	|
|[CORR](#corr)	|Returns the Pearson Correlation Coefficient for two columns.	|
|[COUNT](#count)	|Returns the number of items in a group.	|
|[COVAR\_POP](#covar_pop)	|Returns the population covariance for two columns.	|
|[COVAR\_SAMP](#covar_samp)	|Returns the sample covariance for two columns.	|
|[FIRST](#first)	|Returns the first value in a group.	|
|[GROUPING](#grouping)	|Indicates whether a specified column in a GROUP BY list is aggregated or not.	|
|[KURTOSIS](#kurtosis)	|Returns the kurtosis of the values in a group.	|
|[LAST](#last)	|Returns the last value in a group.	|
|[MAX](#max)	|Returns the maximum value of the expression in a group.	|
|[MEAN](#mean)	|Returns the average of the values in a group.	|
|[MIN](#min)	|Returns the minimum value of the expression in a group.	|
|[SKEWNESS](#skewness)	|Returns the skewness of the values in a group.	|
|[STDDEV](#stddev)	|Alias for stddev\_samp.	|
|[STDDEV\_POP](#stddev_pop)	|Returns the population standard deviation of the expression in a group.	|
|[STDDEV\_SAMP](#stddev_samp)	|Returns the sample standard deviation of the expression in a group.	|
|[SUM](#sum)	|Returns the sum of all values in the expression.	|
|[VARIANCE](#variance)	|Returns the unbiased variance of the values in a group.	|
|[VAR\_POP](#var_pop)	|Returns the population variance of the values in a group.	|
|[VAR\_SAMP](#var_samp)	|Returns the unbiased variance of the values in a group.	|

### `APPROX_COUNT_DISTINCT`

**Description:**
Aggregate function: returns the approximate number of distinct items in a group. The max estimation error allowed defaults to 0.05, unless `rsd` is provided.

**Signature:**

```sql
APPROXCOUNTDISTINCT(Column e)
APPROXCOUNTDISTINCT(Column e, double rsd)
```

### `AVG`

**Description:**
Aggregate function: returns the average of the values in a group.

**Signature:**

```sql
AVG(Column e)
```

### `COLLECT_LIST`

**Description:**
Aggregate function: returns a list of objects with duplicates.

**Signature:**

```sql
COLLECT_LIST(Column e)
```

### `COLLECT_SET`

**Description:**
Aggregate function: returns a set of objects with duplicate elements eliminated.

**Signature:**

```sql
COLLECT_SET(Column e)
```

### `CORR`

**Description:**
Aggregate function: returns the Pearson Correlation Coefficient for two columns.

**Signature:**

```sql
CORR(Column column1, Column column2)
```

### `COUNT`

**Description:**
Aggregate function: returns the number of items in a group.

**Signature:**

```sql
COUNT(Column e)
```

### `COVAR_POP`

**Description:**
Aggregate function: returns the population covariance for two columns.
**Signature:**

```sql
COVAR_POP(Column column1, Column column2)
```

### `COVAR_SAMP`

**Description:**
Aggregate function: returns the sample covariance for two columns.

**Signature:**

```sql
COVAR_SAMP(Column column1, Column column2)
```

### `FIRST`

**Description:**
Aggregate function: returns the first value in a group. By default, returns the first value it sees. If `ignoreNulls` is set to true, it will return the first non-null value it sees. If all values are null, it returns null.

**Signature:**

```sql
FIRST(Column e)FIRST(Column e, boolean ignoreNulls)
```

### `GROUPING`

**Description:**
Aggregate function: indicates whether a specified column in a GROUP BY list is aggregated or not. Returns 1 for aggregated or 0 for not aggregated in the result set.

**Signature:**

```sql
GROUPING(Column e)
```

### `KURTOSIS`

**Description:**
Aggregate function: returns the kurtosis of the values in a group.

**Signature:**

```sql
KURTOSIS(Column e)
```

### `LAST`

**Description:**
Aggregate function: returns the last value in a group. By default, returns the last value it sees. If `ignoreNulls` is set to true, it will return the last non-null value it sees. If all values are null, it returns null.

**Signature:**

```sql
LAST(Column e)LAST(Column e, boolean ignoreNulls)
```

### `MAX`

**Description:**
Aggregate function: returns the maximum value of the expression in a group.

**Signature:**

```sql
MAX(Column e)
```

### `MEAN`

**Description:**
Aggregate function: returns the average of the values in a group.

**Signature:**

```sql
MEAN(Column e)
```

### `MIN`

**Description:**
Aggregate function: returns the minimum value of the expression in a group.

**Signature:**

```sql
MIN(Column e)
```

### `SKEWNESS`

**Description:**
Aggregate function: returns the skewness of the values in a group.

**Signature:**

```sql
SKEWNESS(Column e)
```

### `STDDEV`

**Description:**
Aggregate function: alias for stddev\_samp.

**Signature:**

```sql
STDDEV(Column e)
```

### `STDDEV_POP`

**Description:**
Aggregate function: returns the population standard deviation of the expression in a group.

**Signature:**

```sql
STDDEV_POP(Column e)
```

### `STDDEV_SAMP`

**Description:**
Aggregate function: returns the sample standard deviation of the expression in a group.

**Signature:**

```sql
STDDEV_SAMP(Column e)
```

### `SUM`

**Description:**
Aggregate function: returns the sum of all values in the expression.

**Signature:**

```sql
SUM(Column e)
```

### `VARIANCE`

**Description:**
Aggregate function: returns the unbiased variance of the values in a group. Alias for the [VAR\_SAMP](#var_samp) function.

**Signature:**

```sql
VARIANCE(Column e)
```

### `VAR_POP`

**Description:**
Aggregate function: returns the population variance of the values in a group.

**Signature:**

```sql
VAR_POP(Column e)
```

### `VAR_SAMP`

**Description:**
Aggregate function: returns the unbiased variance of the values in a group.

**Signature:**

```sql
VAR_SAMP(Column e)
```

## String functions

|Function	|Description	|
|---	|---	|
|[ASCII](#ascii)	|Computes the numeric value of the first character of the string column, and returns the result as an int column.	|
|[BASE64](#base64)	|Computes the BASE64 encoding of a binary column and returns it as a string column.	|
|[CONCAT](#concat)	|Concatenates multiple input string columns together into a single string column.	|
|[DECODE](#decode)	|Computes the first argument into a string from a binary using the provided character set.	|
|[ENCODE](#encode)	|Computes the first argument into a binary from a string using the provided character set.	|
|[FORMAT\_NUMBER](#format_number)	|Formats numeric column to a format like ‘#,###,###.##’ that’s rounded to `d` decimal places.	|
|[GET\_JSON\_OBJECT](#get_json_object)	|Extracts json object from a json string based on json path specified, and returns json string of the extracted json object.	|
|[INSTR](#instr)	|Locate the position of the first occurrence of substring in the given string column.	|
|[JSON\_TUPLE](#json_tuple)	|Creates a new row for a json column according to the given field names.	|
|[LENGTH](#length)	|Computes the length of a given string or binary column.	|
|[LEVENSHTEIN](#levenshtein)	|Computes the Levenshtein distance of the two given string columns.	|
|[LOWER](#lower)	|Converts a string column to lower case.	|
|[LPAD](#lpad)	|Left pad the string column with pad to a length of len.	|
|[LTRIM](#ltrim)	|Trim the spaces from left end for the specified string value.	|
|[REGEXP\_EXTRACT](#regexp_extract)	|Extract a specific group matched by a Java regex, from the specified string column.	|
|[REGEXP\_REPLACE](#regexp_replace)	|Replace all substrings of the specified string value that match regexp with rep.	|
|[REPEAT](#repeat)	|Repeats a string column n times, and returns it as a new string column.	|
|[REVERSE](#reverse)	|Reverses the string column and returns it as a new string column.	|
|[RPAD](#rpad)	|Right pad the string column with pad to a length of len.	|
|[RTRIM](#rtrim)	|Trim the spaces from right end for the specified string value.	|
|[SOUNDEX](#soundex)	|Return the soundex code for the specified expression.	|
|[SPLIT](#split)	|Splits str around pattern (pattern is a regular expression).	|
|[SUBSTRING](#substring)	|Returns a substring for the string or binary type column.	|
|[SUBSTRING\_INDEX](#substring_index)	|Returns the substring from the string before count occurrences of the delimiter.	|
|[TRANSLATE](#translate)	|Translate any character in the src by a character in replaceString.	|
|[TRIM](#trim)	|Trim the spaces from both ends for the specified string column.	|
|[UNBASE64](#unbase64)	|Decodes a BASE64 encoded string column and returns it as a binary column.	|
|[UNHEX](#unhex)	|Inverse of hex.	|
|[UPPER](#upper)	|Converts a string column to upper case.	|

### `ASCII`

**Description:**
Computes the numeric value of the first character of the string column, and returns the result as an int column.

**Signature:**

```sql
ASCII(Column e)
```

### `BASE64`

**Description:**
Computes the BASE64 encoding of a binary column and returns it as a string column.

**Signature:**

```sql
BASE64(Column e)
```

### `CONCAT`

**Description:**
Concatenates multiple input string columns together into a single string column.

**Signature:**

```sql
CONCAT(Column... exprs)
```

### `DECODE`

**Description:**
Computes the first argument into a string from a binary using the provided `charset`, which is one of the following:

* ‘US-ASCII’
* ‘ISO-8859-1’
* ‘UTF-8’
* ‘UTF-16BE’
* ‘UTF-16LE’
* ‘UTF-16’

If either argument is null, the result will also be null.

**Signature:**

```sql
DECODE(Column value, String charset)
```

### `ENCODE`

**Description:**
Computes the first argument into a binary from a string using the provided `charset`, which is one of the following:

* ‘US-ASCII’
* ‘ISO-8859-1’
* ‘UTF-8’
* ‘UTF-16BE’
* ‘UTF-16LE’
* ‘UTF-16’

If either argument is null, the result will also be null.

**Signature:**

```sql
ENCODE(Column value, String charset)
```

### `FORMAT_NUMBER`

**Description:**
Formats numeric column `x` to a format like ‘#,###,###.##’ that’s rounded to `d` decimal places with HALF\_EVEN round mode (also known as Gaussian rounding or bankers’ rounding). Returns the result as a string column. If `d` is 0, the result has no decimal point or fractional part. If `d` is less than 0, the result will be null.

**Signature:**

```sql
FORMAT_NUMBER(Column x, int d)
```

### `GET_JSON_OBJECT`

**Description:**
Extracts json object from a json string based on json `path` specified, and returns json string of the extracted json object. Returns null if the input json string is invalid.

**Signature:**

```sql
GET_JSON_OBJECT(Column e, String path)
```

### `INSTR`

**Description:**
Locate the position of the first occurrence of `substring` in the given string column. Returns null if either of the arguments are null, and returns 0 if `substring` could not be found in `str`.
The resulting position is 1 based index, not zero based.

**Signature:**

```sql
INSTR(Column str, String substring)
```

### `JSON_TUPLE`

**Description:**
Creates a new row for a json column according to the given field names.

**Signature:**

```sql
JSON_TUPLE(Column json, scala.collection.Seq<String> fields)
JSON_TUPLE(Column json, String... fields)
```

### `LENGTH`

**Description:**
Computes the length of a given string or binary column.

**Signature:**

```sql
LENGTH(Column e)
```

### `LEVENSHTEIN`

**Description:**
Computes the Levenshtein distance of the two given string columns.

**Signature:**

```sql
LEVENSHTEIN(Column l, Column r)
```

### `LOWER`

**Description:**
Converts a string column to lower case.

**Signature:**

```sql
LOWER(Column e)
```

### `LPAD`

**Description:**
Left pad the string column with `pad` to a length of `len`.

**Signature:**

```sql
LPAD(Column str, int len, String pad)
```

### `LTRIM`

**Description:**
Trim the spaces from left end for the specified string value.

**Signature:**

```sql
LTRIM(Column e)
```

### `REGEXP_EXTRACT`

**Description:**
Extract a specific group (`groupIdx`) matched by a Java regex (`exp`), from the specified string column. If the regex did not match, or the specified group did not match, an empty string is returned.

**Signature:**

```sql
REGEXP_EXTRACT(Column e, String exp, int groupIdx)
```

### `REGEXP_REPLACE`

**Description:**
Replace all substrings of the specified string value that match the Java regex `pattern` with `replacement`.

**Signature:**

```sql
REGEXP_REPLACE(Column e, String pattern, String replacement)
```

### `REPEAT`

**Description:**
Repeats a string column `n` times, and returns it as a new string column.

**Signature:**

```sql
REPEAT(Column str, int n)
```

### `REVERSE`

**Description:**
Reverses the string column and returns it as a new string column.

**Signature:**

```sql
REVERSE(Column str)
```

### `RPAD`

**Description:**
Right pad the string column with `pad` to a length of `len`.

**Signature:**

```sql
RPAD(Column str, int len, String pad)
```

### `RTRIM`

**Description:**
Trim the spaces from right end for the specified string value.

**Signature:**

```sql
RTRIM(Column e)
```

### `SOUNDEX`

**Description:**
Return the soundex code for the specified expression.

**Signature:**

```sql
SOUNDEX(Column e)
```

### `SPLIT`

**Description:**
Splits `str` around `pattern` where `pattern` is a regular expression.

**Signature:**

```sql
SPLIT(Column str, String pattern)
```

### `SUBSTRING`

**Description:**
Returns the substring starting at `pos` with a length of `len` when `str` is String type. Returns the slice of byte array that starts at `pos` in byte and is of length `len` when str is Binary type.

**Signature:**

```sql
SUBSTRING(Column str, int pos, int len)
```

### `SUBSTRING_INDEX`

**Description:**
Returns the substring from string `str` before `count` occurrences of the delimiter `delim`. Performs a case-sensitive match when searching for `delim`. If `count` is positive, everything to the left of the final delimiter (counting from the left) is returned. If count is negative, everything to the right of the final delimiter (counting from the right) is returned.

**Signature:**

```sql
SUBSTRING_INDEX(Column str, String delim, int count)
```

### `TRANSLATE`

**Description:**
Translate any character in the `src` by a character in `replaceString`. The characters in `replaceString` correspond to the characters in `matchingString`. The translate will happen when any character in the string matches the character in the `matchingString`.

**Signature:**

```sql
TRANSLATE(Column src, String matchingString, String replaceString)
```

### `TRIM`

**Description:**
Trim the spaces from both ends for the specified string column.

**Signature:**

```sql
TRIM(Column e)
```

### `UNBASE64`

**Description:**
Decodes a BASE64 encoded string column and returns it as a binary column.

**Signature:**

```sql
UNBASE64(Column e)
```

### `UNHEX`

**Description:**
Inverse of hex. Interprets each pair of characters as a hexadecimal number and converts to the byte representation of the number.

**Signature:**

```sql
UNHEX(Column column)
```

### `UPPER`

**Description:**
Converts a string column to upper case.

**Signature:**

```sql
UPPER(Column e)
```

## Datetime functions

|Function	|Description	|
|---	|---	|
|[ADD\_MONTHS](#add_months)	|Returns the date that is numMonths after startDate.	|
|[DATEDIFF](#datediff)	|Returns the number of days from start to end.	|
|[DATE\_ADD](#date_add)	|Returns the date that is days days after start.	|
|[DATE\_FORMAT](#date_format)	|Converts a date/timestamp/string to a value of string in the format specified by the date format.	|
|[DATE\_SUB](#date_sub)	|Returns the date that is days days before start.	|
|[DAYOFMONTH](#dayofmonth)	|Extracts the day of the month as an integer from a given date/timestamp/string.	|
|[DAYOFYEAR](#dayofyear)	|Extracts the day of the year as an integer from a given date/timestamp/string.	|
|[FROM\_UNIXTIME](#from_unixtime)	|Converts the number of seconds from unix epoch to a string representing the timestamp of that moment in the current system time zone in the given format.	|
|[FROM\_UTC\_TIMESTAMP](#from_utc_timestamp)	|Assumes given timestamp is UTC and converts to given timezone.	|
|[HOUR](#hour)	|Extracts the hours as an integer from a given date/timestamp/string.	|
|[LAST\_DAY](#last_day)	|Given a date column, returns the last day of the month which the given date belongs to.	|
|[MINUTE](#minute)	|Extracts the minutes as an integer from a given date/timestamp/string.	|
|[MONTH](#month)	|Extracts the month as an integer from a given date/timestamp/string.	|
|[MONTHS\_BETWEEN](#months_between)	|Returns number of months between dates date1 and date2.	|
|[NEXT\_DAY](#next_day)	|Given a date column, returns the first date which is later than the value of the date column that is on the specified day of the week.	|
|[QUARTER](#quarter)	|Extracts the quarter as an integer from a given date/timestamp/string.	|
|[SECOND](#second)	|Extracts the seconds as an integer from a given date/timestamp/string.	|
|[TO\_DATE](#to_date)	|Converts the column into type date.	|
|[TO\_UTC\_TIMESTAMP](#to_utc_timestamp)	|Assumes given timestamp is in given timezone and converts to UTC.	|
|[TRUNC](#trunc)	|Returns date truncated to the unit specified by the format.	|
|[UNIX\_TIMESTAMP](#unix_timestamp)	|Converts time string in format yyyy-MM-dd HH\:mm:ss to Unix timestamp (in seconds), using the default timezone and the default locale.	|
|[WEEKOFYEAR](#weekofyear)	|Extracts the week number as an integer from a given date/timestamp/string.	|
|[WINDOW](#window)	|Generates tumbling or sliding time windows given a timestamp specifying column.	|
|[YEAR](#year)	|Extracts the year as an integer from a given date/timestamp/string.	|

### `ADD_MONTHS`

**Description:**
Returns the date that is `numMonths` after the date/timestamp/string specified by `startDate`. If `startDate` is a string, it must be in the format ‘yyyy-MM-dd’ or ‘yyyy-MM-dd HH\:mm:ss’.

If `startDate` has a time component, it’s ignored. The resulting month has the same day component as that of `startDate`. If `startDate` is the last day of the month or if the resulting month has fewer days than the day component of `startDate`, the last day of the resulting month is returned.

**Signature:**

```sql
ADD_MONTHS(Column startDate, int numMonths)
```

### `DATEDIFF`

**Description:**
Returns the number of days from `start` to `end`.

**Signature:**

```sql
DATEDIFF(Column end, Column start)
```

### `DATE_ADD`

**Description:**
Returns the date that is `days` days after `start`.

**Signature:**

```sql
DATE_ADD(Column start, int days)
```

### `DATE_FORMAT`

**Description:**
Converts a date/timestamp/string to a value of string in the format specified by the date `format`. If `dateExpr` is a string, it must be in the format ‘yyyy-MM-dd’ or ‘yyyy-MM-dd HH\:mm:ss’.

For the pattern string `format`, pattern letters of SimpleDateFormat can be used. Refer to the [Java SimpleDateFormat docs ↗](https://docs.oracle.com/javase/tutorial/i18n/format/simpleDateFormat.html) for more information.

**Signature:**

```sql
DATE_FORMAT(Column dateExpr, String format)
```

### `DATE_SUB`

**Description:**
Returns the date that is `days` days before `start`.

**Signature:**

```sql
DATE_SUB(Column start, int days)
```

### `DAYOFMONTH`

**Description:**
Extracts the day of the month as an integer from a given date/timestamp/string. Strings must be in the format ‘yyyy-MM-dd’ or ‘yyyy-MM-dd HH\:mm:ss’.

**Signature:**

```sql
DAYOFMONTH(Column e)
```

### `DAYOFYEAR`

**Description:**
Extracts the day of the year as an integer from a given date/timestamp/string. Strings must be in the format ‘yyyy-MM-dd’ or ‘yyyy-MM-dd HH\:mm:ss’.

**Signature:**

```sql
DAYOFYEAR(Column e)
```

### `FROM_UNIXTIME`

**Description:**
Converts the number of seconds from unix epoch (1970-01-01 00:00:00 UTC) to a string representing the timestamp of that moment in the current system time zone in the given format.
If no pattern string `f` is provided, the default format for the resulting string is yyyy-MM-dd HH\:mm:ss. To change the format of the resulting string, provide a pattern string `f`. Pattern letters of SimpleDateFormat can be used for the pattern string. Refer to the [Java SimpleDateFormat docs ↗](https://docs.oracle.com/javase/tutorial/i18n/format/simpleDateFormat.html) for more information.

**Signature:**

```sql
FROM_UNIXTIME(Column ut)FROM_UNIXTIME(Column ut, String f)
```

### `FROM_UTC_TIMESTAMP`

**Description:**
Assumes given timestamp is UTC and converts it to given the timezone specified by `tz`.
Given a timestamp (which corresponds to a certain time of day in UTC), returns another timestamp that corresponds to the same time of day in the given timezone specified by `tz`.

**Signature:**

```sql
FROM_UTC_TIMESTAMP(Column ts, String tz)
```

### `HOUR`

**Description:**
Extracts the hours as an integer from a given date/timestamp/string. Strings must be in the format ‘yyyy-MM-dd’ or ‘yyyy-MM-dd HH\:mm:ss’.

**Signature:**

```sql
HOUR(Column e)
```

### `LAST_DAY`

**Description:**
Given a date column, returns the last day of the month which the given date belongs to.

**Signature:**

```sql
LAST_DAY(Column e)
```

### `MINUTE`

**Description:**
Extracts the minutes as an integer from a given date/timestamp/string. Strings must be in the format ‘yyyy-MM-dd’ or ‘yyyy-MM-dd HH\:mm:ss’.

**Signature:**

```sql
MINUTE(Column e)
```

### `MONTH`

**Description:**
Extracts the month as an integer from a given date/timestamp/string. Strings must be in the format ‘yyyy-MM-dd’ or ‘yyyy-MM-dd HH\:mm:ss’.

**Signature:**

```sql
MONTH(Column e)
```

### `MONTHS_BETWEEN`

**Description:**
Returns number of months between dates `date1` and `date2`.
If `date1` is later than `date2`, the result is positive. If `date1` is earlier than `date2`, the result is negative. If the two dates are the same days of the months or both the last days of months, the result is an integer. Otherwise, the result is rounded to 8 decimal places.

**Signature:**

```sql
MONTHS_BETWEEN(Column date1, Column date2)
```

### `NEXT_DAY`

**Description:**
Given a `date` column, returns the first date which is later than the value of the date column that is on the specified `dayOfWeek`. The `dayOfWeek` parameter is case insensitive and can be one of the following:

* ‘Mon’
* ‘Tue’
* ‘Wed’
* ‘Thu’
* ‘Fri’
* ‘Sat’
* ‘Sun’

**Signature:**

```sql
NEXT_DAY(Column date, String dayOfWeek)
```

### `QUARTER`

**Description:**
Extracts the quarter as an integer from a given date/timestamp/string. Strings must be in the format ‘yyyy-MM-dd’ or ‘yyyy-MM-dd HH\:mm:ss’. The resulting quarter is in the range 1 to 4.

**Signature:**

```sql
QUARTER(Column e)
```

### `SECOND`

**Description:**
Extracts the seconds as an integer from a given date/timestamp/string. Strings must be in the format ‘yyyy-MM-dd’ or ‘yyyy-MM-dd HH\:mm:ss’.

**Signature:**

```sql
SECOND(Column e)
```

### `TO_DATE`

**Description:**
Converts the column into type date.

**Signature:**

```sql
TO_DATE(Column e)
```

### `TO_UTC_TIMESTAMP`

**Description:**
Assumes the provided timestamp (`ts`) is in the provided timezone (`tz`) and converts to UTC.

**Signature:**

```sql
TO_UTC_TIMESTAMP(Column ts, String tz)
```

### `TRUNC`

**Description:**
Returns date truncated to the unit specified by the `format`. The `format` parameter is ‘year’, ‘yyyy’, ‘yy’ for truncating by year, or ‘month’, ‘mon’, ‘mm’ for truncating by month.

**Signature:**

```sql
TRUNC(Column date, String format)
```

### `UNIX_TIMESTAMP`

**Description:**
Converts time string to Unix timestamp (in seconds) using the default timezone and the default locale. Returns null if it fails to convert the string to a timestamp.

If no pattern string is provided, the default format for the input column `s` is yyyy-MM-dd HH\:mm:ss. If the input column is in a different format, provide a pattern string `p`. Pattern letters of SimpleDateFormat can be used for the pattern string. Refer to the [Java SimpleDateFormat docs ↗](https://docs.oracle.com/javase/tutorial/i18n/format/simpleDateFormat.html) for more information.

**Signature:**

```sql
UNIX_TIMESTAMP(Column s)UNIX_TIMESTAMP(Column s, String p)
```

### `WEEKOFYEAR`

**Description:**
Extracts the week number as an integer from a given date/timestamp/string. Strings must be in the format ‘yyyy-MM-dd’ or ‘yyyy-MM-dd HH\:mm:ss’.

**Signature:**

```sql
WEEKOFYEAR(Column e)
```

### `WINDOW`

**Description:**
Generates tumbling or sliding time windows given a timestamp specifying column. If `slideDuration`is not provided, generates tumbling time windows. If `slideDuration` is provided, generate sliding time windows by bucketizing rows into one or more time windows.

Window starts are inclusive and window ends are exclusive, so 12:05 will be in the window \[12:05,12:10) but not in \[12:00,12:05). Windows can support microsecond precision. Windows in the order of months are not supported.

The windows start beginning at 1970-01-01 00:00:00 UTC, unless `startTime` is provided.
This function accepts the following parameters:

* `timeColumn`: The column to use as the timestamp for windowing by time. The time column must be of TimestampType.
* `windowDuration`: A string specifying the width of the window, e.g. 10 minutes, 1 second. Note that the duration is a fixed length of time, and does not vary over time according to a calendar.
* `slideDuration`: A string specifying the sliding interval of the window, e.g. 1 minute. A new window will be generated every slideDuration. Must be less than or equal to the `windowDuration`. This duration is likewise absolute, and does not vary according to a calendar.
* `startTime`: The offset with respect to 1970-01-01 00:00:00 UTC with which to start window intervals. For example, in order to have hourly tumbling windows that start 15 minutes past the hour (e.g. 12:15-13:15, 13:15-14:15…) provide `startTime` as 15 minutes.

**Signature:**

```sql
WINDOW(Column timeColumn, String windowDuration)WINDOW(Column timeColumn, String windowDuration, String slideDuration)WINDOW(Column timeColumn, String windowDuration, String slideDuration, String startTime)
```

### `YEAR`

**Description:**
Extracts the year as an integer from a given date/timestamp/string. Strings must be in the format ‘yyyy-MM-dd’ or ‘yyyy-MM-dd HH\:mm:ss’.

**Signature:**

```sql
YEAR(Column e)
```

## Math functions

|Function	|Description	|
|---	|---	|
|[ABS](#abs)	|Computes the absolute value.	|
|[ACOS](#acos)	|Computes the cosine inverse of the given value.	|
|[ASIN](#asin)	|Computes the sine inverse of the given value.	|
|[ATAN](#atan)	|Computes the tangent inverse of the given value.	|
|[ATAN2](#atan2)	|Returns the angle theta from the conversion of rectangular coordinates (x, y) to polar coordinates (r, theta).	|
|[BIN](#bin)	|Returns the string representation of the binary value of the given long column.	|
|[BROUND](#bround)	|Returns the rounded value of the column e.	|
|[CBRT](#cbrt)	|Computes the cube-root of the given value.	|
|[CEIL](#ceil)	|Computes the ceiling of the given value.	|
|[CONV](#conv)	|Convert a number in a string column from one base to another.	|
|[COS](#cos)	|Computes the cosine of the given value.	|
|[COSH](#cosh)	|Computes the hyperbolic cosine of the given value.	|
|[EXP](#exp)	|Computes the exponential of the given value.	|
|[EXPM1](#expm1)	|Computes the exponential of the given value minus one.	|
|[FACTORIAL](#factorial)	|Computes the factorial of the given value.	|
|[FLOOR](#floor)	|Computes the floor of the given value.	|
|[HYPOT](#hypot)	|Computes sqrt(a^2^ + b^2^) without intermediate overflow or underflow.	|
|[LOG](#log)	|Computes the natural logarithm of the given value.	|
|[LOG10](#log10)	|Computes the logarithm of the given value in base 10.	|
|[LOG1P](#log1p)	|Computes the natural logarithm of the given value plus one.	|
|[LOG2](#log2)	|Computes the logarithm of the given column in base 2.	|
|[NEGATIVE](#negative)	|Unary minus.	|
|[PMOD](#pmod)	|Returns the positive value of dividend mod divisor.	|
|[POW](#pow)	|Returns the value of the first argument raised to the power of the second argument.	|
|[RINT](#rint)	|Returns the double value that is closest in value to the argument and is equal to a mathematical integer.	|
|[ROUND](#round)	|Returns the value of the column e rounded to 0 decimal places.	|
|[SHIFTLEFT](#shiftleft)	|Shift the given value numBits left.	|
|[SHIFTRIGHT](#shiftright)	|Shift the given value numBits right.	|
|[SHIFTRIGHTUNSIGNED](#shiftrightunsigned)	|Unsigned shift the given value numBits right.	|
|[SIGNUM](#signum)	|Computes the signum of the given value.	|
|[SIN](#sin)	|Computes the sine of the given value.	|
|[SINH](#sinh)	|Computes the hyperbolic sine of the given value.	|
|[SQRT](#sqrt)	|Computes the square root of the specified float value.	|
|[TAN](#tan)	|Computes the tangent of the given value.	|
|[TANH](#tanh)	|Computes the hyperbolic tangent of the given value.	|
|[TODEGREES](#todegrees)	|Converts an angle measured in radians to an approximately equivalent angle measured in degrees.	|
|[TORADIANS](#toradians)	|Converts an angle measured in degrees to an approximately equivalent angle measured in radians.	|

### `ABS`

**Description:**
Computes the absolute value.

**Signature:**

```sql
ABS(Column e)
```

### `ACOS`

**Description:**
Computes the cosine inverse of the given value. The returned angle is in the range 0.0 through pi.

**Signature:**

```sql
ACOS(Column e)
```

### `ASIN`

**Description:**
Computes the sine inverse of the given value. The returned angle is in the range -pi/2 through pi/2.

**Signature:**

```sql
ASIN(Column e)
```

### `ATAN`

**Description:**
Computes the tangent inverse of the given value.

**Signature:**

```sql
ATAN(Column e)
```

### `ATAN2`

**Description:**
Returns the angle theta from the conversion of rectangular coordinates (x, y) to polar coordinates (r, theta).

**Signature:**

```sql
ATAN2(Column l, Column r)ATAN2(Column l, double r)ATAN2(Column l, String rightName)
```

### `BIN`

**Description:**
Returns the string representation of the binary value of the given long column.

**Signature:**

```sql
BIN(Column e)
```

### `BROUND`

**Description:**
When just the column `e` is provided, returns the value of the column `e` rounded to 0 decimal places with HALF\_EVEN round mode. This is also known as Gaussian rounding or bankers’ rounding.

When `scale` is also provided, returns the value of the column `e` rounded to `scale` decimal places (with HALF\_EVEN round mode if scale >= 0 or at integral part when scale < 0).

**Signature:**

```sql
BROUND(Column e)BROUND(Column e, int scale)
```

### `CBRT`

**Description:**
Computes the cube-root of the given value.

**Signature:**

```sql
CBRT(Column e)
```

### `CEIL`

**Description:**
Computes the ceiling of the given value.

**Signature:**

```sql
CEIL(Column e)
```

### `CONV`

**Description:**
Convert a number in a string column from one base to another.

**Signature:**

```sql
CONV(Column num, int fromBase, int toBase)
```

### `COS`

**Description:**
Computes the cosine of the given value.

**Signature:**

```sql
COS(Column e)
```

### `COSH`

**Description:**
Computes the hyperbolic cosine of the given value.

**Signature:**

```sql
COSH(Column e)
```

### `EXP`

**Description:**
Computes the exponential of the given value.

**Signature:**

```sql
EXP(Column e)
```

### `EXPM1`

**Description:**
Computes the exponential of the given value minus one.

**Signature:**

```sql
EXPM1(Column e)
```

### `FACTORIAL`

**Description:**
Computes the factorial of the given value.

**Signature:**

```sql
FACTORIAL(Column e)
```

### `FLOOR`

**Description:**
Computes the floor of the given value.

**Signature:**

```sql
FLOOR(Column e)
```

### `HYPOT`

**Description:**
Computes sqrt(a^2^ + b^2^) without intermediate overflow or underflow.

**Signature:**

```sql
HYPOT(Column l, Column r)HYPOT(Column l, double r)HYPOT(Column l, String rightName)
```

### `LOG`

**Description:**
Computes the natural logarithm of the given value.

**Signature:**

```sql
LOG(Column e)
```

### `LOG10`

**Description:**
Computes the logarithm of the given value in base 10.

**Signature:**

```sql
LOG10(Column e)
```

### `LOG1P`

**Description:**
Computes the natural logarithm of the given value plus one.

**Signature:**

```sql
LOG1P(Column e)
```

### `LOG2`

**Description:**
Computes the logarithm of the given column in base 2.

**Signature:**

```sql
LOG2(Column expr)
```

### `NEGATIVE`

**Description:**
Unary minus (negate the expression).

**Signature:**

```sql
NEGATIVE(Column e)
```

### `PMOD`

**Description:**
Returns the positive value of `dividend` mod `divisor`.

**Signature:**

```sql
PMOD(Column dividend, Column divisor)
```

### `POW`

**Description:**
Returns the value of the first argument raised to the power of the second argument.

**Signature:**

```sql
POW(Column l, Column r)POW(Column l, double r)POW(Column l, String rightName)
```

### `RINT`

**Description:**
Returns the double value that is closest in value to the argument and is equal to a mathematical integer.

**Signature:**

```sql
RINT(Column e)
```

### `ROUND`

**Description:**
Returns the value of the column `e` rounded to 0 decimal places.

**Signature:**

```sql
ROUND(Column e)ROUND(Column e, int scale)
```

### `SHIFTLEFT`

**Description:**
Shift the given value `numBits` left.

**Signature:**

```sql
SHIFTLEFT(Column e, int numBits)
```

### `SHIFTRIGHT`

**Description:**
Shift the given value `numBits` right.

**Signature:**

```sql
SHIFTRIGHT(Column e, int numBits)
```

### `SHIFTRIGHTUNSIGNED`

**Description:**
Unsigned shift the given value `numBits` right.

**Signature:**

```sql
SHIFTRIGHTUNSIGNED(Column e, int numBits)
```

### `SIGNUM`

**Description:**
Computes the signum of the given value.

**Signature:**

```sql
SIGNUM(Column e)
```

### `SIN`

**Description:**
Computes the sine of the given value.

**Signature:**

```sql
SIN(Column e)
```

### `SINH`

**Description:**
Computes the hyperbolic sine of the given value.

**Signature:**

```sql
SINH(Column e)
```

### `SQRT`

**Description:**
Computes the square root of the specified float value.

**Signature:**

```sql
SQRT(Column e)
```

### `TAN`

**Description:**
Computes the tangent of the given value.

**Signature:**

```sql
TAN(Column e)
```

### `TANH`

**Description:**
Computes the hyperbolic tangent of the given value.

**Signature:**

```sql
TANH(Column e)
```

### `TODEGREES`

**Description:**
Converts an angle measured in radians to an approximately equivalent angle measured in degrees.

**Signature:**

```sql
TODEGREES(Column e)
```

### `TORADIANS`

**Description:**
Converts an angle measured in degrees to an approximately equivalent angle measured in radians.

**Signature:**

```sql
TORADIANS(Column e)
```

## Null functions

|Function	|Description	|
|---	|---	|
|[COALESCE](#coalesce)	|Returns the first column that is not null, or null if all inputs are null.	|
|[ISNULL](#isnull)	|Return true iff the column is null.	|
|[NULLIF](#nullif)	|Returns null if both arguments are equal, otherwise returns the first argument. |

### `COALESCE`

**Description:**
Returns the first column that is not null, or null if all inputs are null.

**Signature:**

```sql
COALESCE(Column... e)
```

### `ISNULL`

**Description:**
Return true iff the column is null.

**Signature:**

```sql
ISNULL(Column e)
```

### `NULLIF`

**Description:**
Returns null if both arguments are equal, otherwise returns the first argument.

**Signature:**

```sql
NULLIF(Column l, Column r)
```

## Collection functions

|Function	|Description	|
|---	|---	|
|[ARRAY](#array)	|Creates a new array column.	|
|[ARRAY\_CONTAINS](#array_contains)	|Returns true if the array contains value.	|
|[EXPLODE](#explode)	|Creates a new row for each element in the given array or map column.	|
|[MAP](#map)	|Creates a new map column.	|
|[POSEXPLODE](#posexplode)	|Creates a new row for each element with position in the given array or map column.	|
|[SIZE](#size)	|Returns length of array or map.	|
|[SORT\_ARRAY](#sort_array)	|Sorts the input array for the given column in ascending/descending order.	|
|[STRUCT](#struct)	|Creates a new struct column.	|

### `ARRAY`

**Description:**
Creates a new array column.

**Signature:**

```sql
ARRAY(Column... cols)
```

### `ARRAY_CONTAINS`

**Description:**
Returns true if the array contains `value`.

**Signature:**

```sql
ARRAY_CONTAINS(Column column, Object value)
```

### `EXPLODE`

**Description:**
Creates a new row for each element in the given array or map column.

**Signature:**

```sql
EXPLODE(Column e)
```

### `MAP`

**Description:**
Creates a new map column.

**Signature:**

```sql
MAP(Column... cols)
```

### `POSEXPLODE`

**Description:**
Creates a new row for each element with position in the given array or map column.

**Signature:**

```sql
POSEXPLODE(Column e)
```

### `SIZE`

**Description:**
Returns length of array or map.

**Signature:**

```sql
SIZE(Column e)
```

### `SORT_ARRAY`

**Description:**
Sorts the input array for the given column in ascending/descending order, according to the natural ordering of the array elements. The sorting defaults to ascending order, unless `asc` is set to false.

**Signature:**

```sql
SORT_ARRAY(Column e)SORT_ARRAY(Column e, boolean asc)
```

### `STRUCT`

**Description:**
Creates a new struct column.

**Signature:**

```sql
STRUCT(Column... cols)
```

## Window functions

|Function	|Description	|
|---	|---	|
|[LAG](#lag)	|Returns the value that is offset rows before the current row, and null if there is less than offset rows before the current row.	|
|[LEAD](#lead)	|Returns the value that is offset rows after the current row, and null if there is less than offset rows after the current row.	|

### `LAG`

**Description:**
Window function: returns the value that is `offset` rows before the current row, and null if there is less than `offset` rows before the current row. For example, an offset of one will return the previous row at any given point in the window partition.

**Signature:**

```sql
LAG(Column e, int offset)LAG(Column e, int offset, Object defaultValue)
```

### `LEAD`

**Description:**
Window function: returns the value that is `offset` rows after the current row, and null if there is less than `offset` rows after the current row.

**Signature:**

```sql
LEAD(Column e, int offset)LEAD(Column e, int offset, Object defaultValue)
```

## Other functions

|Function	|Description	|
|---	|---	|
|[CRC32](#crc32)	|Calculates the cyclic redundancy check value of a binary column and returns the value as a bigint.	|
|[GREATEST](#greatest)	|Returns the greatest value of the list of values, skipping null values.	|
|[HASH](#hash)	|Calculates the hash code of given columns, and returns the result as an int column.	|
|[HEX](#hex)	|Computes hex value of the given column.	|
|[ISNAN](#isnan)	|Return true iff the column is NaN.	|
|[LEAST](#least)	|Returns the least value of the list of values, skipping null values.	|
|[MD5](#md5)	|Calculates the MD5 digest of a binary column and returns the value as a 32 character hex string.	|
|[NANVL](#nanvl)	|Returns col1 if it is not NaN, or col2 if col1 is NaN.	|
|[NOT](#not)	|Inversion of boolean expression.	|
|[SHA1](#sha1)	|Calculates the SHA-1 digest of a binary column and returns the value as a 40 character hex string.	|
|[SHA2](#sha2)	|Calculates the SHA-2 family of hash functions of a binary column and returns the value as a hex string.	|
|[WHEN](#when)	|Evaluates a list of conditions and returns one of multiple possible result expressions.	|

### `CRC32`

**Description:**
Calculates the cyclic redundancy check value (CRC32) of a binary column and returns the value as a bigint.

**Signature:**

```sql
CRC32(Column e)
```

### `GREATEST`

**Description:**
Returns the greatest value of the list of values, skipping null values. Compares values using the “>” operator. This function takes at least 2 parameters. It will return null iff all parameters are null.

**Signature:**

```sql
GREATEST(Column... exprs)
```

### `HASH`

**Description:**
Calculates the hash code of given columns, and returns the result as an int column.

**Signature:**

```sql
HASH(Column... cols)
```

### `HEX`

**Description:**
Computes hex value of the given column. If `column` is of type int or binary, returns the number is a string in hexadecimal format. If `column` is of type string, converts each character into its hexadecimal representation and returns the resulting string.

**Signature:**

```sql
HEX(Column column)
```

### `ISNAN`

**Description:**
Return true iff the column is NaN.

**Signature:**

```sql
ISNAN(Column e)
```

### `LEAST`

**Description:**
Returns the least value of the list of values, skipping null values. Compares values using the “<” operator. This function takes at least 2 parameters. It will return null iff all parameters are null.

**Signature:**

```sql
LEAST(Column... exprs)
```

### `MD5`

**Description:**
Calculates the MD5 digest of a binary column and returns the value as a 32 character hex string.

**Signature:**

```sql
MD5(Column e)
```

### `NANVL`

**Description:**
Returns `col1` if it is not NaN, or `col2` if col1 is NaN.

**Signature:**

```sql
NANVL(Column col1, Column col2)
```

### `NOT`

**Description:**
Inversion of Boolean expression (that is, NOT).

**Signature:**

```sql
NOT(Column e)
```

### `SHA1`

**Description:**
Calculates the SHA-1 digest of a binary column and returns the value as a 40 character hex string.

**Signature:**

```sql
SHA1(Column e)
```

### `SHA2`

**Description:**
Calculates the SHA-2 family of hash functions of a binary column and returns the value as a hex string.

**Signature:**

```sql
SHA2(Column e, int numBits)
```

### `WHEN`

**Description:**
Evaluates a list of conditions and returns one of multiple possible result expressions.

**Signature:**

```sql
WHEN(Column condition, Object value)
```
