<!-- source: https://palantir.com/docs/foundry/api/ontology-resources/objects/list-linked-objects/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Linked Objects

`GET /api/v1/ontologies/{ontologyRid}/objects/{objectType}/{primaryKey}/links/{linkType}`

Lists the linked objects for a specific object and the given link type.

This endpoint supports filtering objects.
See the [Filtering Objects documentation](/docs/foundry/api/ontology-resources/objects/ontology-object-basics#filter-objects) for details.

Note that this endpoint does not guarantee consistency. Changes to the data could result in missing or
repeated objects in the response pages.

For Object Storage V1 backed objects, this endpoint returns a maximum of 10,000 objects. After 10,000 objects have been returned and if more objects
are available, attempting to load another page will result in an `ObjectsExceededLimit` error being returned. There is no limit on Object Storage V2 backed objects.

Each page may be smaller or larger than the requested page size. However, it
is guaranteed that if there are more results available, at least one result will be present
in the response.

Note that null value properties will not be returned.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontologyRid` · string · required
  "The unique Resource Identifier (RID) of the Ontology that contains the objects. To look up your Ontology RID, please use the **List ontologies** endpoint or check the **Ontology Manager**."
- `objectType` · string · required
  "The API name of the object from which the links originate. To find the API name, use the **List object types** endpoint or check the **Ontology Manager**."
- `primaryKey` · string · required
  "The primary key of the object from which the links originate. To look up the expected primary key for your object type, use the `Get object type` endpoint or the **Ontology Manager**."
- `linkType` · string · required
  "The API name of the link that exists between the object and the requested objects. To find the API name for your link type, check the **Ontology Manager**."

## Query parameters

- `pageSize` · integer
  "The desired size of the page to be returned. Defaults to 1,000. See [page sizes](/docs/foundry/api/general/overview/paging/#page-sizes) for details."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
- `properties` · list
  "The properties of the object type that should be included in the response. Omit this parameter to get all the properties."
  - `SelectedPropertyApiName` · string · required
    "By default, whenever an object is requested, all of its properties are returned, except for properties of the following types: - Vector The response can be filtered to only include certain properties using the `properties` query parameter. Note that ontology object set endpoints refer to this parameter as `select`. Properties to include can be specified in one of two ways. - A comma delimited list as the value for the `properties` query parameter `properties={property1ApiName},{property2ApiName}` - Multiple `properties` query parameters. `properties={property1ApiName}&properties={property2ApiName}` The primary key of the object will always be returned even if it wasn't specified in the `properties` values. Unknown properties specified in the `properties` list will result in a `PropertiesNotFound` error. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
- `orderBy` · string
  "A command representing the list of properties to order by. Properties should be delimited by commas and prefixed by `p` or `properties`. The format expected format is `orderBy=properties.{property}:{sortDirection},properties.{property}:{sortDirection}...` By default, the ordering for a property is ascending, and this can be explicitly specified by appending `:asc` (for ascending) or `:desc` (for descending). Example: use `orderBy=properties.lastName:asc` to order by a single property, `orderBy=properties.lastName,properties.firstName,properties.age:desc` to order by multiple properties. You may also use the shorthand `p` instead of `properties` such as `orderBy=p.lastName:asc`."

## Response

- `ListLinkedObjectsResponse` · object · required
  "Success response."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
  - `data` · list
    - `OntologyObject` · object · required
      "Represents an object in the Ontology."
      - `properties` · map
        "A map of the property values of the object."
        - `PropertyApiName` · string · required
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `PropertyValue` · any · required
          "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
      - `rid` · string · required
        "The unique resource identifier of an object, useful for interacting with other Foundry APIs."
