<!-- source: https://palantir.com/docs/foundry/api/v2/orchestration-v2-resources/schedules/get-affected-resources-schedule/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Affected Resources Schedule

`POST /api/v2/orchestration/schedules/{scheduleRid}/getAffectedResources`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-read`.

Scopes: `api:orchestration-read`

## Path parameters

- `scheduleRid` · string · required
  "The RID of a Schedule."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `AffectedResourcesResponse` · object · required
  - `datasets` · list
    - `BuildableRid` · string · required
      "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."

## Errors

- `GetAffectedResourcesSchedulePermissionDenied` (PERMISSION_DENIED) — "Could not getAffectedResources the Schedule."
