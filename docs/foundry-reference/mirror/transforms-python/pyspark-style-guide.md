<!-- source: https://palantir.com/docs/foundry/transforms-python/pyspark-style-guide/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Style guide

PySpark is a wrapper language that allows you to interface with an Apache Spark backend to quickly process data. Spark can operate on very large datasets across a distributed network of servers, which provides major performance and reliability benefits when used correctly. It presents challenges, even for experienced Python developers, as the PySpark syntax draws on the JVM heritage of Spark and therefore implements code patterns that might be unfamiliar.

This opinionated guide to PySpark code style presents common situations and the associated best practices based on the most frequent recurring topics across the PySpark repositories we've encountered.

To enforce consistent code style, each main repository should have [Pylint ↗](https://www.pylint.org/) enabled, with the same configuration. We provide some [PySpark-specific checkers ↗](https://github.com/palantir/pyspark-style-guide) that you can additionally include into your Pylint to match the rules listed in this document. See the [documentation on enabling style checks](/docs/foundry/transforms-python/unit-tests/#enable-style-checks) for details on our built-in Pylint plugin for Python repositories.

Beyond PySpark specifics, the general practices of clean code are important in PySpark repositories - the Google [PyGuide ↗](https://github.com/google/styleguide/blob/gh-pages/pyguide.md) is a good starting point.

## Prefer implicit column selection to direct access, except for disambiguation

```python
# bad
df = df.select(F.lower(df1.colA), F.upper(df2.colB))

# good
df = df.select(F.lower(F.col("colA")), F.upper(F.col("colB")))
```

The preferred option may look more complicated, longer and polluted - and that is correct; in fact it is best to avoid using F.col() altogether. But there are certain cases where using it, or
the alternative explicit selection, is unavoidable. There is however a very good reason to
prefer the second example over the first one.

When using explicit columns as in the first case, both the dataframe name and schema are explicitly bound to the dataframe variable. This means that if `df1` is deleted or renamed the reference `df1.colA` will break.

By contrast, `F.col("colA")` will always reference a column called `“colA”` in the dataframe being operated on, which in this case happens to be named `df`. It does not require keeping track of other dataframes' states at all, so the code becomes more local and less prone to “spooky interaction at a distance”, which are often challenging to debug.

Other good reasons to avoid the first case:

* If the dataframe variable name is large, expressions involving it quickly become unwieldy;
* If the column name has a space or some other unsupported character that requires access by the bracket
  operator then `df1["colA"]` is just as difficult to write as `F.col(“colA”)`;
* Assigning an abstract expression like `F.col("prod_status") == 'Delivered'` to a variable makes it reusable
  for multiple dataframes, while `df.prod_status == 'Delivered'` is always bound to df

Fortunately, usually a convoluted expression with `F.col()` is not required. The only exceptions
are `F.lower`, `F.upper`, ... [and these ↗](https://github.com/apache/spark/pull/23882).

### Caveats

In some contexts, there is access to columns from more than one dataframe, and there may be an overlap in
names. A common example is in matching expressions like `df.join(df2, on=(df.key == df2.key), how='left'`).
In such cases it is fine to reference columns by their dataframe directly. You can also disambiguate joins
using dataframe aliases (see more in the **Joins** section in this guide).

## Avoid iterating over columns in favor of list comprehension

In general, for loops are inefficient in Spark. At a high level, this is because Spark is lazily evaluated and will only process one for loop at a time. This may cause slower run times if all parts of the loop can be processed at once, and may result in Driver out of memory errors (OOMs). To rename all columns in a dataset from uppercase to lower case, instead of the first example below (labeled `# bad`), we suggest using list comprehension instead (as in the second example labeled `# good`):

```python
# bad
for colm in df.columns:
    df = df.withColumnRenamed(colm, colm.lower())
```

```python
# good
df = df.select(
    *[F.col(colm).alias(colm.lower()) for colm in df.columns]
)
```

Using list comprehension as in the `# good` example will avoid the slow performance and query plan issues discussed above while still getting the same desired result.

## Refactor complex logical operations

Logical operations, which often reside inside `.filter()` or `F.when()`, need to be readable. We apply the same rule as with chaining functions, keeping logic expressions
inside the same code block to *3 expressions at most*. If they grow longer, it is often a sign that the code can be simplified or extracted out. Extracting out complex logical operations into variables or functions makes the code easier to read and reason about, which also reduces bugs.

```python
# bad
F.when( (df.prod_status == 'Delivered') | (((F.datediff(df.deliveryDate_actual, df.current_date) < 0) & 
((df.currentRegistration.rlike('.+')) | ((F.datediff(df.deliveryDate_actual, df.current_date) < 0) & 
(df.originalOperator.rlike('.+') | df.currentOperator.rlike('.+')))))), 'In Service')
```

We can simplify the code above in different ways. To start, let's focus on grouping the logic steps in a few named variables. Pyspark requires that expressions are wrapped with parentheses. This, mixed with actual parenthesis to group logical operations can hurt readability. For example the code
above has a redundant `(F.datediff(df.deliveryDate_actual, df.current_date) < 0)` that the original author didn't notice because it's very hard to spot.

```python
# better
has_operator = (df.originalOperator.rlike('.+') | df.currentOperator.rlike('.+'))
delivery_date_passed = (F.datediff(df.deliveryDate_actual, df.current_date) < 0)
has_registration = (df.currentRegistration.rlike('.+'))
is_delivered = (df.prod_status == 'Delivered')

F.when(is_delivered | (delivery_date_passed & (has_registration | has_operator)), 'In Service')
```

The above example is easier to read, and also drops the redundant expression. We can improve it further by reducing the number of operations.

```python
# good
has_operator = (df.originalOperator.rlike('.+') | df.currentOperator.rlike('.+'))
delivery_date_passed = (F.datediff(df.deliveryDate_actual, df.current_date) < 0)
has_registration = (df.currentRegistration.rlike('.+'))
is_delivered = (df.prod_status == 'Delivered')
is_active = (has_registration | has_operator)

F.when(is_delivered | (delivery_date_passed & is_active), 'In Service')
```

Note how the `F.when` expression is now succinct and readable and the desired behavior is clear to anyone reviewing this code. The reader only needs to visit the individual expressions if they suspect there is an
error there. It also makes each chunk of logic easy to test if you have unit tests in your code,
and want to abstract them as functions.

There is still some duplication of code in the final
example: we leave how to remove that duplication as an exercise for the reader.

## Use `select` statements to specify a schema contract

Doing a select at the beginning of a PySpark transform, or before returning, is considered good
practice. This `select` statement specifies the contract with both the reader and the code about the expected dataframe schema for inputs and outputs.

Any select should be seen as a cleaning operation that is preparing the dataframe for consumption by the next step in the transform.

Always aim to keep select statements as simple as
possible. Due to common SQL idioms, allow for up to *one* function from `spark.sql.function` to be used per selected column, plus an optional `.alias()` to give it a meaningful name. Keep in mind
that this should be used sparingly, and if there are more than *three* such uses in the same select, refactor it into a separate function like `clean_<dataframe name>()` to encapsulate the operation.

*Never* allow expressions involving more than one dataframe, or conditional operations like `.when()` to be used in a select.

```python
# bad
aircraft = aircraft.select(
    'aircraft_id',
    'aircraft_msn',
    F.col('aircraft_registration').alias('registration'),
    'aircraft_type',
    F.avg('staleness').alias('avg_staleness'),
    F.col('number_of_economy_seats').cast('long'),
    F.avg('flight_hours').alias('avg_flight_hours'),
    'operator_code',
    F.col('number_of_business_seats').cast('long'),
)
```

Cluster together the operations of the same type together. All individual columns should be listed upfront, while calls to functions from `spark.sql.function` should go on separate lines.

```python
# good
aircraft = aircraft.select(
    'aircraft_id', 'aircraft_msn', 'aircraft_type', 'operator_code',
    F.col('aircraft_registration').alias('registration'),
    F.col('number_of_economy_seats').cast('long'),
    F.col('number_of_business_seats').cast('long'),
    F.avg('staleness').alias('avg_staleness'),
    F.avg('flight_hours').alias('avg_flight_hours'),
)
```

The `select()` statement, by its nature, redefines the schema of a dataframe, so it naturally supports the inclusion or exclusion of columns, old and new, as well as the redefinition of pre-existing ones. By centralizing all such operations in a single statement, it becomes much easier to identify the final
schema, which makes code more readable. It also makes code slightly more concise.

Instead of calling `withColumnRenamed()`, use aliases:

```python
# bad
df.select('key', 'comments').withColumnRenamed('comments', 'num_comments')

# good
df.select('key', F.col('comments').alias('num_comments'))
```

Instead of using `withColumn()` to redefine type, cast in the select:

```python
# bad
df.select('comments').withColumn('comments', F.col('comments').cast('double'))

# good
df.select(F.col('comments').cast('double'))
```

But keep it simple:

```python
# bad
df.select(
    ((F.coalesce(F.unix_timestamp('closed_at'), F.unix_timestamp())
    - F.unix_timestamp('created_at')) / 86400).alias('days_open')
)

# good
df.withColumn(
    'days_open',
    (F.coalesce(F.unix_timestamp('closed_at'), F.unix_timestamp()) - F.unix_timestamp('created_at')) / 86400
)
```

Avoid including columns in the select statement if they are going to remain unused and choose instead an explicit set of columns - this is a preferred alternative to using
`.drop()` since it guarantees that schema mutations won't cause unexpected columns bloating your dataframe. That said, dropping columns isn't inherently discouraged in all cases; for instance it is commonly appropriate after joins since it is common for joins to introduce redundant columns.

Finally, instead of adding new columns by means of the select statement, it's
recommended using `.withColumn()` instead.

## Empty columns

If you need to add an empty column to satisfy a schema, always use `F.lit(None)` for populating that column. Never use an empty string or some other string signalling an empty value (such as `NA`).

Beyond being semantically correct, one practical reason for this preserving the ability to use utilities like `isNull`, instead of having to verify empty strings, and nulls, and `'NA'`, etc.

```python
# bad
df = df.withColumn('foo', F.lit(''))

# bad
df = df.withColumn('foo', F.lit('NA'))

# good - note necessary cast since `None` is typeless. Choose the appropriate type based on expected use.
df = df.withColumn('foo', F.lit(None).cast('string'))
```

## Using comments

While comments can provide useful insight into code, it is often more valuable to refactor the code to improve its readability. The code should be readable by itself. If you are using comments to explain the logic step by step, you should refactor it.

```python
# bad

# Cast the timestamp columns
cols = ["start_date", "delivery_date"]
for c in cols:
    df = df.withColumn(c, F.from_unixtime(df[c] / 1000).cast(TimestampType()))
```

In the example above, we can see that those columns are getting cast to Timestamp. The comment doesn't add much value. Moreover, a more verbose comment might still be unhelpful if it only
provides information that already exists in the code. For example:

```python
# bad

# Go through each column, remove 1000 because millis and cast to timestamp
cols = ["start_date", "delivery_date"]
for c in cols:
    df = df.withColumn(c, F.from_unixtime(df[c] / 1000).cast(TimestampType()))
```

Instead of leaving comments that just describe the logic you wrote, you should aim at leaving comments that give context, explaining the "why" of decisions you made when writing the code. This is particularly important for PySpark, since the reader can understand your code, but often doesn't have context on the data that feeds into your PySpark transform. Small pieces of logic
might have involved hours of digging through data to understand the correct behavior, in which case comments explaining the rational are especially valuable.

```python
# good

# The consumer of this dataset expects a timestamp instead of a date, and we need
# to adjust the time by 1000 because the original datasource is storing these as millis
# even though the documentation says it's actually a date.
cols = ["start_date", "delivery_date"]
for c in cols:
    df = df.withColumn(c, F.from_unixtime(df[c] / 1000).cast(TimestampType()))
```

## UDFs (user defined functions)

It is highly recommended to avoid UDFs in all situations, as they are dramatically less performant than native PySpark. In most situations, logic that seems to necessitate a UDF can, in fact, be refactored to use only native PySpark functions.

## Collect (and related functions)

Always avoid using functions that collect data to the Spark driver, such as:

* `DataFrame.collect()`
* `DataFrame.first()`
* `DataFrame.head(...)`
* `DataFrame.take(...)`
* `DataFrame.show(...)`

Using these functions eliminates the benefits of a distributed framework like Spark, resulting in lower performance or out-of-memory errors. Instead of these functions, we strongly recommend using:

* The [**Preview & Debug**](/docs/foundry/code-repositories/debug-transforms/) feature in Code Repository to inspect the state of variables (including Spark DataFrames) when developing transforms.
* Native PySpark functions (if possible) or UDFs (in rare cases when the logic is impossible to encode using native functions) to process map/aggregate values in DataFrames.

## Joins

Be careful with joins. If you perform a left join, and the right side has multiple matches for a key, that row will be duplicated as many times as there were matches. This is called a "join explosion" and can dramatically bloat the size of your dataset. Always double check your assumptions to see that the key you are joining on is unique, unless you are expecting the multiplication.

Bad joins are the source of many issues which can be tricky to debug. There are some things that help like specifying the `how` explicitly, even if you are using the default value (`inner`):

```python
# bad
flights = flights.join(aircraft, 'aircraft_id')

# also bad
flights = flights.join(aircraft, 'aircraft_id', 'inner')

# good
flights = flights.join(aircraft, 'aircraft_id', how='inner')
```

Also avoid `right` joins. If you are about to use a `right` join, switch
the order of your dataframes and use a `left` join instead. It is more intuitive, since the
dataframe you are doing the operation on, is the one that you are centering your join around.

```python
# bad
flights = aircraft.join(flights, 'aircraft_id', how='right')

# good
flights = flights.join(aircraft, 'aircraft_id', how='left')
```

When joining dataframes, avoid using expressions that duplicate columns in the output:

```python
# bad - column aircraft_id will be duplicated in the output
output = flights.join(aircraft, flights.aircraft_id == aircraft.aircraft_id, how='inner')

# good
output = flights.join(aircraft, 'aircraft_id', how='inner')
```

Avoid renaming all columns to avoid collisions. You can instead just give an alias to the
whole dataframe, and use that alias to select which columns you want in the end.

```python
# bad
columns = ["start_time", "end_time", "idle_time", "total_time"]
for col in columns:
    flights = flights.withColumnRenamed(col, 'flights_' + col)
    parking = parking.withColumnRenamed(col, 'parking_' + col)

flights = flights.join(parking, on="flight_code", how="left")

flights = flights.select(
    F.col("flights_start_time").alias("flight_start_time"),
    F.col("flights_end_time").alias("flight_end_time"),
    F.col("parking_total_time").alias("client_parking_total_time")
)

# good
flights = flights.alias("flights")
parking = parking.alias("parking")

flights = flights.join(parking, on="flight_code", how="left")

flights = flights.select(
    F.col("flights.start_time").alias("flight_start_time"),
    F.col("flights.end_time").alias("flight_end_time"),
    F.col("parking.total_time").alias("client_parking_total_time")
)
```

In such cases, however, keep in mind that:

* It's probably best to drop overlapping columns *prior* to joining if you don't need both;
* In case you do need both, it might be best to rename one of them prior to joining;
* You should always resolve ambiguous columns before outputting a dataset, since after the transform is finished running you can no longer distinguish them.

As a last word about joins, don't use `.dropDuplicates()` or `.distinct()` as a crutch. If unexpected duplicate rows are observed, there's almost always an underlying reason for why those duplicate rows appear. Adding `.dropDuplicates()` only masks this problem and adds
overhead to the runtime.

## Chaining of expressions

Chaining expressions is a contentious topic, but we do recommend some limits on the usage of chaining. See the [conclusion](#rationale) of this section for a discussion of the rationale behind this recommendation.

Avoid chaining of expressions into multi-line expressions with different types. Particularly if they have different behaviors or contexts. For example mixing column creation or joining with selecting and filtering.

```python
# bad
df = (
    df
    .select("a", "b", "c", "key")
    .filter(df.a == "truthiness")
    .withColumn("boverc", df.b / df.c)
    .join(df2, "key", how="inner")
    .join(df3, "key", how="left")
    .drop('c')
)

# better (separating into steps)
# first: we select and trim down the data that we need
# second: we create the columns that we need to have
# third: joining with other dataframes

df = (
    df
    .select("a", "b", "c", "key")
    .filter(df.a == "truthiness")
)

df = df.withColumn("boverc", df.b / df.c)

df = (
    df
    .join(df2, "key", how="inner")
    .join(df3, "key", how="left")
    .drop('c')
)
```

Having each group of expressions isolated into its own logical code block improves legibility and makes it easier to find relevant logic.

For example, a reader of the code below will likely jump to where they see dataframes being assigned `df = df...`.

```python
# bad
df = (
    df
    .select('foo', 'bar', 'foobar', 'abc')
    .filter(df.abc == 123)
    .join(another_table, 'some_field')
)

# better
df = (
    df
    .select('foo', 'bar', 'foobar', 'abc')
    .filter(F.col('abc') == 123)
)

df = df.join(another_table, 'some_field', how='inner')
```

There are legitimate reasons to chain expressions together. These commonly represent atomic logic steps, and are acceptable. Apply a rule with a maximum of number chained expressions in the same block to keep the code readable. We recommend chains of no longer than 3-5 statements.

If you find you are making longer chains, or getting trouble because of the size of your variables, consider extracting the logic into a separate function:

```python
# bad
customers_with_shipping_address = (
    customers_with_shipping_address
    .select("a", "b", "c", "key")
    .filter(F.col("a") == "truthiness")
    .withColumn("boverc", F.col("b") / F.col("c"))
    .join(df2, "key", how="inner")
)

# also bad
customers_with_shipping_address = customers_with_shipping_address.select("a", "b", "c", "key")
customers_with_shipping_address = customers_with_shipping_address.filter(df.a == "truthiness")

customers_with_shipping_address = customers_with_shipping_address.withColumn("boverc", F.col("b") / F.col("c"))

customers_with_shipping_address = customers_with_shipping_address.join(df2, "key", how="inner")

# better
def join_customers_with_shipping_address(customers, df_to_join):

    customers = (
        customers
        .select("a", "b", "c", "key")
        .filter(df.a == "truthiness")
    )

    customers = customers.withColumn("boverc", F.col("b") / F.col("c"))
    customers = customers.join(df_to_join, "key", how="inner")
    return customers
```

In fact, chains of more than three statements are prime candidates to factor into separate, well-named functions since they are already encapsulated, isolated blocks of logic.

### Rationale

There are several reasons behind these limits on chaining:

* Differentiation between PySpark code and SQL code. Chaining is something that goes against most (if not all) other Python styling. You don’t chain in Python, you assign.
* Discourage the creation of large single code blocks. These often would make more sense extracted as a named function.
* This doesn’t need to be all or nothing; a maximum between three to five lines of chaining balances practicality with legibility.
* If you are using an IDE, this makes it easier to use automatic extractions or do code movements (for example, Ctrl/Cmd+Shift+Up in PyCharm).
* Large chains are hard to read and maintain, particularly if chains are nested.

## Multi-line expressions

The reason you can chain expressions is because PySpark was developed from Spark, which comes from JVM languages. This meant some design patterns were transported, namely chainability.

However, Python doesn't support multiline expressions gracefully and the only alternatives are to either provide explicit line breaks, or wrap the expression in parentheses. You only need to provide explicit line breaks if the chain happens at the root node. For example:

```python
# needs `\`
df = df.filter(F.col('event') == 'executing')\
       .filter(F.col('has_tests') == True)\
       .drop('has_tests')

# chain not in root node so it doesn't need the `\`
df = df.withColumn('safety', F.when(F.col('has_tests') == True, 'is safe')
                              .when(F.col('has_executed') == True, 'no tests but runs')
                              .otherwise('not safe'))
```

Thus to keep things consistent, wrap the entire expression into a single parenthesis block, and avoid using `\`:

```python
# bad
df = df.filter(F.col('event') == 'executing')\
    .filter(F.col('has_tests') == True)\
    .drop('has_tests')

# good
df = (
  df
  .filter(F.col('event') == 'executing')
  .filter(F.col('has_tests') == True)
  .drop('has_tests')
)
```

## Other Considerations and Recommendations

* Be wary of functions that grow too large. As a general rule, a file should not be over 250 lines, and a function should not be over 70 lines.
* Try to keep your code in logical blocks. For example, if you have multiple lines that reference the same things, try to keep them together. Separating them would make it harder for the reader to have context.
* Test your code. If you can run the local tests, do that and make sure that your new code is covered by the tests. If you can't run the local tests, build the datasets on your branch and manually verify that the data looks as expected.
* Avoid `.otherwise(value)` as a general fallback. If you are mapping a list of keys to a list of values and a number of unknown keys appear, using `otherwise` will mask all of these into one value.
* Do not keep commented out code checked in the repository. This applies to single line of codes, functions, classes or modules. Rely on git and its capabilities of branching or looking at history instead.
* When encountering a large single transformation composed of integrating multiple different source tables, split it into the natural sub-steps and extract the logic to functions. This allows for easier higher level readability and allows for code re-usability and consistency between transforms.
* Try to be as explicit and descriptive as possible when naming functions or variables. Except for top level transforms wrapping object transformations, strive to capture what the function is actually doing as opposed to naming it just by the objects used inside of it.
* Think twice about introducing new import aliases, unless there is a good reason behind it. For example, this may be reasonable if an imported module is called many times in different files and the module is common and familiar to almost all developers. Some of the established ones are `types` and `functions` from pySpark `from pyspark.sql import types as T, functions as F`.
* Avoid using literal strings or integers in filtering conditions, new values of columns, and so on. Instead, extract them into variables, constants, dicts or classes as suitable, to capture their meaning. This makes the code more readable and enforces consistency across the repository.
