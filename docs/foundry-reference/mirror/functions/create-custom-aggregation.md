<!-- source: https://palantir.com/docs/foundry/functions/create-custom-aggregation/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Create a custom aggregation

Functions can be used to compute custom aggregations based on data in the ontology, which can then be surfaced in a chart widget in Workshop. This guide walks through how to write custom aggregation logic that loads aggregated data from the ontology, manipulates the results to create a projection of future results, and returns the modified results.

These references may be useful while working through this section:

* Reference for [Object Set aggregations](/docs/foundry/functions/api-object-sets/#computing-aggregations)
* Reference for [aggregation types](/docs/foundry/functions/types-reference/#aggregation-types)

## Loading an aggregation

In this example, assume you have an ontology consisting of expenses, with each `expense` object having properties for department name, expense `date`, and expense `amount`. If you want to estimate the monthly spend by department over the next six months, you can begin by loading the aggregated data for the monthly spend:

```typescript
const result = await Objects.search()
    .expenses()
    .groupBy(expense => expense.departmentName.topValues())
    .segmentBy(expense => expense.date.byMonth())
    .sum(expense => expense.amount);
```

## Manipulating aggregation results

Next, you can extrapolate the spend for each department for the next six months. For this example, you can take a simple approach of using the final month's value as the estimate for the next six months.

```typescript
const modifiedBuckets = result.buckets.map(bucket => {
    // Find the bucket corresponding to the most recent month
    const lastBucket = bucket.value[bucket.value.length - 1];

    let nextSixMonths: IBaseBucket<IRange<Timestamp>, Double>[] = [];
    let currentMonth = lastBucket.key.max!;
    // Loop six times
    for (let i = 0; i < 6; i++) {
        // Find the end of this range (the following month)
        const nextMonth = currentMonth.plusMonths(1);
        // Add a new bucket which uses the next month as the date range
        // and the most recent month as the value
        nextSixMonths.push({
            key: {
                min: currentMonth,
                max: nextMonth,
            },
            value: lastBucket.value,
        });
        currentMonth = nextMonth;
    }

    // Return the modified results
    return { key: bucket.key, value: nextSixMonths };
});
```

## Returning the aggregation

Now that you have created an estimate for the next six months, you can return these estimated values:

```typescript
return { buckets: modifiedBuckets };
```

The full example code for this function is as follows:

```typescript
@Function()
public async estimatedDepartmentExpenses(): Promise<ThreeDimensionalAggregation<string, IRange<Timestamp>>> {
    const result = await Objects.search()
        .expenses()
        .groupBy(expense => expense.departmentName.topValues())
        .segmentBy(expense => expense.date.byMonths())
        .sum(expense => expense.amount);

    const modifiedBuckets = result.buckets.map(bucket => {
        // Find the bucket corresponding to the most recent month
        const lastBucket = bucket.value[bucket.value.length - 1];

        let nextSixMonths: IBaseBucket<IRange<Timestamp>, Double>[] = [];
        let currentMonth = lastBucket.key.max!;
        // Loop six times
        for (let i = 0; i < 6; i++) {
            // Find the end of this range (the following month)
            const nextMonth = currentMonth.plusMonths(1);
            // Add a new bucket which uses the next month as the date range
            // and the most recent month as the value
            nextSixMonths.push({
                key: {
                    min: currentMonth,
                    max: nextMonth,
                },
                value: lastBucket.value,
            });
            currentMonth = nextMonth;
        }

        // Return the modified results
        return { key: bucket.key, value: nextSixMonths };
    });

    return { buckets: modifiedBuckets };
}
```

The resulting aggregation can be used in a Workshop chart to show the monthly spend estimate for the next six months.
