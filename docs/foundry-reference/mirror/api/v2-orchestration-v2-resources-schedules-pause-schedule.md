<!-- source: https://palantir.com/docs/foundry/api/v2/orchestration-v2-resources/schedules/pause-schedule/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Pause Schedule

`POST /api/v2/orchestration/schedules/{scheduleRid}/pause`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-write`.

Scopes: `api:orchestration-write`

## Path parameters

- `scheduleRid` · string · required
  "The RID of a Schedule."

## Errors

- `PauseSchedulePermissionDenied` (PERMISSION_DENIED) — "Could not pause the Schedule."
