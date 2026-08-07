<!-- source: https://palantir.com/docs/foundry/time-series/time-series-in-functions/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Time series in Functions

Functions supports operations on time series properties. In this page, we cover how to set up and use time series properties in functions.

## Initial set up

To use time series in Functions, you will need to have already stored time series in the Ontology. You can follow the steps outlined [here](/docs/foundry/time-series/time-series-setup/) to get started.

Once your time series are stored in the ontology, we need to [create a code repository](/docs/foundry/functions/getting-started/) for our time series Functions. In this repository, we start by [importing Ontology types](/docs/foundry/functions/foo-getting-started/#import-ontology-types) so we can reference the time series stored in these Ontology types.

Now you're ready to work with time series in Functions.

## Working with time series in Functions

To access time series in Functions, start by creating an [object-backed Function](/docs/foundry/functions/foo-getting-started/#add-an-object-backed-function) in your code repository. These functions can directly access the time series properties in your Ontology. Once you have written a Function, there are two ways to run your new function. You can either [test your Function in live preview](/docs/foundry/functions/foo-getting-started/#test-in-live-preview) or [publish your Function](/docs/foundry/functions/foo-getting-started/#publish-the-new-function) and start using it in other applications throughout the platform.

### Python functions

:::callout{theme="warning"}
The [FoundryTS library](/docs/foundry/foundryts/overview/) is not compatible with functions. Instead, the Python OSDK offers an alternative for accessing time series data through Ontology properties.
:::

#### Access data

The [Python OSDK](/docs/foundry/ontology-sdk/python-osdk/) allows you to read data points from time series properties (TSPs) into pandas or Polars DataFrames.

The DataFrame contains two columns:

| Column name   | Type              | Description            |
|---------------|-------------------|------------------------|
| timestamp     | pandas.Timestamp | polars.datatypes.Datetime  | Timestamp of the point |
| value         | Union\[float, str] | Value of the point     |

```py
@function
def aircraft_altimeter_mean(aircraft: Aircraft) -> float:
    """Get the mean of altimeter readings for a given Ontology aircraft object."""
    df = aircraft.altimeter.to_pandas(all_time=True)
    return df["value"].mean()
```

```py
@function
def aircraft_altimeter_mean(aircraft: Aircraft) -> float:
    """Get the mean of altimeter readings for a given Ontology aircraft object."""
    df = aircraft.altimeter.to_polars(all_time=True)
    return df.select(pl.col("value").mean()).item()
```

#### Return time series

To return time series data from a Python function, import the `timeseries_sdk` library and use the `TimeSeries.serialize` method to format your return DataFrame as a `list[bytes]`. You can then visualize this using the [code function time series card in Quiver](/docs/foundry/quiver/card-code-function-timeseries/).

:::callout{theme="warning"}
Categorical time series outputs are not supported.
:::

```py
import pandas as pd
from timeseries_sdk.functions.types import TimeSeries
from ontology_sdk.ontology.objects import Aircraft

@function
def sample_series() -> list[bytes]:
    df = pandas.DataFrame({
        "timestamp": [
            pd.Timestamp("2025-03-19 08:00:00"),
            pd.Timestamp("2025-03-19 09:00:00"),
            pd.Timestamp("2025-03-19 10:00:00")
        ],
        "value": [1.0, 2.0, 2.5]
    })
    return TimeSeries.serialize(df)

@function
def normalized_altimeter_rate(aircraft: Aircraft) -> list[bytes]:
    """
    Read an aircraft's altimeter TSP, smooth it, compute its rate of change,
    then normalize by the maximum absolute rate.
    """
    df = aircraft.altimeter.to_pandas(all_time=True)
    if df.empty:
        return TimeSeries.serialize(df)

    df["value"] = df["value"].rolling(window=10, min_periods=1).mean()

    time_diff_seconds = df["timestamp"].diff().dt.total_seconds()
    df["value"] = (df["value"].diff() / time_diff_seconds).fillna(0)

    max_abs_rate = df["value"].abs().max()
    if max_abs_rate > 0:
        df["value"] = df["value"] / max_abs_rate

    return TimeSeries.serialize(df)
```

### TypeScript functions

The following sections provide examples of common TypeScript function operations.

#### Return the first or last point

Since functions do not have a built-in type for time series points, you can instead return the value or the timestamp. For example, the following function reads the latest temperature on a machine:

```ts
    @Function()
    public async getLatestTemperature(machine: MachineRoot): Promise<Double | undefined> {
        const latest = await machine.temperatureId?.getLastPointV2();
        return latest?.value;
    }
```

You can similarly get the first temperature reading with the following function:

```ts
    @Function()
    public async getEarliestTemperature(machine: MachineRoot): Promise<Double | undefined> {
        const earliest = await machine.temperatureId?.getFirstPointV2();
        return earliest?.value;
    }
```

#### Aggregate over a series

One useful aggregation is to compute the average over a range of points. Consider the following function that gets the average temperature of an example machine:

```ts
    @Function()
    public async getAverageTemperature(machine: MachineRoot): Promise<Double | undefined> {
        const aggregation = await machine.temperatureId?.aggregate()
            .overEntireRange()
            .mean()
            .compute();
        return aggregation?.mean!;
    }
```

#### Take the derivative

Building on the example above, you can also retrieve the average change in temperature on the same machine by using the following compute function:

```ts
    @Function()
    public async getAverageTemperature(machine: MachineRoot): Promise<Double | undefined> {
        const aggregation = await machine.temperatureId?.derivative()
            .aggregate()
            .overEntireRange()
            .mean()
            .compute();
        return aggregation?.mean;
    }
```

#### Specify a time range

You can apply other transforms in addition to derivatives to a time series. The following is an example of how you can apply timestamp parameters as a range on a time series:

```ts
    @Function()
    public async getAverageTemperatureOverRange(
        machine: MachineRoot,
        start: Timestamp,
        end: Timestamp): Promise<Double | undefined>
    {
        const latest = await machine.temperatureId?.timeRange({min: start, max: end})
            .aggregate()
            .overEntireRange()
            .mean()
            .compute();
        return latest?.mean;
    }
```

### TypeScript V2 functions

The following section provides an example of common TypeScript V2 function operations.

## Loading time series points

Stream all the points in the time series property. If a range is provided, only points that fall within the given range are returned.

```ts
import { Osdk } from "@osdk/client";
import { ObjectTypeEx } from "@ontology/sdk";
import { TimeSeriesPoint } from "@osdk/api";

function timeSeriesExample(obj: Osdk.Instance<ObjectTypeEx>) {
  //   const obj = await client(ObjectTypeEx).fetchOne("someObjectPk"); could also get the obj this way

  const allPointsPromise = obj.timeseriesProp?.getAllPoints();

  const relativeTimeRangePromise = obj.timeseriesProp?.getAllPoints({
    $before: 1, // could do before or after
    $unit: "hours",
  }); // options are milliseconds, seconds, minutes, hours, days, weeks, months, years

  const absoluteTimeRangePromise = obj.timeseriesProp?.getAllPoints({
    $startTime: "2022-08-13T12:34:56Z",
    $endTime: "2022-08-14T12:34:56Z",
  });

  const firstPointPromise = obj.timeseriesProp?.getFirstPoint();

  const lastPointPromise = obj.timeseriesProp?.getLastPoint();

  // example for loading vars
  const [relativeTimeRange, firstPoint] = await Promise.all([
    relativeTimeRangePromise,
    firstPointPromise,
  ]);

  const ts: TimeSeriesPoint<number> | undefined = firstPoint;
  relativeTimeRange?.forEach((point) => {
    console.log(point.value);
    console.log(point.time); // "2022-08-13T12:34:56Z" ISO 8601 timestamp string
  });
}
```
