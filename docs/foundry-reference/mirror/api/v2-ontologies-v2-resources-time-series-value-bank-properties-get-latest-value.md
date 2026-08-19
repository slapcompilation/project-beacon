<!-- source: https://palantir.com/docs/foundry/api/v2/ontologies-v2-resources/time-series-value-bank-properties/get-latest-value/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Latest Value

`GET /api/v2/ontologies/{ontology}/objects/{objectType}/{primaryKey}/timeseries/{propertyName}/latestValue`

Get the latest value of a property backed by a timeseries. If a specific geotime series integration has both a history and a live integration, we will give precedence to the live integration.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."
- `objectType` · string · required
  "The API name of the object type. To find the API name, use the **List object types** endpoint or check the **Ontology Manager**."
- `primaryKey` · string · required
  "The primary key of the object with the timeseries property."
- `propertyName` · string · required
  "The API name of the timeseries property. To find the API name for your property value bank property, check the **Ontology Manager** or use the **Get object type** endpoint."

## Query parameters

- `sdkPackageRid` · string
  "The package rid of the generated SDK."
- `sdkVersion` · string
  "The version of the generated SDK."
- `branch` · string
  "The Foundry branch to read from. If not specified, the default branch will be used."

## Response

- `TimeseriesEntry` · object · required
  "Success response."
  - `time` · string · required
    "An ISO 8601 timestamp"
  - `value` · any · required
    "An object which is either an enum String, double number, or a geopoint."
