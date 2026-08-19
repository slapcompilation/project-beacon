<!-- source: https://palantir.com/docs/foundry/api/v2/orchestration-v2-resources/builds/list-jobs-of-build/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Jobs Of Build

`GET /api/v2/orchestration/builds/{buildRid}/jobs`

Get the Jobs in the Build.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:orchestration-read`.

Scopes: `api:orchestration-read`

## Path parameters

- `buildRid` · string · required
  "The RID of a Build."

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListJobsOfBuildResponse` · object · required
  - `data` · list
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
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
