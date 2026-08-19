<!-- source: https://palantir.com/docs/foundry/api/v2/sds-v2-resources/scan-records/list-scan-records/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Scan Records

`GET /api/v2/sds/scanConfigurations/{scanConfigurationId}/records`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Retrieve a page of scan records for a specific ScanConfigurationId.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:sds-records-read`.

Scopes: `api:sds-records-read`

## Path parameters

- `scanConfigurationId` · string · required
  "Identifier of a ScanConfiguration. Can refer to a recurring scan or a one-time scan."

## Query parameters

- `scopeRid` · string · required
  "The space containing the scanned resources."
- `scanRecordIsActiveFilter` · enum
  one of `ALL_SCANS`, `ACTIVE_SCANS`, `COMPLETED_SCANS`
  "If no value is provided, active as well as completed scans will be returned."
- `scanResultStatusFilter` · enum
  one of `RUNNING`, `FAILED`, `SUCCEEDED_WITH_MATCHES`, `SUCCEEDED_WITHOUT_MATCHES`, `CANCELLED`, `UNPROCESSABLE_SKIPPED`, `NO_PERMISSION_SKIPPED`, `NO_NEW_DATA_SKIPPED`
  "If no value is provided, all scan records regardless of ScanResultStatus will be returned."
- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ListScanRecordsResponse` · object · required
  - `data` · list
    - `ScanRecord` · object · required
      - `id` · string · required
        "Identifier of a ScanRecord."
      - `scanConfigurationId` · string · required
        "Identifier of a ScanConfiguration. Can refer to a recurring scan or a one-time scan."
      - `scannedResource` · string · required
        "The scanned resource."
      - `branchId` · string · required
        "The scanned branch."
      - `transactionRid` · string
      - `startTime` · string · required
        "The start timestamp of the scan."
      - `completedTime` · string
        "The completion timestamp of the scan."
      - `matchConditionRids` · list
        - `MatchConditionRid` · string · required
          "Resource Identifier of a MatchCondition."
      - `matchActionRids` · list
        - `MatchActionRid` · string · required
          "Resource Identifier of a MatchAction."
      - `buildRid` · string
      - `status` · enum · required
        one of `RUNNING`, `FAILED`, `SUCCEEDED_WITH_MATCHES`, `SUCCEEDED_WITHOUT_MATCHES`, `CANCELLED`, `UNPROCESSABLE_SKIPPED`, `NO_PERMISSION_SKIPPED`, `NO_NEW_DATA_SKIPPED`
        "The result status of a sensitive data scan."
      - `scanResult` · list
        - `MatchConditionOutcome` · object · required
          "Represents the outcome of the evaluation of a specific MatchCondition. Includes the number of scanned rows and the scan result."
          - `matchConditionRid` · string · required
            "Resource Identifier of a MatchCondition."
          - `numberOfScannedRows` · string · required
          - `result` · union · required
            "Represents the scan result for a specific MatchCondition."
            - `noMatch` · object
              "Indicates that the scanned MatchCondition was not detected in the scanned data."
            - `datasetMatch` · object
              "Indicates that matches were found for the scanned MatchCondition."
              - `matchedColumns` · list
                - `ColumnMatch` · object · required
                  "Represents a column that contains rows that matched a scanned MatchCondition."
                  - `columnName` · string · required
                  - `numberOfMatchedRows` · string · required
            - `mediasetMatch` · object
              "Represents a media set that contains media items that matched a scanned MatchCondition."
              - `numberOfMatchedMediaItems` · string · required
              - `examples` · list
                - `MediaMatchExample` · union · required
                  "Represents an example of a media item that matched a scanned MatchCondition."
                  - `mediaItemExample` · object
                    "Represents an example of a media item that matched a scanned MatchCondition."
                    - `mediaItemRid` · string · required
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `ScanConfigurationNotFound` (NOT_FOUND) — "The ScanConfiguration could not be found."
