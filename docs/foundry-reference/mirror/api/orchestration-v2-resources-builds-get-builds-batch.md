<!-- source: https://palantir.com/docs/foundry/api/orchestration-v2-resources/builds/get-builds-batch/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Builds Batch

`POST /api/v2/orchestration/builds/getBatch`

Execute multiple get requests on Build.

Users are allowed to make a maximum of **4 requests per second** and **25 concurrent requests**.


The maximum batch size for this endpoint is 100.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-read`.

Scopes: `api:orchestration-read`

## Request

- `body` · list · required
  - `GetBuildsBatchRequestElement` · object · required
    - `buildRid` · string · required
      "The RID of a Build."

## Response

- `GetBuildsBatchResponse` · object · required
  - `data` · map
    - `BuildRid` · string · required
      "The RID of a Build."
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
