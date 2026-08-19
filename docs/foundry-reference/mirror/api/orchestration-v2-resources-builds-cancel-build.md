<!-- source: https://palantir.com/docs/foundry/api/orchestration-v2-resources/builds/cancel-build/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Cancel Build

`POST /api/v2/orchestration/builds/{buildRid}/cancel`

Request a cancellation for all unfinished jobs in a build. The build's status will not update immediately. This endpoint is asynchronous and a success response indicates that the cancellation request has been acknowledged and the build is expected to be canceled soon. If the build has already finished or finishes shortly after the request and before the cancellation, the build will not change.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-write`.

Scopes: `api:orchestration-write`

## Path parameters

- `buildRid` · string · required
  "The RID of a Build."

## Errors

- `CancelBuildPermissionDenied` (PERMISSION_DENIED) — "Could not cancel the Build."
