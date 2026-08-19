<!-- source: https://palantir.com/docs/foundry/api/models-v2-resources/live-deployments/list-live-deployments/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Live Deployments

`GET /api/v2/models/liveDeployments`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Lists direct live deployments for the specified Model, optionally filtered by branch. Only direct deployments (those tracking the latest model version on a branch) are returned.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Query parameters

- `modelRid` · string · required
  "The Resource Identifier (RID) of the Model to list live deployments for."
- `branch` · string
  "If provided, only return the live deployment associated with this branch."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ListLiveDeploymentsResponse` · object · required
  - `data` · list
    - `LiveDeployment` · object · required
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

- `ModelNotFound` (NOT_FOUND) — "The given Model could not be found."
