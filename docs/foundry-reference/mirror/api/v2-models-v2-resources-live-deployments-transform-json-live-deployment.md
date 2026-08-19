<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/live-deployments/transform-json-live-deployment/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Transform Json Live Deployment

`POST /api/v2/models/liveDeployments/{liveDeploymentRid}/transformJson`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Performs inference on the live deployment.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-execute`.

Scopes: `api:models-execute`

## Path parameters

- `liveDeploymentRid` · string · required
  "The Resource Identifier (RID) of a Live Deployment."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `TransformJsonLiveDeploymentRequest` · object · required
  - `input` · map
    "The input data for the model inference. The structure should match the model's transform API specification, where each key is an input name and the value is the corresponding input data."

## Response

- `TransformLiveDeploymentResponse` · object · required
  "The response from transforming input data using a live deployment."
  - `output` · map
    "The output data from the model inference. The structure depends on the model's defined API specification, where each key is an output name and the value is the corresponding output data."

## Errors

- `LiveDeploymentNotFound` (NOT_FOUND) — "The specified live deployment was not found."
- `InferenceTimeout` (TIMEOUT) — "The live deployment took longer than 5 minutes to respond to the inference request.
This typically indicates the model execution is taking too long or the deployment is under heavy load."
- `InferenceInvalidInput` (INVALID_ARGUMENT) — "The inference request contains invalid input data that does not match the model's API specification.
Check the error type for specific validation failure details."
- `InferenceFailure` (INVALID_ARGUMENT) — "The inference request failed due to a model execution error or unexpected internal issue.
This typically indicates a problem with the model itself rather than the input data."
- `TransformJsonLiveDeploymentPermissionDenied` (PERMISSION_DENIED) — "Could not transformJson the LiveDeployment."
