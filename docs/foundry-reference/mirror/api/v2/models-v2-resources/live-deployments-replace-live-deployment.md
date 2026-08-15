<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/live-deployments/replace-live-deployment/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Replace Live Deployment

`PUT /api/v2/models/liveDeployments/{liveDeploymentRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Updates the runtime configuration of the live deployment. The deployment will apply the new configuration to the running replicas.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-write`.

Scopes: `api:models-write`

## Path parameters

- `liveDeploymentRid` · string · required
  "The Resource Identifier (RID) of a Live Deployment."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `ReplaceLiveDeploymentRequest` · object · required
  - `runtimeConfiguration` · object · required
    "The compute resource configuration for the deployment."
    - `minReplicas` · integer · required
      "The minimum number of replicas to keep running."
    - `maxReplicas` · integer · required
      "The maximum number of replicas to scale to under load."
    - `cpu` · number
      "The number of CPU units requested. This is also set as the limit."
    - `memory` · string
      "The amount of memory requested in human-readable format (e.g. "256MiB", "1GiB"). This is also set as the limit."
    - `gpu` · object
      "Optional GPU resources for the deployment."
      - `count` · integer · required
        "The number of GPU units requested (e.g. 1)."
      - `type` · enum
        one of `A100`, `A10G`, `A16`, `H100`, `H200`, `L4`, `L40S`, `T4`, `V100`
        "The specific type of GPU to use. Not setting a type means any type is acceptable."
    - `threadCount` · integer
      "The number of threads used for query handling. Defaults to 32 if not specified. Also affects how many concurrent requests will be sent to a single replica."
    - `scalingConfiguration` · object
      "Autoscaling configuration for the deployment. Controls how the deployment scales replicas up and down based on load."
      - `scaleUpLoadThreshold` · number · required
        "A threshold between 0.0 and 1.0. If the ratio of running jobs to job capacity exceeds this threshold for the duration of the scale-up delay, the deployment will scale up. Job capacity is the number of running replicas multiplied by the thread count (concurrency limit)."
      - `scaleUpDelay` · object · required
        "The duration that load must exceed the scale-up threshold before scaling up."
        - `value` · integer · required
          "The duration value."
        - `unit` · enum · required
          one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
          "The unit of duration."
      - `scaleDownDelay` · object · required
        "The duration that load must be below the scale-down threshold before scaling down."
        - `value` · integer · required
          "The duration value."
        - `unit` · enum · required
          one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
          "The unit of duration."
    - `environmentVariables` · map
      "User-supplied environment variables to set on the deployment container, keyed by variable name."

## Response

- `LiveDeployment` · object · required
  "The replaced LiveDeployment"
  - `rid` · string · required
    "The Resource Identifier (RID) of a Live Deployment."
  - `modelVersion` · object · required
    "The currently deployed model version."
    - `modelRid` · string · required
      "The Resource Identifier (RID) of a Model."
    - `modelVersionRid` · string · required
      "The Resource Identifier (RID) of a Model Version."
  - `branch` · string
    "The model branch this deployment tracks. Present for direct deployments that follow the latest model version on a branch; absent for deployment types that are not branch-scoped."
  - `runtimeConfiguration` · object · required
    "The compute resource configuration for the deployment."
    - `minReplicas` · integer · required
      "The minimum number of replicas to keep running."
    - `maxReplicas` · integer · required
      "The maximum number of replicas to scale to under load."
    - `cpu` · number
      "The number of CPU units requested. This is also set as the limit."
    - `memory` · string
      "The amount of memory requested in human-readable format (e.g. "256MiB", "1GiB"). This is also set as the limit."
    - `gpu` · object
      "Optional GPU resources for the deployment."
      - `count` · integer · required
        "The number of GPU units requested (e.g. 1)."
      - `type` · enum
        one of `A100`, `A10G`, `A16`, `H100`, `H200`, `L4`, `L40S`, `T4`, `V100`
        "The specific type of GPU to use. Not setting a type means any type is acceptable."
    - `threadCount` · integer
      "The number of threads used for query handling. Defaults to 32 if not specified. Also affects how many concurrent requests will be sent to a single replica."
    - `scalingConfiguration` · object
      "Autoscaling configuration for the deployment. Controls how the deployment scales replicas up and down based on load."
      - `scaleUpLoadThreshold` · number · required
        "A threshold between 0.0 and 1.0. If the ratio of running jobs to job capacity exceeds this threshold for the duration of the scale-up delay, the deployment will scale up. Job capacity is the number of running replicas multiplied by the thread count (concurrency limit)."
      - `scaleUpDelay` · object · required
        "The duration that load must exceed the scale-up threshold before scaling up."
        - `value` · integer · required
          "The duration value."
        - `unit` · enum · required
          one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
          "The unit of duration."
      - `scaleDownDelay` · object · required
        "The duration that load must be below the scale-down threshold before scaling down."
        - `value` · integer · required
          "The duration value."
        - `unit` · enum · required
          one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
          "The unit of duration."
    - `environmentVariables` · map
      "User-supplied environment variables to set on the deployment container, keyed by variable name."
  - `status` · object · required
    "The current operational status of the deployment."
    - `state` · enum · required
      one of `ACTIVE`, `STARTING`, `DEGRADED`, `DISABLED`, `FAILED`
      "The current operational state of the deployment."
    - `isReady` · boolean · required
      "Whether the deployment is ready to serve inference requests. A deployment may be active but not ready if it has been autoscaled to zero replicas."

## Errors

- `ThreadCountTooHigh` (INVALID_ARGUMENT) — "The specified thread count exceeds the maximum allowed value."
- `InvalidGpuCount` (INVALID_ARGUMENT) — "The GPU count is invalid. The GPU count must be between 1 and the maximum allowed
for the requested GPU type."
- `GpuTypeNotAvailable` (INVALID_ARGUMENT) — "The requested GPU type is not available. Use a GPU type that is available in
the deployment's resource queue."
- `LiveDeploymentNotFound` (NOT_FOUND) — "The specified live deployment was not found."
- `UnsupportedLiveDeployment` (INVALID_ARGUMENT) — "The Live Deployment type is not supported by the API."
- `ReplaceLiveDeploymentPermissionDenied` (PERMISSION_DENIED) — "Could not replace the LiveDeployment."
