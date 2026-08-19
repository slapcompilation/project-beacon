<!-- source: https://palantir.com/docs/foundry/api/v2/orchestration-v2-resources/schedules/delete-schedule/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Delete Schedule

`DELETE /api/v2/orchestration/schedules/{scheduleRid}`

Delete the Schedule with the specified rid.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-write`.

Scopes: `api:orchestration-write`

## Path parameters

- `scheduleRid` · string · required
  "The RID of a Schedule."

## Errors

- `DeleteSchedulePermissionDenied` (PERMISSION_DENIED) — "Could not delete the Schedule."
