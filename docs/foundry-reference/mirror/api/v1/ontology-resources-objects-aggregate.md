<!-- source: https://palantir.com/docs/foundry/api/v1/ontology-resources/objects/aggregate/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Aggregate Objects Details

```
POST /api/v1/ontologies/{ontologyRid}/objects/{objectType}/aggregate
```

## Aggregation types

| Aggregation type                                                                  | Description                                                               |
|-----------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| [count](#-count-of-values-count)                                                  | Computes the total count of objects.                                      |
| [max](#-maximum-value-max)                                                        | Computes the maximum value for the provided field.                        |
| [min](#-minimum-value-min)                                                        | Computes the minimum value for the provided field.                        |
| [sum](#-sum-of-values-sum)                                                        | Computes the sum of values for the provided field.                        |
| [avg](#-average-value-avg)                                                        | Computes the average value for the provided field.                        |
| [approximateDistinct](#-approximate-count-of-distinct-values-approximatedistinct) | Computes an approximate number of distinct values for the provided field. |

## GroupBy types

| GroupBy type                                       | Description                                                         |
|----------------------------------------------------|---------------------------------------------------------------------|
| [exact](#-exact-groupby-type-exact)                | Divides objects into groups according to an exact value.            |
| [fixedWidth](#-fixedwidth-groupby-type-fixedwidth) | Divides objects into groups with the specified width.               |
| [ranges](#-ranges-groupby-type-ranges)             | Divides objects into groups according to specified ranges.          |
| [duration](#-duration-groupby-type-duration)       | Divides objects into groups according to a specified time interval. |

## Example aggregation request

**Description**

Multiple aggregations can be specified. The order of aggregations will not affect the final results.
Multiple grouping conditions can be specified. The results are computed **based on the order** of groupBy objects.

In addition to the `aggregation` and `groupBy` fields, a `query` field can be used to select which objects to aggregate.
The query syntax is documented on the [search objects page](/docs/foundry/api/ontology-resources/objects/search/).

```
{
  "aggregation": [
    {
      "type": "max",
      "field": "properties.tenure",
      "name": "longest_tenure"
    }
  ],
  "groupBy": [
    {
      "type": "exact",
      "field": "properties.department",
      "maxGroupCount": 1
    }
  ]
}
```

## Example aggregation response

```
{
  "excludedItems": 20,
  "data": [
    {
      "metrics": [
        {
          "name": "longest_tenure",
          "value": 7
        }
      ],
      "group": {
        "properties.department": "marketing"
      }
    }
  ]
}
```

* `excludedItems`: The number of items excluded from the aggregation results. Items will be excluded if you have more
  different groups than your `maxGroupCount`. In the example above, if you group by department with a `maxGroupCount` of
  `1`, only employees in one department will be included and the rest will be counted as `excludedItems`.
* `data`: The list of results, with one entry for each group.

## Aggregation types

### Count of values (`count`)

**Description**

Computes the total count of objects.

**Example**

```
{
  "aggregation": [
    {
      "type": "count",
      "name": "total_count"
    }
  ]
}
```

**Note**

* `name` is an optional field that customizes the name of the aggregation metric in the response. If omitted, the
  default name is `count`.

-------

### Maximum value (`max`)

**Description**

Computes the maximum value for the provided field.

**Example**

```
{
  "aggregation": [
    {
      "type": "max",
      "field": "properties.tenure",
      "name": "longest_tenure"
    }
  ]
}
```

**Note**

* [Null values are ignored](#null-values).
* `name` is an optional field that customizes the name of the aggregation metric in the response. If omitted, the
  default name is `max_<propertyApiName>`, e.g. `max_tenure`.

-------

### Minimum value (`min`)

**Description**

Computes the minimum value for the provided field.

**Example**

```
{
  "aggregation": [
    {
      "type": "min",
      "field": "properties.tenure",
      "name": "shortest_tenure"
    }
  ]
}
```

**Note** 

* [Null values are ignored](#null-values).
* `name` is an optional field that customizes the name of the aggregation metric in the response. If omitted, the
  default name is `min_<propertyApiName>`, e.g. `min_tenure`.

-------

### Sum of values (`sum`)

**Description**

Computes the sum of values for the provided field.

**Example**

```
{
  "aggregation": [
    {
      "type": "sum",
      "field": "properties.price",
      "name": "total_price"
    }
  ]
}
```

**Note** 

* [Null values are ignored](#null-values).
* `name` is an optional field that customizes the name of the aggregation metric in the response. If omitted, the
  default name is `sum_<propertyApiName>`, e.g. `sum_price`.

-------

### Average value (`avg`)

**Description**

Computes the average value for the provided field.

**Example**

```
{
  "aggregation": [
    {
      "type": "avg",
      "field": "properties.tenure",
      "name": "average_tenure"
    }
  ]
}
```

**Note** 

* [Null values are ignored](#null-values).
* `name` is an optional field that customizes the name of the aggregation metric in the response. If omitted, the
  default name is `avg_<propertyApiName>`, e.g. `avg_tenure`.

-------

### Approximate count of distinct values (`approximateDistinct`)

**Description**

Computes an approximate number of distinct values for the provided field.

**Example**

```
{
  "aggregation": [
    {
      "type": "approximateDistinct",
      "field": "properties.name",
      "name": "distinct_name_count"
    }
  ]
}
```

**Note** 

* [Null values are ignored](#null-values).
* `name` is an optional field that customizes the name of the aggregation metric in the response. If omitted, the
  default name is `approximateDistinct_<propertyApiName>`, e.g. `approximateDistinct_name`.

-------

## GroupBy types

### Exact groupBy type (`exact`)

**Description**

Divides objects into groups according to an exact value.

**Example**

```
{
  "aggregation": [...],
  "groupBy": [
    {
      "type": "exact",
      "field": "properties.country",
      "maxGroupCount": 10
    }
  ]
}
```

**Note**

* Supported types: all
* [Null values are ignored](#null-values).
* `maxGroupCount` is an optional field. If omitted, the default `maxGroupCount` is 10,000.

-------

### FixedWidth groupBy type (`fixedWidth`)

**Description**

Divides objects into groups with the specified width.

**Example**

```
{
  "aggregation": [...],
  "groupBy": [
    {
      "type": "fixedWidth",
      "field": "properties.age",
      "fixedWidth": 2
    }
  ]
}
```

**Note**

* Supported types: byte, decimal, double, float, integer, long
* [Null values are ignored](#null-values).

-------

### Ranges groupBy type (`ranges`)

**Description**

Divides objects into groups according to specified ranges.

Ranges are inclusive of their start values (`gte`) and exclusive of their end values (`lt`). For example, a range
matching birthdays from "2023-01-01" to "2023-02-01" will include January 31 birthdays but not February 1 birthdays.

**Example**

```
{
  "aggregation": [...],
  "groupBy": [
    {
      "type": "ranges",
      "field": "properties.birthday",
      "ranges": [
        {
          "gte": "2020-01-01",
          "lt": "2020-02-01"
        },
        {
          "gte": "2020-02-01",
          "lt": "2020-03-01"
        },
        {
          "gte": "2020-03-01",
          "lt": "2020-04-01"
        }
      ]
    }
  ]
}
```

**Note**

* Supported types: byte, date, decimal, double, float, integer, long, timestamp
* [Null values are ignored](#null-values).

-------

### Duration groupBy type (`duration`)

**Description**

Divides objects into groups according to a date or timestamp interval.

Durations are represented using ISO 8601 notation. For example, "P2DT3H4M5S" represents a duration of two days, three
hours, four minutes, and five seconds (or 183,845 seconds).

Groups in the response are named by the beginning of each interval. For example, when requesting a duration of `P2D`
over `reportDate`, the group "2022-10-01" in the response contains items with report dates of "2022-10-01" and
"2022-10-02".

**Example**

_Request_

```
{
  "aggregation": [...],
  "groupBy": [
    {
      "type": "duration",
      "field": "properties.reportDate",
      "duration": "P2D"
    }
  ]
}
```

_Response_

```
{
  "excludedItems": 0,
  "data": [
    {
      "group": {
        "properties.reportDate": "2022-10-01"
      },
      "metrics": [
        {
          "name": "min_stockPrice",
          "value": 200.04
        }
      ]
    },
    {
      "group": {
        "properties.reportDate": "2022-10-03"
      },
      "metrics": [
        {
          "name": "min_stockPrice",
          "value": 198.51
        }
      ]
    },
    {
      "group": {
        "properties.reportDate": "2022-10-05"
      },
      "metrics": [
        {
          "name": "min_stockPrice",
          "value": 197.3
        }
      ]
    }
  ]
}
```

**Note**

* Supported types: date, timestamp
* [Null values are ignored](#null-values).
* Date properties only support grouping by days (e.g. `P3D` but not `PT3H`).
* Timestamp properties support grouping by days, hours, minutes, and seconds (e.g. `PT10M` or `P3DT4H5M6S`).


## Null values

Null values are ignored in aggregations. This means:

* For any `groupBy` clause on a property, objects where that property is `null` will be excluded from the computation.
* For any `aggregation` clause on a property, objects where that property is `null` will be excluded from the computation.
* Since null properties are never included in `groupBy` or `aggregation` computations, aggregation results will not include a `null` group or a `null` metric value.
