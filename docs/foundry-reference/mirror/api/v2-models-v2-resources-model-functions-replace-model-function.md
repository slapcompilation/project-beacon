<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/model-functions/replace-model-function/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Replace Model Function

`PUT /api/v2/models/{modelRid}/function`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Replaces the function for the model.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-write`.

Scopes: `api:models-write`

## Path parameters

- `modelRid` · string · required
  "The Resource Identifier (RID) of a Model."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `ReplaceModelFunctionRequest` · object · required
  - `apiName` · string · required
  - `ontologyBinding` · string
    "The unique Resource Identifier (RID) of the Ontology. To look up your Ontology RID, please use the `List ontologies` endpoint or check the **Ontology Manager**."
  - `isRowWise` · boolean · required

## Response

- `ModelFunction` · object · required
  "The replaced ModelFunction"
  - `functionRid` · string · required
  - `functionVersion` · string · required
  - `displayName` · string · required
  - `apiName` · string · required
  - `isRowWise` · boolean · required
  - `ontologyBinding` · string
    "The unique Resource Identifier (RID) of the Ontology. To look up your Ontology RID, please use the `List ontologies` endpoint or check the **Ontology Manager**."

## Errors

- `ModelApiTypeUnsupportedForFunction` (INVALID_ARGUMENT) — "The model API contains a data type that is not supported for Ontology function creation."
- `InvalidFunctionApiName` (INVALID_ARGUMENT) — "The provided API name for the function is invalid."
- `OntologyBindingRequired` (INVALID_ARGUMENT) — "An ontologyBinding is required when creating or replacing a model function."
- `OntologyNotFound` (NOT_FOUND) — "The specified ontology was not found."
- `ReplaceModelFunctionPermissionDenied` (PERMISSION_DENIED) — "Could not replace the ModelFunction."
- `ModelNotFound` (NOT_FOUND) — "The given Model could not be found."
- `ModelFunctionNotFound` (NOT_FOUND) — "The given ModelFunction could not be found."
