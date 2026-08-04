<!-- source: https://palantir.com/docs/foundry/functions/python-functions-create-custom-aggregation/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Create a custom aggregation

Functions can be used to compute custom aggregations based on data in the ontology, which can then be surfaced in a chart widget in Workshop. This guide walks through how to write custom aggregation logic that loads aggregated data from the ontology, manipulates the results to create a projection of future results, and returns the modified results.

These references may be useful while working through this section:

* Reference for [Python aggregation types](/docs/foundry/functions/types-reference/#aggregation-types)

:::callout{theme="warning"}
`.from_osdk()` in `TwoDimensionalAggregation` and `ThreeDimensionalAggregation` are only supported when using v2 of the Python OSDK.
:::

## Loading an aggregation

In this example, assume you have an ontology consisting of expenses, with each `expense` object having properties for department name, expense `date`, and expense `amount`. If you want to estimate the monthly spend by department over the next six months, you can begin by loading the aggregated data for the monthly spend:

```python
client = FoundryClient()
result: AggregateObjectsResponse = (
    client.ontology.objects.Expense
    .group_by(Expense.object_type.department_name.exact())
    .group_by(Expense.object_type.date.exact())
    .sum(Expense.object_type.amount)
    .compute()
)
```

## Manipulating aggregation results

Next, you can extrapolate the spend for each department for the next six months. For this example, you can take a simple approach of using the final month's value as the estimate for the next six months.

```python
current_buckets = ThreeDimensionalAggregation.from_osdk(result, "departmentName", "date")
modified_buckets: list[NestedBucket[str, Range[Date], Double]] = []
date_format = "%Y-%m-%d"
for bucket in current_buckets.buckets:
    # Find the bucket corresponding to the most recent month
    last_bucket: SingleBucket[Date, Double] = bucket[-1].value

    next_six_months: list[SingleBucket[Range[Date], Double]] = []
    # The `date` field has been converted to a string formatted YYYY-MM-DD.
    # Convert to type `Date` from the string. Convert back to a string when
    # creating a SingleBucket object for each month
    current_month: Date = datetime.strptime(last_bucket.key, date_format).date()

    # Loop six times
    for _ in range(6):
        # Construct the next month from the current month
        next_month = current_month + relativedelta(months=1)
        # Add a new bucket which uses the next month as the date range
        # and the most recent months amount as the value
        next_six_months.append(SingleBucket(Range(min=current_month, max=next_month), last_bucket.value))
        current_month = next_month

    # Append the modified results as a NestedBucket
    modified_buckets.append(NestedBucket(bucket.key, next_six_months))
```

## Returning the aggregation

Now that you have created an estimate for the next six months, you can return these estimated values as a `ThreeDimensionalAggregation`:

```python
return ThreeDimensionalAggregation(modified_buckets)
```

The full example code for this function is as follows:

```python
from dateutil.relativedelta import relativedelta
from datetime import datetime

from functions.api import (
    Date,
    Double,
    NestedBucket,
    SingleBucket,
    String,
    Range,
    ThreeDimensionalAggregation,
    function,
)
from ontology_sdk import FoundryClient
from ontology_sdk.ontology.objects import Expense


@function
def estimated_department_expenses() -> ThreeDimensionalAggregation[str, Date, Double]:
    client = FoundryClient()
    result = (
        client.ontology.objects.Expense
        .group_by(Expense.object_type.department_name.exact())
        .group_by(Expense.object_type.date.exact())
        .sum(Expense.object_type.amount)
        .compute()
    )

    current_buckets = ThreeDimensionalAggregation.from_osdk(result, "departmentName", "date")
    modified_buckets: list[NestedBucket[str, Range[Date], Double]] = []
    date_format = "%Y-%m-%d"
    for bucket in current_buckets.buckets:
        # Find the bucket corresponding to the most recent month
        last_bucket: SingleBucket[Date, Double] = bucket.buckets[-1]

        next_six_months: list[SingleBucket[Range[Date], Double]] = []
        # The `date` field has been converted to a string formatted YYYY-MM-DD.
        # Convert to type `Date` from the string.
        current_month: Date = datetime.strptime(last_bucket.key, date_format).date()

        # Loop six times
        for _ in range(6):
            # Construct the next month from the current month
            next_month = current_month + relativedelta(months=1)
            # Add a new bucket which uses the next month as the date range
            # and the most recent months amount as the value
            next_six_months.append(SingleBucket(Range(min=current_month, max=next_month), last_bucket.value))
            current_month = next_month

        # Append the modified results as a NestedBucket
        modified_buckets.append(NestedBucket(bucket.key, next_six_months))

    return ThreeDimensionalAggregation(modified_buckets)
```

The resulting aggregation can be used in a Workshop chart to show the monthly spend estimate for the next six months.
