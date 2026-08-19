<!-- source: https://palantir.com/docs/foundry/api/orchestration-v2-resources/schedules/create-schedule/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Schedule

`POST /api/v2/orchestration/schedules`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Creates a new Schedule.

:::callout{theme=warning title=Warning}
If the schedule is created in user-scoped mode, outputs to build will be discovered based on resources
that the user has access to. If the user's permissions change later, this could change the outputs that
will be built or cause builds to fail. Consider using a project-scoped schedule instead.
:::


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-write`.

Scopes: `api:orchestration-write`

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `CreateScheduleRequest` · object · required
  - `displayName` · string
  - `description` · string
  - `action` · object · required
    - `abortOnFailure` · boolean
      "If any job in the build is unsuccessful, immediately finish the build by cancelling all other jobs."
    - `forceBuild` · boolean
      "Whether to ignore staleness information when running the build."
    - `retryBackoffDuration` · object
      "The duration to wait before retrying after a Job fails."
      - `value` · integer · required
        "The duration value."
      - `unit` · enum · required
        one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
        "The unit of duration."
    - `retryCount` · integer
      "The number of retry attempts for failed Jobs within the Build. A Job's failure is not considered final until all retries have been attempted or an error occurs indicating that retries cannot be performed. Be aware, not all types of failures can be retried."
    - `fallbackBranches` · list
      "The branches to retrieve JobSpecs from if no JobSpec is found on the target branch."
      - `BranchName` · string · required
        "The name of a Branch."
    - `branchName` · string
      "The target branch the schedule should run on."
    - `notificationsEnabled` · boolean
      "Whether to receive a notification at the end of the build. The notification will be sent to the user that has most recently edited the schedule. No notification will be sent if the schedule has `scopeMode` set to `ProjectScope`."
    - `target` · union · required
      "The targets of the build."
      - `upstream` · object
        - `ignoredRids` · list
          "The datasets to ignore when calculating the final set of dataset to build."
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
        - `targetRids` · list
          "The target datasets."
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
      - `manual` · object
        - `targetRids` · list
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
      - `connecting` · object
        - `ignoredRids` · list
          "The datasets between the input datasets and target datasets to exclude."
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
        - `targetRids` · list
          "The downstream target datasets (inclusive)."
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
        - `inputRids` · list
          "The upstream input datasets (exclusive)."
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
  - `trigger` · union
    "The schedule trigger. If the requesting user does not have permission to see the trigger, this will be empty."
    - `jobSucceeded` · object
      "Trigger whenever a job succeeds on the dataset and on the target branch."
      - `datasetRid` · string · required
        "The Resource Identifier (RID) of a Dataset."
      - `branchName` · string · required
        "The name of a Branch."
    - `or` · object
      "Trigger whenever any of the given triggers emit an event."
      - `triggers` · list
        - `Trigger` · union · required
    - `newLogic` · object
      "Trigger whenever a new JobSpec is put on the dataset and on that branch."
      - `branchName` · string · required
        "The name of a Branch."
      - `datasetRid` · string · required
        "The Resource Identifier (RID) of a Dataset."
    - `tableUpdated` · object
      "Trigger whenever a new transaction is committed to the table on the target branch."
      - `tableRid` · string · required
        "The Resource Identifier (RID) of a Table."
      - `branchName` · string · required
        "The name of a Branch."
    - `and` · object
      "Trigger after all of the given triggers emit an event."
      - `triggers` · list
        - `Trigger` · union · required
    - `datasetUpdated` · object
      "Trigger whenever a new transaction is committed to the dataset on the target branch."
      - `datasetRid` · string · required
        "The Resource Identifier (RID) of a Dataset."
      - `branchName` · string · required
        "The name of a Branch."
    - `scheduleSucceeded` · object
      "Trigger whenever the specified schedule completes its action successfully."
      - `scheduleRid` · string · required
        "The RID of a Schedule."
    - `mediaSetUpdated` · object
      "Trigger whenever an update is made to a media set on the target branch. For transactional media sets, this happens when a transaction is committed. For non-transactional media sets, this event happens eventually (but not necessary immediately) after an update."
      - `mediaSetRid` · string · required
        "The Resource Identifier (RID) of a Media Set in Foundry."
      - `branchName` · string · required
        "The name of a Branch."
    - `time` · object
      "Trigger on a time based schedule."
      - `cronExpression` · string · required
        "A standard CRON expression with minute, hour, day, month and day of week."
      - `timeZone` · string · required
        "A string representation of a java.time.ZoneId"
    - `manual` · object
      "Only trigger the Schedule manually. If placed in an AND or OR condition, this Trigger will be ignored."
  - `scopeMode` · union
    "The boundaries for the schedule build."
    - `project` · object
      - `projectRids` · list
        - `ProjectRid` · string · required
          "The unique resource identifier (RID) of a Project."
    - `user` · object

## Response

- `Schedule` · object · required
  "The created Schedule"
  - `rid` · string · required
    "The RID of a Schedule."
  - `displayName` · string
  - `description` · string
  - `currentVersionRid` · string · required
    "The RID of the current schedule version"
  - `createdTime` · string · required
    "The time at which the resource was created."
  - `createdBy` · string · required
    "The Foundry user who created this resource"
  - `updatedTime` · string · required
    "The time at which the resource was most recently updated."
  - `updatedBy` · string · required
    "The Foundry user who last updated this resource"
  - `paused` · boolean · required
  - `trigger` · union
    "The schedule trigger. If the requesting user does not have permission to see the trigger, this will be empty."
    - `jobSucceeded` · object
      "Trigger whenever a job succeeds on the dataset and on the target branch."
      - `datasetRid` · string · required
        "The Resource Identifier (RID) of a Dataset."
      - `branchName` · string · required
        "The name of a Branch."
    - `or` · object
      "Trigger whenever any of the given triggers emit an event."
      - `triggers` · list
        - `Trigger` · union · required
    - `newLogic` · object
      "Trigger whenever a new JobSpec is put on the dataset and on that branch."
      - `branchName` · string · required
        "The name of a Branch."
      - `datasetRid` · string · required
        "The Resource Identifier (RID) of a Dataset."
    - `tableUpdated` · object
      "Trigger whenever a new transaction is committed to the table on the target branch."
      - `tableRid` · string · required
        "The Resource Identifier (RID) of a Table."
      - `branchName` · string · required
        "The name of a Branch."
    - `and` · object
      "Trigger after all of the given triggers emit an event."
      - `triggers` · list
        - `Trigger` · union · required
    - `datasetUpdated` · object
      "Trigger whenever a new transaction is committed to the dataset on the target branch."
      - `datasetRid` · string · required
        "The Resource Identifier (RID) of a Dataset."
      - `branchName` · string · required
        "The name of a Branch."
    - `scheduleSucceeded` · object
      "Trigger whenever the specified schedule completes its action successfully."
      - `scheduleRid` · string · required
        "The RID of a Schedule."
    - `mediaSetUpdated` · object
      "Trigger whenever an update is made to a media set on the target branch. For transactional media sets, this happens when a transaction is committed. For non-transactional media sets, this event happens eventually (but not necessary immediately) after an update."
      - `mediaSetRid` · string · required
        "The Resource Identifier (RID) of a Media Set in Foundry."
      - `branchName` · string · required
        "The name of a Branch."
    - `time` · object
      "Trigger on a time based schedule."
      - `cronExpression` · string · required
        "A standard CRON expression with minute, hour, day, month and day of week."
      - `timeZone` · string · required
        "A string representation of a java.time.ZoneId"
    - `manual` · object
      "Only trigger the Schedule manually. If placed in an AND or OR condition, this Trigger will be ignored."
  - `action` · object · required
    - `target` · union · required
      "The targets of the build."
      - `upstream` · object
        "Target the specified datasets along with all upstream datasets except the ignored datasets."
        - `targetRids` · list
          "The target datasets."
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
        - `ignoredRids` · list
          "The datasets to ignore when calculating the final set of dataset to build."
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
      - `manual` · object
        "Manually specify all datasets to build."
        - `targetRids` · list
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
      - `connecting` · object
        "All datasets between the input datasets (exclusive) and the target datasets (inclusive) except for the datasets to ignore."
        - `inputRids` · list
          "The upstream input datasets (exclusive)."
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
        - `targetRids` · list
          "The downstream target datasets (inclusive)."
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
        - `ignoredRids` · list
          "The datasets between the input datasets and target datasets to exclude."
          - `BuildableRid` · string · required
            "The Resource Identifier (RID) of a Resource that can be built. For example, this is a Dataset RID, Media Set RID or Restricted View RID."
    - `branchName` · string · required
      "The target branch the schedule should run on."
    - `fallbackBranches` · list
      "The branches to retrieve JobSpecs from if no JobSpec is found on the target branch."
      - `BranchName` · string · required
        "The name of a Branch."
    - `forceBuild` · boolean · required
      "Whether to ignore staleness information when running the build."
    - `retryCount` · integer
      "The number of retry attempts for failed Jobs within the Build. A Job's failure is not considered final until all retries have been attempted or an error occurs indicating that retries cannot be performed. Be aware, not all types of failures can be retried."
    - `retryBackoffDuration` · object
      "The duration to wait before retrying after a Job fails."
      - `value` · integer · required
        "The duration value."
      - `unit` · enum · required
        one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
        "The unit of duration."
    - `abortOnFailure` · boolean · required
      "If any job in the build is unsuccessful, immediately finish the build by cancelling all other jobs."
    - `notificationsEnabled` · boolean · required
      "Whether to receive a notification at the end of the build. The notification will be sent to the user that has most recently edited the schedule. No notification will be sent if the schedule has `scopeMode` set to `ProjectScope`."
  - `scopeMode` · union · required
    "The boundaries for the schedule build."
    - `project` · object
      "The schedule will only build resources in the following projects."
      - `projectRids` · list
        - `ProjectRid` · string · required
          "The unique resource identifier (RID) of a Project."
    - `user` · object
      "When triggered, the schedule will build all resources that the associated user is permitted to build."

## Errors

- `CreateSchedulePermissionDenied` (PERMISSION_DENIED) — "Could not create the Schedule."
