<!-- source: https://palantir.com/docs/foundry/api/ontologies-v2-resources/time-series-value-bank-properties/stream-values/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Stream Values

`POST /api/v2/ontologies/{ontology}/objects/{objectType}/{primaryKey}/timeseries/{property}/streamValues`

Stream all of the points of a time series property (this includes geotime series references).


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
  "The API name of the time series backed property. To find the API name, check the **Ontology Manager** or use the **Get object type** endpoint."

## Query parameters

- `sdkPackageRid` · string
  "The package rid of the generated SDK."
- `sdkVersion` · string
  "The version of the generated SDK."
- `branch` · string
  "The Foundry branch to read from. If not specified, the default branch will be used."

## Request

- `StreamTimeSeriesValuesRequest` · object · required
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

## Response

- `body` · string · required
  "Success response."
