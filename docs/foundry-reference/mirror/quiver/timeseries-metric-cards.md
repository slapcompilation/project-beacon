<!-- source: https://palantir.com/docs/foundry/quiver/timeseries-metric-cards/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Get metrics from time series

Quiver offers the ability to compute single-value metrics on time series and use these values in future operations.

## Computing metrics

From a numeric time series, you can use the [time series numeric aggregation](/docs/foundry/quiver/card-time-series-numeric-aggregation/) to create an aggregation such as an average or maximum. For example, imagine you have a time series for the temperature in a certain city for the last 30+ years. You can use a time series numeric aggregation to calculate the standard deviation of that series as follows:

1. Hover over the card to open the next actions menu.
2. Choose the **Compute metrics** category and select the **time series numeric aggregation** card.
3. In the editor for the **time series numeric aggregation** card, choose the input time series and select the intended aggregate type.

![Creating a numeric aggregation for time series](/docs/resources/foundry/quiver/time-series-numeric-aggregation.gif)

If you want to compute the aggregation over a certain time range, you can use the [filter time series](/docs/foundry/quiver/card-filter-time-series/) card to first filter your series to the intended range. Then you can pass the resulting series as input to the numeric aggregation card.

## Using computed metrics

You can also use these computed metrics in downstream cards as numeric inputs. For example, you can filter the city temperature time series mentioned above to the "extreme" temperatures (days with a temperature more than one standard deviation away from the average) by following these steps:

1. Choose the **filter time series** card from the next actions menu and select your initial plot as the input time series.
2. Input a filter condition which triggers when the source plot satisfies one of two conditions:

* The value is less than the average temperature *minus* the standard deviation.
* The value is greater than the average temperature *plus* the standard deviation.

This results in a filtered time series containing only the days with temperatures more than one standard deviation away from the average.

![Using the computed metrics to filter a series](/docs/resources/foundry/quiver/time-series-filter-on-aggregation-values.gif)
