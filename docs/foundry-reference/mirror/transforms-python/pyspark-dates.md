<!-- source: https://palantir.com/docs/foundry/transforms-python/pyspark-dates/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Dates and timestamps

## 1. Add or subtract dates

### Add or subtract days to date

* `F.date_add(start, days)`
* `F.date_sub(start, days)`

### Add months to date

* `F.add_months(start, months)`

### Get number of days or months between two dates

* `F.datediff(end, start)`
* `F.months_between(date1, date2)`

### Get the last day of the month

* `F.last_day(date)`

### Get date of the next dayOfWeek

* `F.next_day(date, dayOfWeek)`

## 2. Date values

### Get the year, month, day, minute, second

* `F.year(column)`
* `F.month(column)`
* `F.dayofmonth(column)`
* `F.hour(column)`
* `F.minute(column)`
* `F.second(column)`

### Get business quarter from date

* `F.quarter(column)`

### Get day or week of year from date

* `F.dayofyear(column)`
* `F.weekofyear(column)`

## 3. Formatting

### Date & time format syntax

Here's a quick reference:

| Format              | Example             |
| ------------------- | ------------------- |
| yyyy-MM-dd          | 1997-01-31          |
| yyyy-MM-dd HH\:mm:ss | 1997-01-31 23:59:59 |

> Date formatting string patterns are based on the Java class java.text.SimpleDateFormat. The complete reference is available in the [Date & Time Format Syntax Table ↗](https://docs.oracle.com/javase/7/docs/api/java/text/SimpleDateFormat.html).

### Converting from string

* `F.to_date(column, format=None)`
* `F.to_timestamp(column, format=None)`
* `F.to_utc_timestamp(timestamp, tz)`
* `F.unix_timestamp(timestamp=None, format='yyyy-MM-dd HH:mm:ss')`

### Converting to string

* `F.date_format(date, format)`
* `F.from_unixtime(timestamp, format='yyyy-MM-dd HH:mm:ss')`
* `F.from_utc_timestamp(timestamp, tz)`

### Casting from `long` to `timestamp`

Some systems store timestamps as a `long` datatype, in milliseconds. PySpark SQL stores timestamps in seconds. We must divide the `long` version of the timestamp by 1000 to properly cast it to `timestamp`:

```python
casted_timestamp = (F.col('timestamp') / 1000).cast("timestamp")
df = df.withColumn("timestamp", casted_timestamp)
# 1531860192661 =>  Tuesday, July 17, 2018 8:43:12 PM
```

We can also use `F.from_unixtime(timestamp)` for clarity:

```python
timestamp = F.from_unixtime(F.col('timestamp') / 1000)
df = df.withColumn("timestamp", timestamp)
```

:::callout{theme="neutral"}
When casting from `long` to `timestamp`, we lose a level of granularity. SQL cannot store percentages or decimals of seconds.
:::

### Truncating

* `F.trunc(date, format)`
* `F.date_trunc(format, timestamp)`
