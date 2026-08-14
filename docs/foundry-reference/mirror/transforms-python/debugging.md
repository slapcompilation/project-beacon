<!-- source: https://palantir.com/docs/foundry/transforms-python/debugging/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Debug Python transforms

This guide provides an overview of debugging techniques available in Python transforms. More information on errors and exceptions can be found in the [Python documentation ↗](https://docs.python.org/3/tutorial/errors.html).

## Using the debugger

A debugger is a useful tool for identifying and resolving issues in your Python transforms. You can set breakpoints to pause transform execution and examine variables, view DataFrames, and understand functions and libraries.

Learn more about the debugger for your chosen IDE:

* [VS Code debugger.](/docs/foundry/palantir-extension-for-visual-studio-code/debug-transforms/)
* [Code repositories debugger.](/docs/foundry/code-repositories/debug-transforms/)

## Reading Python tracebacks

A *traceback* in Python is an error message that contains the sequence of function calls that led to an error, also known as a stack trace in other programming languages. In Python, any unhandled exceptions will result in a traceback, and the most recent call will be at the bottom.

Most Python transforms runtime failures surface as tracebacks, so it is important to understand how to read them.

Consider the following code example:

```python
 class Stats(object):

     nums = []

     def add(self, n):
         self.nums.append(n)

     def sum(self):
         return sum(self.nums)

     def avg(self):
         return self.sum() / len(self.nums)


 def main():
     stats = Statistics()
     stats.add(1)
     stats.add(2)
     stats.add(3)
     print(stats.avg())
```

Running this code results in the following traceback:

```python
Traceback (most recent call last):
  File "test.py", line 26, in <module>
    main()
  File "test.py", line 16, in main
    stats = Statistics()
NameError: global name 'Statistics' is not defined
```

Unlike stack traces in other programming languages, Python tracebacks show the most recent call last. From the bottom-up, the traceback shows the following:

* The exception name, [`NameError` ↗](https://docs.python.org/3/library/exceptions.html#NameError). There are many [built-in Python exception classes ↗](https://docs.python.org/3/library/exceptions.html), but it is also possible for code to define its own exception classes.
* The exception message, `global name 'Statistics' is not defined`. This message contains the most useful information for debugging purposes.
* The sequence of function calls leading up to the thrown exception: `File "test.py", line 26, in <module>` followed by the line of code in question (line 16).

Using this traceback, we can see that the exception occurs at line 16 of `test.py` in the `main` method. Specifically, the line of code causing the error is `stats = Statistics()`, and the exception thrown is `NameError`. From this, we can deduce that the name `Statistics` does not exist. Looking back at the example code, it appears that the name `Stats` should have been used instead of `Statistics`.

## Logging

For logging, you can use the following options:

* Simple `print` statements. This method is supported for standard (lightweight) transforms, but not for Spark transforms.
* The standard [Python logging module ↗](https://docs.python.org/3/library/logging.html). This method is supported for all transform types. Note that only `INFO`-level logs and higher are saved.

Logs are available in VS Code under **Output** and in the [Builds application](/docs/foundry/data-integration/application-reference/#builds) under **Actions > View logs**.

The following code example demonstrates how you can output logs to help with debugging:

```python tab="Polars"
from transforms.api import transform, Input, Output
import polars as pl
import logging

log = logging.getLogger(__name__)


@transform.using(
    output=Output("/path/output"),
    input=Input("/path/input"),
)
def my_compute_function(output, input):
    input_df = input.polars()
    log.info("Number of rows: %d", input_df.height)
    print("Number of columns: " + str(input_df.width))
    output.write_table(input_df)
```

```python tab="DuckDB"
from transforms.api import transform, Input, Output
import polars as pl
import logging

log = logging.getLogger(__name__)


@transform.using(
    output=Output("/path/output"),
    input=Input("/path/input"),
)
def my_compute_function(ctx, output, input):
    conn = ctx.duckdb().conn
    input_df = conn.sql("SELECT * FROM input").fetchdf()
    log.info("Number of rows: %d", input_df.shape[0])
    print("Number of columns: " + str(input_df.shape[1]))
    output.write_table(input_df)
```

```python tab="Pandas"
from transforms.api import transform, Input, Output
import pandas as pd
import logging

log = logging.getLogger(__name__)


@transform.using(
    output=Output("/path/output"),
    input=Input("/path/input"),
)
def my_compute_function(output, input):
    input_df = input.pandas()
    log.info("Number of rows: %d", input_df.shape[0])
    print("Number of columns:" + str(input_df.shape[1]))
    output.write_table(input_df)
```

```python tab="PySpark"
from transforms.api import transform_df, Input, Output
from myproject.datasets import utils
import logging

log = logging.getLogger(__name__)


@transform_df(
   Output("/path/output"),
   input=Input("/path/input"),
)
def my_compute_function(input):
    log.info("Number of rows: %d", input.count())
    log.info("Number of columns: %d", len(input.columns))
    return input
```

:::callout{theme="neutral"}
You can find additional information about working with Spark logs in the [Spark documentation](/docs/foundry/transforms-python-spark/pyspark-logging/).
:::
