<!-- source: https://palantir.com/docs/foundry/transforms-python/pyspark-filtering/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Filtering

## Filter, where

### `DataFrame.filter(expression)`

Returns a new `DataFrame` with a subset of rows determined by the boolean expression. The `expression` parameter is a boolean column expression that can be derived in various ways.

:::callout{theme="neutral"}
`filter` in the beginning of a transform rather than towards the end to reduce unnecessary computation work and increase build time performance.
:::

If your dataset contains a lot of entries, but you only care about a subset of the rows that exist based on a criteria.

```python
df = df.filter(F.col("age") >= 21) # limit dataset to only people over age 21
```

`where` is an alias of `filter` and does exactly the same thing (the choice is up to your or your team's preference for which method name is more clear to read):

```python
df = df.where(F.col("age") >= 21) # limit dataset to only people over age 21
```

You can also chain filters in a few different ways:

```python
df = df.filter(F.col("age") >= 21).filter(F.col("age") < 35) # or...
df = df.filter((F.col("age") >= 21) & (F.col("age") < 35)) # group comparisons using parenthesis to ensure correct order of evaluation.

```

### Constants (Literals)

Whenever you compare a column to a constant, or "literal", such as a single hard coded string, date, or number, PySpark actually evaluates this basic Python datatype into a "literal" (same thing as declaring `F.lit(value)`). A literal is simply a column expression with a static value. This is an important dinstinction to know before we move forward, because it implies that all comparisons with literals (whether implicit or explicit) can be substituted with a named column instead. This means you can easily make dynamic comparisons that rely on other columns in the same row.

In some contexts literals are not interpreted correctly. For example, when comparing to a string it may be ambiguous whether you intend to refer to a column named the string or the string itself.

```python
df = df.filter("X" == "Y") # Do X and Y refer to columns or literals?
dff = df.filter(F.col("X") == F.lit("Y")) # Unambiguous.
```

## Logical operations

PySpark has a number of binary logical operations. These are always evaluated into instances of the boolean column expression and can be used to combine conditions.

:::callout{theme="neutral"}
Because the arguments to our logical operators are whole columns, not Python primitives, we cannot use the familiar `and` or `or` Python operators. These operators expect both arguments to already evaluate to single booleans. PySpark is able to interpret the `&` (bitwise-and), `|` (bitwise-or) operators, and `~` negation (tilda) symbols to build up a SQL query that runs very efficiently on all rows.
:::

One way this helps us is it permits named variables that reference the value of binary operations. So, in order to increase readability and clarity, especially when you are filtering for several properties, you can descriptively name each comparison:

```python
# filter for records where users are aged [21, 35), or has first_name="John", or last_name=None (null)
at_least_21 = F.col("age") >= 21
younger_than_35 = F.col("age") < 35
within_age_range = at_least_21 & younger_than_35
name_is_john = F.col("first_name") == "John"
last_name_is_null = F.isnull(F.col("last_name"))
df = df.where(within_age_range | name_is_john | last_name_is_null)
return df
```

Another way this helps us is we can leverage logical operations to provide filtering logic:

* `&`: And

  ```python
  df = df.filter(condition_a & condition_b)
  ```

* `|`: Or

  ```python
  df = df.filter(condition_a | condition_b)
  ```

* `^`: Exclusive-or

  ```python
  df = df.filter(condition_a ^ condition_b)
  ```

* `~`: Negation

  ```python
  df = df.filter(~condition_a)
  ```

Feel free to use python's for-loops to generate conditionals, but be sure to brush up on [Boolean algebra ↗](https://en.wikipedia.org/wiki/Boolean_algebra) to avoid unnecessary error. Here's an example of how this can be leveraged:

```python
def custom_func(col, value):
    # basic logic or UDF
    return output # True/False

values = ["a", "b", "c", "d"]
condition = F.lit(False)
for x in values:
    condition = condition | custom_func(F.col("column"), x)
df = df.filter(condition)
return df
```

## Like, rlike

The `like` and `rlike` methods allow pattern-matching using, respectively, SQL LIKE and Regex syntaxes.

> * For simple substring search, use `like`.
> * For more complex pattern-matching, use `rlike`.

### `Column.like(sql_like)`

Returns a boolean column based on a SQL LIKE match, provided by a literal string or column:

```python
df = df.filter(F.col('name').like('Al%'))
```

| age  | name    |
| ---- | ------- |
| 2    | "Alice" |

SQL LIKE wildcards:

* `%`: represents ≥ 0 characters
* `_`: represents a single character

Examples (from [w3schools ↗](https://www.w3schools.com/sql/sql_wildcards.asp)):

| LIKE Operator          | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `Column.like('a%')`    | Finds any values that starts with "a"                    |
| `Column.like('%a')`    | Finds any values that ends with "a"                      |
| `Column.like('%or%')`  | Finds any values that have "or" in any position          |
| `Column.like('_r%')`   | Finds any values that have "r" in the second position    |
| `Column.like('a_%_%')` | Finds any values that starts with "a" and ≥ 3 characters |
| `Column.like('a%o')`   | Finds any values that starts with "a" and ends with "o"  |

### `Column.rlike(regex)`

Returns a boolean column expression based on a regex match, provided by a literal string or column:

```python
df = df.filter(F.col('phone').rlike('[0-9]{3}(?:.+)?[0-9]{3}(?:.+)?[0-9]{4}'))
```

| name    | phone            |
| ------- | ---------------- |
| "Alice" | "412-512-1234"   |
| "John"  | "(555) 123-5123" |
| "Jane"  | "4121234444"     |

If leveraged properly, regex is very powerful. Here are some resources to help you get started:

* [Regex Cheatsheet ↗](https://medium.com/factory-mind/regex-tutorial-a-simple-cheatsheet-by-examples-649dc1c3f285) with examples
* [Regex Scratchpad ↗](https://regexr.com/) for testing regex expressions

## Starts with, ends with, contains

### `Column.startswith(string)`

Returns a boolean column expression indicating whether the column's string value starts with the string (literal, or other column) provided in the parameter.

```python
df = df.filter(F.col("id").startswith("prefix-"))
```

### `Column.endswith(string)`

Returns a boolean column expression indicating whether the column's string value ends with the string (literal, or other column) provided in the parameter.

```python
df = df.filter(F.col("id").endswith("-suffix"))
```

### `Column.contains(string)`

Returns a boolean column expression indicating whether the column's string value contains the string (literal, or other column) provided in the parameter.

```python
df = df.filter(F.col("id").contains("string"))
```

## Substring

### `Column.substr(startPos, length)`

Return a string column expression that evaluates the substring of the column's value.

Parameters:

* **startPos** - start position, counting from 1 (int or Column)
* **length** - length of the substring (int or Column)

1. Creating a column of substrings

   ```python
   df = df.select(F.col("name").substr(1, 3).alias("col"))
   ```

   | col   |
   | ----- |
   | "Ali" |
   | "Bob" |

2. Filtering on a substring

   ```python
   df = df.filter(F.col("phone").substr(5, 3) == "555")
   ```

   | phone          |
   | -------------- |
   | "323-555-1234" |
   | "897-555-4126" |
   | ...            |

## Is in

### `Column.isin(*cols)`

Returns a boolean expression that is evaluated to `True` if the value of the column is contained by the evaluated values of the arguments (in the form of an argument list, or an array, of Columns or literals).

```python
df = df.filter(F.col("name").isin("Bob", "Mike"))
```

| age  | name  |
| ---- | ----- |
| 5    | "Bob" |
| ...  | ...   |

```python
df = df.filter(F.col("age").isin([1, 2, 3]))
```

| age  | name    |
| ---- | ------- |
| 2    | "Alice" |
| ...  | ...     |

## Between

### `Column.between(lowerBound, upperBound)`

Returns a boolean expression that is evaluated to `True` if the value of the expression is between the lowerBound and upperBound literal or column (inclusive).

```python
within_range = F.col("age").between(10, df.upperBound).alias("age_within_range")
df = df.select(df.name, df.upperBound, df.age, within_range)
```

| name     | upperbound | age  | age\_within\_range |
| -------- | ---------- | ---- | ---------------- |
| "Taylor" | 30         | 35   | `False`          |
| "Sally"  | 40         | 34   | `True`           |
| "Lucy"   | 28         | 28   | `True`           |
