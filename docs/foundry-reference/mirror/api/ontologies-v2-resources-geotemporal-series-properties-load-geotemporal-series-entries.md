<!-- source: https://palantir.com/docs/foundry/api/ontologies-v2-resources/geotemporal-series-properties/load-geotemporal-series-entries/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Load Geotemporal Series Entries

`POST /api/v2/ontologies/{ontology}/objects/{objectType}/{primaryKey}/geotemporalSeries/{property}/loadEntries`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Load the geotemporal series entries for a given object's geotemporal series reference property within the
specified time range.

Each entry in the response is a map of property names to values, following the same structure as
`OntologyObjectV2`. Use the `additionalProperties` field in the request to control which properties are included
in each entry depending on the underlying geotemporal integration.

Results are paginated. Use the `nextPageToken` from the response to retrieve subsequent pages.

:::callout{theme=warning title=Warning}
  Geotemporal series integrations with only "cold storage" enabled are not supported.
:::


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."
- `objectType` · string · required
  "The API name of the object type. To find the API name, use the **List object types** endpoint or check the **Ontology Manager**."
- `primaryKey` · string · required
  "The primary key of the object with the geotemporal series property."
- `property` · string · required
  "The API name of the geotemporal series property. To find the API name for your property, check the **Ontology Manager** or use the **Get object type** endpoint."

## Query parameters

- `sdkPackageRid` · string
  "The package RID of the generated SDK."
- `sdkVersion` · string
  "The version of the generated SDK."
- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Request

- `LoadGeotemporalSeriesRequest` · object · required
  "The request body for loading entries from a geotemporal series reference property. A geotemporal series represents time-indexed geographic observations for an object, such as the location history of a vehicle or aircraft. Each entry in the response is a map of property names to values, following the same structure as `OntologyObjectV2`. The `range` field is required and restricts results to a specific time window. Both `startTime` and `endTime` are required on `range`. The `additionalProperties` field controls which additional properties appear in each returned entry. Results are paginated; use `pageToken` from a previous response to retrieve additional pages."
  - `range` · object · required
    "ISO 8601 timestamps forming a range for a time series query. Start is inclusive and end is exclusive."
    - `startTime` · string
    - `endTime` · string
  - `additionalProperties` · list
    "The additional property API names to include in each entry. The "time" and "position" properties are always included and do not need to be specified here. Use this to request additional geotemporal series metadata properties such as "speed" or "heading". Properties that are not available for the underlying geotemporal integration will be omitted from the response entries."
    - `SelectedPropertyApiName` · string · required
      "By default, whenever an object is requested, all of its properties are returned, except for properties of the following types: - Vector The response can be filtered to only include certain properties using the `properties` query parameter. Note that ontology object set endpoints refer to this parameter as `select`. Properties to include can be specified in one of two ways. - A comma delimited list as the value for the `properties` query parameter `properties={property1ApiName},{property2ApiName}` - Multiple `properties` query parameters. `properties={property1ApiName}&properties={property2ApiName}` The primary key of the object will always be returned even if it wasn't specified in the `properties` values. Unknown properties specified in the `properties` list will result in a `PropertiesNotFound` error. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
  - `pageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
  - `pageSize` · integer
    "The page size to use for the endpoint."

## Response

- `LoadGeotemporalSeriesResponse` · object · required
  "Success response."
  - `data` · list
    - `GeotemporalSeriesEntry` · map · required
      "A single geotemporal data point. Each entry is a map from property API names to property values. Standard entries include "time" (ISO 8601 timestamp) and "position" (GeoPoint), and may include additional geotemporal series metadata fields such as speed, heading, or altitude."
      - `PropertyApiName` · string · required
        "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
      - `PropertyValue` · any · required
        "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
