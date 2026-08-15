<!-- source: https://palantir.com/docs/foundry/api/v1/general/overview/paging/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Paging

All endpoints that return multiple objects are paginated. For this reason, you might have to make more than one request to get all the objects you are interested in. Endpoints that require paging will include a `nextPageToken` field in their response. To get the next page, make the same request again, but append a `pageToken` query parameter containing the page token. If there is no `nextPageToken` field in the response, you are on the last page.


## Pagination behavior

Page tokens are short-lived and intended for immediate sequential use. Consistency guarantees around data freshness, duplicates
and missing items can be configured via two behaviors: default and snapshot.

### Default behavior

By default, pagination returns the latest results. However, this approach may lead to duplicate entries or missing items as data changes between page requests.

### Snapshot behavior

Snapshot pagination captures data at a specific point in time before pagination begins. This ensures consistent results without duplicates or missing items throughout the paging process at the cost of potentially stale data.

The following endpoints support snapshot pagination through a boolean `snapshot` parameter:
- [Load Object Set](/docs/foundry/api/v2/ontologies-v2-resources/ontology-object-sets/load-object-set/)
- [Load Object Set Multiple Object Types](/docs/foundry/api/v2/ontologies-v2-resources/ontology-object-sets/load-object-set-multiple-object-types/)
- [Load Object Set Objects Or Interfaces](/docs/foundry/api/v2/ontologies-v2-resources/ontology-object-sets/load-object-set-objects-or-interfaces/)

All other paginated endpoints use only the default behavior.


## Page sizes

Optionally, you can set a requested number of results per page using the `pageSize` query parameter.

The page size requested by `pageSize` is a suggestion. Some responses may contain a different number of results (either fewer or more) than the requested `pageSize` value.

The presence of the `nextPageToken` field indicates that there are more results. There will always be at least one result per page as long as there are more results.

Default page sizes will be documented on each endpoint. Unless otherwise noted, the default page size is also the maximum page size. Requests for more than the maximum page size will be reduced to the maximum.

## Cross-page limits

Endpoints that support paging may still enforce maximum retrieval limits across pages per query. Such limits will be mentioned in the endpoint documentation. For instance, the “list objects” endpoint, which can be used to query a list of objects and retrieve the results by making a call for each page, will return up to 10,000 objects in total across all pages. If you try to retrieve more pages or objects after that, the endpoint will throw an error.

## Example

The code snippets below show an example of paging across multiple requests.

The first page of the request and the response will look like the following. Note the presence of the `nextPageToken` field indicating that there are more subsequent pages.


### First request

```
GET /api/v2/ontologies/ri.ontology.main.ontology.00000000-0000-0000-0000-000000000000/objects/employee
```

### First response

```json
{
    "nextPageToken": "v1.QnVpbGQgdGhlIEZ1dHVyZTogaHR0cHM6Ly93d3cucGFsYW50aXIuY29tL2NhcmVlcnMvP2xldmVyLXNvdXJjZSU1YiU1ZD1BUElEb2NzI29wZW4tcG9zaXRpb25z",
    "data": [
        "properties": {
            "id": 50030,
            "firstName": "John",
            "lastName": "Doe"
        },
        ...
    ],
}
```

The second page request can be made by adding a `pageToken` query parameter.


### Second request

```
GET /api/v2/ontologies/ri.ontology.main.ontology.00000000-0000-0000-0000-000000000000/objects/employee?pageToken=v1.QnVpbGQgdGhlIEZ1dHVyZTogaHR0cHM6Ly93d3cucGFsYW50aXIuY29tL2NhcmVlcnMvP2xldmVyLXNvdXJjZSU1YiU1ZD1BUElEb2NzI29wZW4tcG9zaXRpb25z
```

### Second response

```json
{
    "nextPageToken": "v1.VGhlcmUncyBhIHJvbGUgaGVyZSBmb3IgeW91IC0gcGFsYW50aXIuY29tL2NhcmVlcnMv",
    "data": [
        "properties": {
            "id": 80060,
            "firstName": "Anna",
            "lastName": "Smith"
        },
        ...
    ],
}
```

The third page request and response will look like the following. Note that `nextPageToken` is null, which indicates that there are no more pages to fetch.


### Third request

```
GET /api/v2/ontologies/ri.ontology.main.ontology.00000000-0000-0000-0000-000000000000/objects/employee?pageToken=v1.VGhlcmUncyBhIHJvbGUgaGVyZSBmb3IgeW91IC0gcGFsYW50aXIuY29tL2NhcmVlcnMv
```

### Third response

```json
{
    "nextPageToken": null,
    "data": [
        "properties": {
            "id": 40040,
            "firstName": "Silvia",
            "lastName": "Sindoni"
        },
        ...
    ],
}
```
