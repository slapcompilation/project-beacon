<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/model-functions/get-model-function/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Model Function

`GET /api/v2/models/{modelRid}/function`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets the function for the model.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Path parameters

- `modelRid` · string · required
  "The Resource Identifier (RID) of a Model."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ModelFunction` · object · required
  - `functionRid` · string · required
  - `functionVersion` · string · required
  - `displayName` · string · required
  - `apiName` · string · required
  - `isRowWise` · boolean · required
  - `ontologyBinding` · string
    "The unique Resource Identifier (RID) of the Ontology. To look up your Ontology RID, please use the `List ontologies` endpoint or check the **Ontology Manager**."

## Errors

- `ModelFunctionNotFound` (NOT_FOUND) — "The given ModelFunction could not be found."
- `ModelNotFound` (NOT_FOUND) — "The given Model could not be found."
