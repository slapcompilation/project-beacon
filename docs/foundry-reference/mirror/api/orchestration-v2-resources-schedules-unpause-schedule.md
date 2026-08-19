<!-- source: https://palantir.com/docs/foundry/api/orchestration-v2-resources/schedules/unpause-schedule/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Unpause Schedule

`POST /api/v2/orchestration/schedules/{scheduleRid}/unpause`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-write`.

Scopes: `api:orchestration-write`

## Path parameters

- `scheduleRid` · string · required
  "The RID of a Schedule."

## Errors

- `UnpauseSchedulePermissionDenied` (PERMISSION_DENIED) — "Could not unpause the Schedule."
