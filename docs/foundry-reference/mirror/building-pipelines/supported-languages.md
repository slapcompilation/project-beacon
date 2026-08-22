<!-- source: https://palantir.com/docs/foundry/building-pipelines/supported-languages/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Supported languages

Before getting started with your data transformation, it is important to consider the benefits as well as the limitations of each language. This table includes a summary of the key differences between the supported languages:

|Description|[SQL](#sql)|[Python](#python)|[Java](#java)|
|---|---|---|---|
|*Non-proprietary language:* documentation available online|✓|✓|✓|
|*Support for file access:* read and write files in Foundry datasets—this means your data transformation can operate on unstructured data| |✓|✓|
|*Transform Level Logic Versioning (TLLV):* more info in the [TLLV section](/docs/foundry/transforms-python/transforms/#transform-logic-level-versioning)|✓|✓| |
|*Incremental computation:* more info in the [incremental computation section](/docs/foundry/building-pipelines/incremental-overview/)| |✓|✓|
|*Support for removing inherited markings*|✓|✓|✓|
|*Multiple output datasets allowed per file*| |✓|✓|
|*Support for dataset previews*|✓|✓|✓|
|*Custom Transforms profiles* |✓|✓|✓|

## SQL

SQL is a language that has plenty of external documentation available online. Here are some key benefits of writing data transformations in SQL:

* SQL is the most performant language (including most Spark optimization).
* Transforms SQL gives you access to a SQL scratchpad that allows you to run sample SQL queries to check your SQL syntax.

[Learn more about SQL Transforms.](/docs/foundry/transforms-sql/overview/)

## Python

Python is a language with plenty of external documentation available online. You may want to write data transformations in Python so that you can take advantage of the language-specific capabilities and libraries of Python. The Python API is lower-level than other languages like SQL. Here are some key benefits of using Python:

* The [`transforms` Python library](/docs/foundry/api-reference/transforms-python-library/api-overview/) is an API that exposes functionalities such as file reads and writes. File-based data transformations can be useful early on in data transformation pipelines when you want to parse and clean data.
* There is first-class support for using external libraries such as pandas, NumPy, and other machine learning libraries.
* You get access to the full Spark Python (PySpark) API, which includes additional features of Spark that are not supported in other languages.

[Learn more about Python Transforms.](/docs/foundry/transforms-python/overview/)

## Java

Java is a language with plenty of external documentation available online. You may want to write data transformations in Java so that you can take advantage of the language-specific capabilities in Java. Java is a lower-level API than other languages like SQL. Here are some key benefits of using Java:

* The `transforms` Java library is an API that exposes functionalities such as file reads and writes. File-based data transformations can be useful early on in data transformation pipelines when you want to parse and clean data.

[Learn more about Java Transforms.](/docs/foundry/transforms-java/overview/)
