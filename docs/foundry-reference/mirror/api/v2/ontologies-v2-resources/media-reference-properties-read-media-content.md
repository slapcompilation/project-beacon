<!-- source: https://palantir.com/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/read-media-content/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Read Media Content

`GET /api/v2/ontologies/{ontology}/objects/{objectType}/{primaryKey}/media/{property}/content`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets the content of a media item referenced by this property.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."
- `objectType` · string · required
  "The API name of the object type. To find the API name, use the **List object types** endpoint or check the **Ontology Manager**."
- `primaryKey` · string · required
  "The primary key of the object with the media reference property."
- `property` · string · required
  "The API name of the media reference property. To find the API name, check the **Ontology Manager** or use the **Get object type** endpoint."

## Query parameters

- `sdkPackageRid` · string
  "The package rid of the generated SDK."
- `sdkVersion` · string
  "The version of the generated SDK."
- `branch` · string
  "The Foundry branch to read from. If not specified, the default branch will be used."
- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Response

- `body` · string · required
  "The content stream."
