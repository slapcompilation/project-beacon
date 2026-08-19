<!-- source: https://palantir.com/docs/foundry/api/ontologies-v2-resources/time-series-properties/get-last-point/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Last Point

`GET /api/v2/ontologies/{ontology}/objects/{objectType}/{primaryKey}/timeseries/{property}/lastPoint`

Get the last point of a time series property.


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

## Response

- `TimeSeriesPoint` · object · required
  "Success response."
  - `time` · string · required
    "An ISO 8601 timestamp"
  - `value` · any · required
    "An object which is either an enum String or a double number."
