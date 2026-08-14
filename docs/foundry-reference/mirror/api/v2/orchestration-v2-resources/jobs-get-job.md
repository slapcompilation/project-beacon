<!-- source: https://palantir.com/docs/foundry/api/v2/orchestration-v2-resources/jobs/get-job/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Get Job

`GET /api/v2/orchestration/jobs/{jobRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get the Job with the specified rid.

Users are allowed to make a maximum of **4 requests per second** and **25 concurrent requests**.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-read`.

Scopes: `api:orchestration-read`

## Path parameters

- `jobRid` · string · required
  "The RID of a Job."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `Job` · object · required
  - `rid` · string · required
    "The RID of a Job."
  - `buildRid` · string · required
    "The RID of the Build that the Job belongs to."
  - `startedTime` · string · required
    "The time this job started waiting for the dependencies to be resolved."
  - `latestAttemptStartTime` · string
    "The time this job's latest attempt started running. This field may be empty or outdated if the job failed to start."
  - `finishedTime` · string
    "The time this job was finished."
  - `jobStatus` · enum · required
    one of `WAITING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`, `DID_NOT_RUN`
    "The status of the job."
  - `outputs` · list
    "Outputs of the Job. Only outputs with supported types are listed here; unsupported types are omitted. Currently supported types are Dataset and Media Set outputs."
    - `JobOutput` · union · required
      "Other types of Job Outputs exist in Foundry. Currently, only Dataset and Media Set are supported by the API."
      - `datasetJobOutput` · object
        - `datasetRid` · string · required
          "The Resource Identifier (RID) of a Dataset."
        - `outputTransactionRid` · string
          "The Resource Identifier (RID) of a Transaction."
      - `transactionalMediaSetJobOutput` · object
        - `mediaSetRid` · string · required
          "The Resource Identifier (RID) of a Media Set in Foundry."
        - `transactionId` · string

## Errors

- `JobNotFound` (NOT_FOUND) — "The given Job could not be found."
