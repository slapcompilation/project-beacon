<!-- source: https://palantir.com/docs/foundry/api/ontologies-v2-resources/time-series-properties/stream-points/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Stream Points

`POST /api/v2/ontologies/{ontology}/objects/{objectType}/{primaryKey}/timeseries/{property}/streamPoints`

Stream all of the points of a time series property.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."
- `objectType` · string · required
  "The API name of the object type. To find the API name, use the **List object types** endpoint or check the **Ontology Manager**."
- `primaryKey` · string · required
  "The primary key of the object with the time series property."
- `property` · string · required
  "The API name of the time series property. To find the API name for your time series property, check the **Ontology Manager** or use the **Get object type** endpoint."

## Query parameters

- `sdkPackageRid` · string
  "The package rid of the generated SDK."
- `sdkVersion` · string
  "The version of the generated SDK."
- `format` · enum
  one of `JSON`, `ARROW`
  "The output format to serialize the output binary stream in. Default is JSON. ARROW is more efficient than JSON at streaming a large sized response."

## Request

- `StreamTimeSeriesPointsRequest` · object · required
  - `range` · union
    "An absolute or relative range for a time series query."
    - `absolute` · object
      "ISO 8601 timestamps forming a range for a time series query. Start is inclusive and end is exclusive."
      - `startTime` · string
      - `endTime` · string
    - `relative` · object
      "A relative time range for a time series query."
      - `startTime` · object
        "A relative time, such as "3 days before" or "2 hours after" the current moment."
        - `when` · enum · required
          one of `BEFORE`, `AFTER`
        - `value` · integer · required
        - `unit` · enum · required
          one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
      - `endTime` · object
        "A relative time, such as "3 days before" or "2 hours after" the current moment."
        - `when` · enum · required
          one of `BEFORE`, `AFTER`
        - `value` · integer · required
        - `unit` · enum · required
          one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
  - `aggregate` · object
    - `method` · enum · required
      one of `SUM`, `MEAN`, `STANDARD_DEVIATION`, `MAX`, `MIN`, `PERCENT_CHANGE`, `DIFFERENCE`, `PRODUCT`, `COUNT`, `FIRST`, `LAST`
      "The aggregation function to use for aggregating time series data."
    - `strategy` · union · required
      "CUMULATIVE aggregates all points up to the current point. ROLLING aggregates all points in a rolling window whose size is either the specified number of points or time duration. PERIODIC aggregates all points in specified time windows."
      - `rolling` · object
        - `windowSize` · union · required
          "A rolling window is a moving subset of data points that ends at the current timestamp (inclusive) and spans a specified duration (window size). As new data points are added, old points fall out of the window if they are outside the specified duration. Rolling windows are commonly used for smoothing data, detecting trends, and reducing noise in time series analysis."
          - `duration` · object
            "A measurement of duration."
            - `value` · integer · required
              "The duration value."
            - `unit` · enum · required
              one of `NANOSECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`
              "The unit of a fixed-width duration. Each day is 24 hours and each week is 7 days."
          - `pointsCount` · object
            "Number of points in each window."
            - `count` · integer · required
      - `periodic` · object
        "Aggregates values over discrete, periodic windows for a given time series. A periodic window divides the time series into windows of fixed durations. For each window, an aggregate function is applied to the points within that window. The result is a time series with values representing the aggregate for each window. Windows with no data points are not included in the output. Periodic aggregation is useful for downsampling a continuous stream of data to larger granularities such as hourly, daily, monthly."
        - `windowSize` · object · required
          "A measurement of duration."
          - `value` · integer · required
            "The duration value."
          - `unit` · enum · required
            one of `NANOSECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`
            "The unit of a fixed-width duration. Each day is 24 hours and each week is 7 days."
        - `alignmentTimestamp` · string
          "The timestamp used to align the result, such that ticks in the result time series will lie at integer multiples of the window duration from the alignment timestamp. Default is the first epoch timestamp (January 1, 1970, 00:00:00 UTC) so that all aggregated points have timestamps at midnight UTC at the start of each window duration. For example, for a weekly aggregate with alignment timestamp 5 January, 8:33PM, each aggregated timestamp will lie on the 7 day intervals at 8:33PM starting at 5 January."
        - `windowType` · enum · required
          one of `START`, `END`
      - `cumulative` · object
        "The cumulative aggregate is calculated progressively for each point in the input time series, considering all preceding points up to and including the current point."

## Response

- `body` · string · required
  "Success response."
