<!-- source: https://palantir.com/docs/foundry/transforms-python-spark/pyspark-coming-from-python/ · mirrored 2026-08-13 from Palantir Foundry docs -->

# Coming from Python

If you have experience with Python, you are maybe accustomed to manipulating data procedurally or imperatively: providing the exact steps needed to transform your data from one state to another. SQL, in contrast, is declarative, meaning that you describe the result you are looking for and the software handles generating that result. PySpark is a library for conveniently building complicated SQL queries via Python: it attempts to provide access to SQL concepts in Python's procedural syntax. This takes advantage of the flexibility of Python, convenience of SQL and parallel processing power of Spark.

It will be helpful to evolve your conceptual model to think in terms of the dataset as a whole and process the data based on columns instead of rows. Instead of manipulating data directly using variables, lists, dictionaries, loops, etc., we work in terms of DataFrames. This means that instead of using Python primitives and operators, we'll use Spark's built in operators that work on DataFrames at scale in a distributed fashion.

### Examples

Suppose you have a list of numbers in Python and you want to add `5` to each.

```python
old_list = [1,2,3]
new_list = []
for i in old_list:
	added_number = i + 5
	new_list.append(added_number)
print new_list
>>> [6,7,8]
```

In PySpark, this would resemble

```python
new_dataframe = old_dataframe.withColumn('added_number', old_dataframe.number + 5)
```

`new_dataframe` now represents the following,

| number | added\_number |
| ------ | ------------ |
| 1      | 6            |
| 2      | 7            |
| 3      | 8            |

Interestingly, the `DataFrame` object does not actually contain your data in memory: it is a reference to the data in Spark. DataFrames are **lazily evaluated**. When we ask Spark to actually do something with a DataFrame (for example write it out to Foundry) it walks through all of the intermediate DataFrames we created, generates an optimized query plan, and executes it on the Spark cluster. This allows Foundry to scale beyond the amount of data that can fit in memory on a single server or on your laptop.
