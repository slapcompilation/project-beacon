<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/model-functions/create-model-function/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Model Function

`POST /api/v2/models/{modelRid}/function`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Creates a function for the model.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-write`.

Scopes: `api:models-write`

## Path parameters

- `modelRid` · string · required
  "The Resource Identifier (RID) of a Model."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `CreateModelFunctionRequest` · object · required
  - `apiName` · string · required
  - `ontologyBinding` · string
    "The unique Resource Identifier (RID) of the Ontology. To look up your Ontology RID, please use the `List ontologies` endpoint or check the **Ontology Manager**."
  - `isRowWise` · boolean · required
  - `displayName` · string · required

## Response

- `ModelFunction` · object · required
  "The created ModelFunction"
  - `functionRid` · string · required
  - `functionVersion` · string · required
  - `displayName` · string · required
  - `apiName` · string · required
  - `isRowWise` · boolean · required
  - `ontologyBinding` · string
    "The unique Resource Identifier (RID) of the Ontology. To look up your Ontology RID, please use the `List ontologies` endpoint or check the **Ontology Manager**."

## Errors

- `FunctionAlreadyExists` (CONFLICT) — "A function already exists for this model."
- `ModelApiTypeUnsupportedForFunction` (INVALID_ARGUMENT) — "The model API contains a data type that is not supported for Ontology function creation."
- `InvalidFunctionApiName` (INVALID_ARGUMENT) — "The provided API name for the function is invalid."
- `OntologyBindingRequired` (INVALID_ARGUMENT) — "An ontologyBinding is required when creating or replacing a model function."
- `OntologyNotFound` (NOT_FOUND) — "The specified ontology was not found."
- `CreateModelFunctionPermissionDenied` (PERMISSION_DENIED) — "Could not create the ModelFunction."
- `ModelNotFound` (NOT_FOUND) — "The given Model could not be found."
