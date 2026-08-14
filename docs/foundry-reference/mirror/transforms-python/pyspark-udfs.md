<!-- source: https://palantir.com/docs/foundry/transforms-python/pyspark-udfs/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Concept: User-defined functions

User Defined Functions let you use your own arbitrary Python in PySpark. For example, you could use a UDF to parse information from a complicated text format in each row of your dataset.

After declaration, a UDF works similarly to built in PySpark functions such as `concat`, `date_diff`, `trim`, etc.

### Motivation

Unintuitively, under normal circumstances data is never actually brought into your Python code. When you manipulate DataFrames using PySpark, you are describing the steps that the Spark cluster should take in a distributed, parallel fashion to get your final DataFrame. This allows Spark and Foundry to scale almost *ad infinitum*, but introduces the minor setup of UDFs for injecting code to run within the cluster on actual data. PySpark sends your UDF code to each server running your query.

#### Consider not using UDFs

The overhead of Python as opposed to Spark's optimized built in functionality makes UDFs relatively slow. Consider expressing your logic with PySpark's built-ins.

## Example

```python
"Weather report: rain 55-62"
```

Suppose we want to get the low temperature from the following weather format, in this case `55`. We can write the following ordinary Python function,

```python
def extract_low_temperature(weather_report):
	return int(weather_report.split(' ')[-1].split('-')[0])
```

We'll create a UDF around our function `extract_low_temperature` to integrate it into our PySpark query. Creating a UDF involves providing our function and its expected return type in PySpark's type system.

```python
# Import the necessary type
from pyspark.sql.types import IntegerType

# Wrap our function as a UDF
low_temp_udf = F.udf(extract_low_temperature, IntegerType())
```

Now the UDF can be used on a DataFrame, taking a whole column as an argument.

```python
df = df.withColumn('low', low_temp_udf(F.col('weather_report')))
```

| id  | weather\_report                | low  |
| --- | ----------------------------- | ---- |
| 1   | Weather report: rain 55-62    | 55   |
| 2   | Weather report: sun 69-74     | 69   |
| 3   | Weather report: clouds 31-34  | 31   |

## Reading from Multiple Columns

A UDF can take arbitrary column arguments. The column arguments correspond to the function arguments.

```python
from pyspark.sql.types import StringType

def weather_quality(temperature, windy):
	if temperature > 70 and windy == False:
		return "good"
	else:
		return "bad"

weather_udf = F.udf(weather_quality, StringType())

df = df.withColumn('quality', weather_udf(F.col('temp'), F.col('wind')))
```

| id  | temp  | wind  | quality |
| --- | ----- | ----- | ------- |
| 1   | 73    | false | good    |
| 2   | 36    | false | bad     |
| 3   | 90    | true  | bad     |
