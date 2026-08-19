<!-- source: https://palantir.com/docs/foundry/api/v2/orchestration-v2-resources/builds/create-build/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Build

`POST /api/v2/orchestration/builds/create`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-write`.

Scopes: `api:orchestration-write`

## Request

- `CreateBuildRequest` · object · required
  - `target` · union · required
    "The targets of the schedule."
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
  - `branchName` · string
    "The target branch the build should run on."
  - `fallbackBranches` · list
    "The branches to retrieve JobSpecs from if no JobSpec is found on the target branch."
    - `BranchName` · string · required
      "The name of a Branch."
  - `forceBuild` · boolean
    "Whether to ignore staleness information when running the build."
  - `retryCount` · integer
    "The number of retry attempts for failed jobs."
  - `retryBackoffDuration` · object
    "The duration to wait before retrying after a Job fails."
    - `value` · integer · required
      "The duration value."
    - `unit` · enum · required
      one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
      "The unit of duration."
  - `abortOnFailure` · boolean
    "If any job in the build is unsuccessful, immediately finish the build by cancelling all other jobs."
  - `notificationsEnabled` · boolean
    "Whether to receive a notification at the end of the build. The notification will be sent to the user that has most recently edited the schedule. No notification will be sent if the schedule has `scopeMode` set to `ProjectScope`."

## Response

- `Build` · object · required
  - `rid` · string · required
    "The RID of a Build."
  - `branchName` · string · required
    "The branch that the build is running on."
  - `createdTime` · string · required
    "The timestamp that the build was created."
  - `createdBy` · string · required
    "The user who created the build."
  - `fallbackBranches` · list
    "The branches to retrieve JobSpecs from if no JobSpec is found on the target branch."
    - `BranchName` · string · required
      "The name of a Branch."
  - `jobRids` · list
    - `JobRid` · string · required
      "The RID of a Job."
  - `retryCount` · integer · required
    "The number of retry attempts for failed Jobs within the Build. A Job's failure is not considered final until all retries have been attempted or an error occurs indicating that retries cannot be performed. Be aware, not all types of failures can be retried."
  - `retryBackoffDuration` · object · required
    "The duration to wait before retrying after a Job fails."
    - `value` · integer · required
      "The duration value."
    - `unit` · enum · required
      one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
      "The unit of duration."
  - `abortOnFailure` · boolean · required
    "If any job in the build is unsuccessful, immediately finish the build by cancelling all other jobs."
  - `status` · enum · required
    one of `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`
    "The status of the build."
  - `finishedTime` · string
    "The time the build finished processing. Will be empty while the build is still running."
  - `scheduleRid` · string
    "Schedule RID of the Schedule that triggered this build. If a user triggered the build, Schedule RID will be empty."

## Errors

- `CreateBuildPermissionDenied` (PERMISSION_DENIED) — "Could not create the Build."
