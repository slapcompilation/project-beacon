<!-- source: https://palantir.com/docs/foundry/quiver/timeseries-aggregations/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Time series aggregations

Quiver supports several time series aggregations that can operate on either one or several series at a time.

## Single series aggregate

Single series aggregates operate on a single, continuous, time series producing one aggregated value for each specified *time window*.

### Supported aggregation options

The following options are supported:

* **Sum:** Sum of all points in each window.
* **Mean:** Average of all points in each window.
* **Standard deviation:** Standard deviation of all points in each window.
* **Max:** Largest value in each window.
* **Min:** Smallest value in each window.
* **Difference:** Difference between the last point and first point in each window.
* **Relative difference:** Percent change between the last point and first point in each window.
* **Product:** Product of all points in each window.
* **Count:** Number of points in each window.
* **First:** Value of the first point in each window.
* **Last:** Value of the last point in each window.
* **Time-weighted average:** Average value of the series across each window, weighted by the duration each point is in effect. See [Time-weighted aggregates](#time-weighted-aggregates) for additional configuration.
* **Integral:** Area under the curve across each window. See [Time-weighted aggregates](#time-weighted-aggregates) for additional configuration.

### Quiver cards using this aggregate

* [**Cumulative aggregate:**](/docs/foundry/quiver/card-cumulative-aggregate/) This card applies a data point aggregation for each point in the input series, where the time window ranges from the start of the series to the current point (inclusive).
* [**Periodic aggregate:**](/docs/foundry/quiver/card-periodic-aggregate/) This card divides the time series into contiguous time windows of fixed duration and applies a data point aggregation to each. Windows with no data points are not included in the output.
* [**Rolling aggregate:**](/docs/foundry/quiver/card-rolling-aggregate/) This card applies a data point aggregation for each point in the input series where the time window ends at the current timestamp (inclusive) and spans a specified duration. As new data points are added to the window, old points fall out of it if they are outside the specified duration.
* [**Time series numeric aggregation:**](/docs/foundry/quiver/card-time-series-numeric-aggregation/) This card applies a data point aggregation to a single time window spanning the entire series.
* [**Time series scatter plot:**](/docs/foundry/quiver/card-time-series-scatter-plot/) This card uses a periodic aggregate.
* [**Bollinger bands:**](/docs/foundry/quiver/card-bollinger-bands/) This card uses a rolling aggregate.

## Multi-series aggregate

Multi-series aggregates align multiple continuous time series and combine one value from each series producing an aggregated value for each timestamp.

### Supported aggregation options

The following options are supported:

* **Sum:** Sum of points across all series at each timestamp.
* **Mean:** Average of points across all series at each timestamp.
* **Standard deviation:** Standard deviation of points across all series at each timestamp.
* **Max:** Largest value in any series at each timestamp.
* **Min:** Smallest value in any series at each timestamp.
* **Product:** Product of points across all series at each timestamp.

### Quiver cards using this aggregate

* [**Linear aggregation**](/docs/foundry/quiver/card-linear-aggregation/)
* [**Linked series aggregation**](/docs/foundry/quiver/card-linked-series-aggregation/)
* [**Time series formula:**](/docs/foundry/quiver/card-time-series-formula/) This card allows you to perform most of the operations in the above list, but with mathematical operators.

## Interval aggregate

Interval aggregates operate on an interval time series which can be produced via the [Filter time series](/docs/foundry/quiver/card-filter-time-series/) card. They produce one aggregated value for each interval in the series. Aggregates are *inclusive* of points at the start timestamp of each interval and *exclusive* of points at the end timestamp.

### Supported aggregation options

The following options are supported:

* **Sum:** Sum of all points in each interval.
* **Mean:** Average of all points in each interval.
* **Standard deviation:** Standard deviation of all points in each interval.
* **Max:** Largest value in each interval.
* **Min:** Smallest value in each interval.
* **Difference:** Difference between the last point and first point in each interval.
* **Relative difference:** Percent change between the last point and first point in each interval.
* **Product:** Product of all points in each interval.
* **Count:** Number of points in each interval.
* **First:** Value of the first point in each interval.
* **Last:** Value of the last point in each interval.
* **Duration:** Length of each interval in the precision that the time series is configured with (usually milliseconds).
* **Rate change:** Difference between the last point and first point in each interval divided by the interval's length in the precision that the time series is configured with (usually milliseconds).
* **Time-weighted average:** Average value of the series across each interval, weighted by the duration each point is in effect. See [Time-weighted aggregates](#time-weighted-aggregates) for additional configuration.
* **Integral:** Area under the curve across each interval. See [Time-weighted aggregates](#time-weighted-aggregates) for additional configuration.

### Quiver cards using this aggregate

* [**Segment statistics**](/docs/foundry/quiver/card-segment-statistics/)
* [**Event statistics**](/docs/foundry/quiver/card-event-statistics/)

## Time-weighted aggregates

Standard aggregations treat each data point equally. Time-weighted aggregations instead weight each point by the duration it is in effect. This is the appropriate choice for series sampled at irregular intervals, such as a sensor reading or a status value held until the next update.

Time-weighted aggregations are available wherever single series and interval aggregates are supported:

* **Time-weighted average:** Mean value of the series across the window, weighted by how long each value is in effect. Equivalent to the area under the curve divided by the duration of the window.
* **Integral:** Area under the curve across the window.

Time-weighted aggregations are not available for [multi-series aggregates](#multi-series-aggregate).

When you select a time-weighted aggregation, two additional options are exposed: **Integration method** and **Bounds interpolation**.

### Integration method

The **Integration method** controls how the area between two adjacent data points is computed:

* **Linear:** Connects adjacent points with a straight line and integrates the resulting trapezoid. Use this option when the underlying value changes smoothly between samples.
* **Left-hand side (LHS):** Holds the earlier point's value constant until the next point arrives. Use this option when each point represents the value that started at its timestamp.
* **Right-hand side (RHS):** Holds the later point's value constant back to the previous point. Use this option when each point represents the value that ended at its timestamp.

The standalone [Integral](/docs/foundry/quiver/card-integral/) card exposes the same options.

### Bounds interpolation

By default, only the area between data points that fall inside the window contributes to a time-weighted aggregate. Any gap between a window boundary and the nearest interior point is ignored, which can understate aggregates for windows that do not align with the sampling timestamps of the series.

The **Bounds interpolation** option controls how the curve is extended to the window boundaries when those boundaries do not coincide with an existing data point:

* **None:** No extrapolation is performed. Only the area between data points strictly inside the window contributes to the aggregate. This is the default.
* **Linear:** Linearly interpolate between the point outside the window and the nearest point inside the window to derive a value at the boundary.
* **Nearest:** Use the value of the nearest point on either side of the boundary.
* **Previous:** Use the value of the previous point, holding it constant up to the boundary.
* **Next:** Use the value of the next point, holding it constant back to the boundary.

When a method other than **None** is selected, the portion of the window between each boundary and its nearest interior point contributes to the aggregate using the interpolated boundary value.
