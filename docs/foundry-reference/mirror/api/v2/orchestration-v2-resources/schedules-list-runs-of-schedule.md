<!-- source: https://palantir.com/docs/foundry/api/v2/orchestration-v2-resources/schedules/list-runs-of-schedule/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# List Runs Of Schedule

`GET /api/v2/orchestration/schedules/{scheduleRid}/runs`

Get the most recent runs of a Schedule. If no page size is provided, a page size of 100 will be used.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-read`.

Scopes: `api:orchestration-read`

## Path parameters

- `scheduleRid` · string · required
  "The RID of a Schedule."

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListRunsOfScheduleResponse` · object · required
  - `data` · list
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
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
