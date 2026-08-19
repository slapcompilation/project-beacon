<!-- source: https://palantir.com/docs/foundry/api/orchestration-v2-resources/schedules/run-schedule/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Run Schedule

`POST /api/v2/orchestration/schedules/{scheduleRid}/run`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-write`.

Scopes: `api:orchestration-write`

## Path parameters

- `scheduleRid` · string · required
  "The RID of a Schedule."

## Response

- `ScheduleRun` · object · required
  - `rid` · string · required
    "The RID of a schedule run"
  - `scheduleRid` · string · required
    "The RID of a Schedule."
  - `scheduleVersionRid` · string · required
    "The RID of a schedule version"
  - `createdTime` · string · required
    "The time at which the schedule run was created."
  - `createdBy` · string
    "The Foundry user who manually invoked this schedule run. Automatic trigger runs have this field set to empty."
  - `result` · union
    "The result of triggering the schedule. If empty, it means the service is still working on triggering the schedule."
    - `ignored` · object
      "The schedule is not running as all targets are up-to-date."
    - `submitted` · object
      "The schedule has been successfully triggered."
      - `buildRid` · string · required
        "The RID of a Build."
    - `error` · object
      "An error occurred attempting to run the schedule."
      - `errorName` · enum · required
        one of `TARGETRESOLUTIONFAILURE`, `CYCLICDEPENDENCY`, `INCOMPATIBLETARGETS`, `PERMISSIONDENIED`, `JOBSPECNOTFOUND`, `SCHEDULEOWNERNOTFOUND`, `INTERNAL`
      - `description` · string · required

## Errors

- `RunSchedulePermissionDenied` (PERMISSION_DENIED) — "Could not run the Schedule."
