<!-- source: https://palantir.com/docs/foundry/api/checkpoints-v2-resources/records/search-records/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Search Records

`POST /api/v2/checkpoints/records/search`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Search for checkpoint records.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:checkpoints-read`.

Scopes: `api:checkpoints-read`

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `SearchRecordsRequest` · object · required
  - `where` · object · required
    "Request payload for searching checkpoint records."
    - `filter` · union · required
      "Search criteria for checkpoint records."
      - `not` · object
        "Logical negation of a checkpoint record filter."
        - `filter` · union · required
          "Search criteria for checkpoint records."
      - `or` · object
        "Logical disjunction of checkpoint record filters."
        - `filters` · list
          - `SearchCheckpointRecordsFilter` · union · required
            "Search criteria for checkpoint records."
      - `textSearch` · object
        "Filter for text search on justification fields."
        - `field` · enum · required
          one of `justificationResponse`, `justificationSelectedOption`, `justificationAdditionalResponse`
          "Fields that support text search filtering."
        - `query` · string · required
        - `matchType` · enum · required
          one of `EXACT`, `CONTAINS`
          "Determines how free-text justification input should be matched."
      - `and` · object
        "Logical conjunction of checkpoint record filters."
        - `filters` · list
          - `SearchCheckpointRecordsFilter` · union · required
            "Search criteria for checkpoint records."
      - `lt` · object
        "Filter for less-than comparisons."
        - `field` · enum · required
          one of `createdAt`
          "Fields that support less-than filtering."
        - `value` · string · required
      - `gte` · object
        "Filter for greater-than-or-equal comparisons."
        - `field` · enum · required
          one of `createdAt`
          "Fields that support greater-than-or-equal filtering."
        - `value` · string · required
      - `eq` · object
        "Filter for exact field value matches."
        - `field` · enum · required
          one of `recordRid`, `configRid`, `checkpointType`, `actingUserId`, `delegateUserId`, `organizationRid`, `namespaceRid`, `interactionRid`, `checkpointedItemType`
          "Fields that support equality filtering."
        - `value` · string · required
      - `checkpointedItemId` · object
        "Filter for checkpointed item identifier matches."
        - `checkpointedItemId` · union · required
          "Identifier for a checkpointed item. This union type explicitly identifies the type of item being referenced, eliminating ambiguity between RIDs and string IDs."
          - `checkpointedJobRid` · object
            "Job identifier for a checkpointed job."
            - `rid` · string · required
          - `checkpointedMarkingId` · object
            "Marking identifier for a checkpointed marking."
            - `id` · string · required
          - `checkpointedTokenId` · object
            "Token identifier for a checkpointed token."
            - `id` · string · required
          - `checkpointedGroupId` · object
            "Group identifier for a checkpointed group."
            - `id` · string · required
          - `checkpointedObjectSetVersionedRid` · object
            "Versioned object set RID for a checkpointed object set."
            - `rid` · string · required
          - `checkpointedObjectSetTypesProxyRids` · object
            "Object type RIDs for a types proxy object set."
            - `rids` · list
          - `checkpointedResourceRid` · object
            "Resource identifier for a checkpointed resource."
            - `rid` · string · required
          - `checkpointedPeeringJobId` · object
            "Peering job identifier for a checkpointed peering job."
            - `id` · string · required
            - `relationshipRid` · string · required
              "Resource identifier of the peering relationship."
          - `checkpointedIssueRid` · object
            "Issue identifier for a checkpointed issue."
            - `rid` · string · required
          - `checkpointedInterventionRid` · object
            "Intervention identifier for a checkpointed intervention."
            - `rid` · string · required
          - `checkpointedJobSpecRid` · object
            "Job specification identifier for a checkpointed job spec."
            - `rid` · string · required
          - `checkpointedActionTypeRid` · object
            "Action type identifier for a checkpointed action type."
            - `rid` · string · required
          - `checkpointedScheduleRid` · object
            "Schedule identifier for a checkpointed schedule."
            - `rid` · string · required
          - `checkpointedRoleId` · object
            "Role identifier for a checkpointed role."
            - `id` · string · required
          - `checkpointedUserIntakeFormInputId` · object
            "User intake form input identifier for a checkpointed form input."
            - `id` · string · required
          - `checkpointedMarketplaceProductId` · object
            "Marketplace product identifier for a checkpointed product."
            - `id` · string · required
          - `checkpointedLanguageModelRid` · object
            "Language model identifier for a checkpointed language model."
            - `rid` · string · required
          - `checkpointedPrincipalId` · object
            "Principal identifier for a checkpointed principal."
            - `id` · string · required
          - `checkpointedLanguageModelSessionRid` · object
            "Language model session identifier for a checkpointed session."
            - `rid` · string · required
          - `checkpointedUserIntakeSubmissionRid` · object
            "User intake submission identifier for a checkpointed submission."
            - `rid` · string · required
  - `pageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
  - `pageSize` · integer
    "The page size for the search request. If no value is provided, a default of `100` will be used."
  - `sortDirection` · enum
    one of `ASC`, `DESC`
    "Chronological order of creation time for records to be returned in. Defaults to reverse chronological order (DESC)."

## Response

- `SearchCheckpointRecordsResponse` · object · required
  "Response payload for searching checkpoint records."
  - `data` · list
    - `Record` · object · required
      - `rid` · string · required
        "Identifier of a checkpoint record."
      - `configRid` · string
        "Identifier of the checkpoint configuration that produced a record."
      - `type` · enum · required
        one of `CONTOUR_CREATE`, `CONTOUR_EXPORT`, `HUBBLE_EXPORT`, `COMPASS_IMPORT`, `COMPASS_EXPORT`, `COMPASS_ADD_REFERENCE`, `COMPASS_AUTHORIZE_MARKING_ON_PROJECT`, `COMPASS_ADD_ROLE_GRANT`, `COMPASS_REMOVE_REFERENCE`, `COMPASS_REMOVE_AUTHORIZED_MARKING_FROM_PROJECT`, `COMPASS_REMOVE_ROLE_GRANT`, `DATA_CONNECTION_SYNC_CREATE`, `DATA_CONNECTION_SYNC_BULK_CREATE`, `DATA_CONNECTION_SYNC_EDIT`, `DATA_CONNECTION_SOURCE_SHARE`, `LOGIN`, `REPORT_EXPORT`, `CIPHER_ENCRYPT`, `CIPHER_DECRYPT`, `ATTACHMENT_IMPORT`, `ATTACHMENT_EXPORT`, `SLATE_EXPORT`, `NOTEPAD_EXPORT`, `QUIVER_EXPORT`, `DATA_LIFETIME_APPLY_RETENTION_POLICY`, `FRONTEND_EXPORT`, `BUILD_LOG_EXPORT`, `CODE_REPOSITORY_LOG_EXPORT`, `CODE_REPOSITORY_MODIFY_APPROVAL_POLICY`, `CODE_REPOSITORY_MERGE_PULL_REQUEST`, `CODE_REPOSITORY_BUILD`, `CODE_WORKBOOK_BUILD`, `SCHEDULE_CREATE`, `SCHEDULE_MODIFY`, `SCHEDULE_RUN`, `SCHEDULE_DELETE`, `RUN_BUILD`, `MULTIPASS_TOKEN_CREATE`, `MULTIPASS_ADD_GROUP_MEMBER`, `MULTIPASS_ADD_MARKING_MEMBER`, `MULTIPASS_REMOVE_GROUP_MEMBER`, `MULTIPASS_REMOVE_MARKING_MEMBER`, `MULTIPASS_UPDATE_GROUP_MEMBERSHIP_EXPIRATION_CONFIG`, `MULTIPASS_UPDATE_GROUP_MEMBER_EXPIRY`, `SCOPED_SESSION_SELECT`, `CODE_WORKSPACE_LOG_EXPORT`, `CODE_WORKSPACE_MOVE_DATA_FROM_FOUNDRY`, `CODE_WORKSPACE_MOVE_DATA_TO_FOUNDRY`, `MANAGE_CODE_WORKSPACE_DASHBOARD_DOWNLOADS`, `NOTEPAD_MEDIA_IMPORT`, `CONTOUR_DASHBOARD_EXPORT`, `PACKAGE_PRODUCT`, `NOTEPAD_WIDGET_SNAPSHOT`, `MEDIA_SET_IMPORT`, `MEDIA_SET_EXPORT`, `UPGRADE_ASSISTANT_SUMMARY_EXPORT`, `TABLES_REGISTRATION_AUTOMATIC`, `TABLES_REGISTRATION_MANUAL`, `DEV_CONSOLE_OPENAPI_SPECIFICATION_EXPORT`, `DEV_CONSOLE_USAGE_EXPORT`, `DEPLOY_PIPELINE`, `PIPELINE_BUILDER_MERGE_PROPOSAL`, `PIPELINE_BUILDER_MODIFY_APPROVAL_POLICY`, `PIPELINE_BUILDER_ARCHIVE_BRANCHES`, `PIPELINE_BUILDER_MODIFY_FALLBACK_BRANCHES`, `MODEL_EXPORT`, `THREADS_SESSION_EXPORT`, `AGENT_SESSION_EXPORT`, `USER_INTAKE_SUBMISSION_EXPORT`, `FUNCTION_BACKED_EXPORT`, `SUBMIT_ACTION`, `START_WALKTHROUGH`, `OBJECT_SET_EXPORT`, `RESET_MFA_METHOD`, `ISSUE_CREATE`, `RECORD_FLOW_CAPTURE`, `UPLOAD_DATA_TO_FLOW_CAPTURE`, `EXPORT_FLOW_CAPTURE_ZIP`, `INSIGHT_LOAD`, `AIP_ANALYST_APP_LOAD`, `PEER_MANAGER_CDS_PAYLOAD_EXPORT`, `PEER_MANAGER_OBJECT_TYPE_SCHEMAS_EXPORT`, `AIP_ANALYST_EXPORT`, `OBJECT_EXPLORER_SEARCH`
        "Checkpoint type identifier. See the [Checkpoints documentation](/docs/foundry/checkpoints/overview) for more details."
      - `scope` · enum · required
        one of `USER_SCOPED`, `RESOURCE_SCOPED`
        "Indicates whether the checkpoint was scoped to a user or resource."
      - `actingUser` · object · required
        "User that performed the checkpoint action."
        - `userId` · string · required
          "A Foundry User ID."
        - `username` · object · required
          "A string value that may be redacted for privacy reasons."
          - `value` · string
          - `redactionType` · enum
            one of `USER_REDACTED`, `RESOURCE_REDACTED`
            "Indicates why a string value was redacted."
        - `organizationRid` · string
          "Identifier of the organization associated with a checkpoint."
      - `delegateUserId` · string
        "A Foundry User ID."
      - `createdAt` · string · required
        "The time at which the checkpoint record was created."
      - `checkpointedItems` · list
        - `CheckpointedItem` · union · required
          "Snapshot of the entity that was captured in a checkpoint."
          - `checkpointedIssue` · object
            "An issue that was captured as part of a checkpoint."
            - `issueRid` · string · required
          - `checkpointedJob` · object
            "A build job that was captured as part of a checkpoint."
            - `jobRid` · string · required
          - `checkpointedSchedule` · object
            "A schedule that was captured as part of a checkpoint."
            - `scheduleRid` · string · required
          - `checkpointedResource` · object
            "A Foundry resource that was captured as part of a checkpoint."
            - `rid` · string · required
            - `resourceType` · enum · required
              one of `CONTOUR_ANALYSIS`, `CONTOUR_SOURCE_DATASET`, `DATA_CONNECTION_SYNC`, `DATA_CONNECTION_SOURCE`, `DATA_CONNECTION_SYNC_TARGET_DATASET`, `HUBBLE_OBJECT_TYPE`, `EXPORTED_RESOURCE`, `IMPORTED_RESOURCE`, `REPORT`, `CIPHER_CHANNEL`, `CIPHER_LICENSE`, `PARENT_RESOURCE`, `ATTACHMENT`, `SLATE_APPLICATION`, `NOTEPAD`, `DATASET`, `MEDIA_SET`, `CODE_REPOSITORY`, `CODE_WORKBOOK`, `CODE_WORKSPACE`, `TELEMETRY_CONTAINER`, `REFERENCED_RESOURCE`, `ROLE_GRANT_RESOURCE`, `PROJECT`, `STORE`, `THIRD_PARTY_APPLICATION`, `BUILDER_PIPELINE`, `MODEL`, `MODEL_VERSION`, `AGENT`, `WORKSHOP_MODULE`, `WALKTHROUGH`, `FLOW_CAPTURE`, `PEERING_CONNECTION`
              "Type of resource that was captured."
            - `name` · object
              "A string value that may be redacted for privacy reasons."
              - `value` · string
              - `redactionType` · enum
                one of `USER_REDACTED`, `RESOURCE_REDACTED`
                "Indicates why a string value was redacted."
            - `projectRid` · string
              "Identifier of the project that scoped a checkpoint."
            - `namespaceRid` · string
              "Identifier of the namespace associated with a checkpoint."
            - `compassPath` · object · required
              "A string value that may be redacted for privacy reasons."
              - `value` · string
              - `redactionType` · enum
                one of `USER_REDACTED`, `RESOURCE_REDACTED`
                "Indicates why a string value was redacted."
            - `orgMarkings` · list
          - `checkpointedJobSpecification` · object
            "A job specification that was captured as part of a checkpoint."
            - `jobSpecRid` · string · required
          - `checkpointedLanguageModel` · object
            "A language model that was captured as part of a checkpoint."
            - `modelRid` · string · required
          - `checkpointedGroup` · object
            "A group that was captured as part of a checkpoint."
            - `groupId` · string · required
          - `checkpointedUserIntakeSubmission` · object
            "A user intake form submission that was captured as part of a checkpoint."
            - `submissionRid` · string · required
          - `checkpointedObjectSet` · object
            "Represents the object set that was checkpointed."
            - `versioned` · object
              "A versioned object set that was captured as part of a checkpoint."
              - `versionedObjectSetRid` · string · required
              - `objectSetVersion` · string · required
              - `objectTypes` · list
                - `CheckpointedOntologyWithObjectTypes` · object · required
                  "An ontology with its associated object types that was captured as part of a checkpoint."
                  - `ontology` · object · required
                    "An ontology snapshot that was captured as part of a checkpoint."
                    - `ontologyRid` · string · required
                    - `ontologyVersion` · string · required
                    - `namespaceRid` · string
                      "Identifier of the namespace associated with a checkpoint."
                  - `objectTypeRids` · list
            - `typesProxy` · object
              "A types proxy object set that was captured as part of a checkpoint."
              - `objectTypes` · list
                - `CheckpointedOntologyWithObjectTypes` · object · required
                  "An ontology with its associated object types that was captured as part of a checkpoint."
                  - `ontology` · object · required
                    "An ontology snapshot that was captured as part of a checkpoint."
                    - `ontologyRid` · string · required
                    - `ontologyVersion` · string · required
                    - `namespaceRid` · string
                      "Identifier of the namespace associated with a checkpoint."
                  - `objectTypeRids` · list
          - `checkpointedMarking` · object
            "A marking that was captured as part of a checkpoint."
            - `markingId` · string · required
          - `checkpointedMarketplaceProduct` · object
            "A Marketplace product that was captured as part of a checkpoint."
            - `productId` · string · required
          - `checkpointedPeeringJob` · object
            "A peering job that was captured as part of a checkpoint."
            - `jobId` · string · required
              "Identifier of the peering job."
            - `relationshipRid` · string · required
              "Resource identifier of the peering relationship."
          - `checkpointedRole` · object
            "A role that was captured as part of a checkpoint."
            - `roleId` · string · required
          - `checkpointedIntervention` · object
            "An intervention that was captured as part of a checkpoint."
            - `interventionRid` · string · required
          - `checkpointedLanguageModelSession` · object
            "A language model session that was captured as part of a checkpoint."
            - `sessionRid` · string · required
          - `checkpointedToken` · object
            "An authentication token that was captured as part of a checkpoint."
            - `tokenId` · string · required
            - `tokenType` · enum · required
              one of `USER_TOKEN`
              "The type of token that was captured as part of a checkpoint."
          - `checkpointedUserIntakeFormInput` · object
            "A user intake form input that was captured as part of a checkpoint."
            - `inputId` · string · required
          - `checkpointedPrincipal` · object
            "A user or group principal that was captured as part of a checkpoint."
            - `id` · string · required
            - `username` · object · required
              "A string value that may be redacted for privacy reasons."
              - `value` · string
              - `redactionType` · enum
                one of `USER_REDACTED`, `RESOURCE_REDACTED`
                "Indicates why a string value was redacted."
            - `organizationRid` · string
              "Identifier of the organization associated with a checkpoint."
            - `role` · enum · required
              one of `SOURCE_SHARE_RECIPIENT`, `TARGET_GROUP`, `GROUP_MEMBER`, `MARKING_MEMBER`, `ROLE_GRANT_RECIPIENT`, `MFA_METHOD_RESET_TARGET`, `ISSUE_ASSIGNEE`
              "Role the principal had relative to the checkpointed entity."
          - `checkpointedActionType` · object
            "An ontology action type that was captured as part of a checkpoint."
            - `actionTypeRid` · string · required
            - `ontology` · object · required
              "An ontology snapshot that was captured as part of a checkpoint."
              - `ontologyRid` · string · required
              - `ontologyVersion` · string · required
              - `namespaceRid` · string
                "Identifier of the namespace associated with a checkpoint."
      - `justification` · union · required
        "Justification submitted by the user to pass a checkpoint."
        - `responseJustification` · object
          "Checkpoint justification that requires the user to input a free-text response."
          - `response` · string · required
            "User-submitted free-text justification."
          - `prompt` · string · required
            "Prompt to which the user responds."
          - `description` · string
            "Supplemental information that helps users understand the prompt."
          - `title` · string · required
            "Title of the checkpoint to which the user is responding."
        - `dropdownJustification` · object
          "Checkpoint justification where the user selects one or more options from a dropdown."
          - `selectedOptions` · list
            "Options the user selected in the dropdown."
            - `DropdownSelection` · object · required
              "A selection made within a multi-select dropdown justification."
              - `selectedOption` · string · required
                "Dropdown option the user selected."
              - `additionalResponse` · string
                "Extra free-text response submitted alongside the dropdown selection."
          - `prompt` · string · required
            "Prompt to which the user-selected options respond."
          - `description` · string
            "Supplemental information that helps users understand the prompt."
          - `title` · string · required
            "Title of the checkpoint to which the user is responding."
        - `reauthenticationJustification` · object
          "Checkpoint justification that requires the user to reauthenticate with the platform."
          - `reauthenticationId` · string · required
            "Identifier for the reauthentication instance."
          - `prompt` · string · required
            "Prompt shown to the user during reauthentication."
          - `description` · string
            "Supplemental information that helps users understand the prompt."
          - `title` · string · required
            "Title of the checkpoint that the user is acknowledging."
        - `acknowledgementJustification` · object
          "Checkpoint justification that requires the user to mark a checkbox."
          - `prompt` · string · required
            "Prompt acknowledged by the user."
          - `description` · string
            "Supplemental information that helps users understand the prompt."
          - `title` · string · required
            "Title of the checkpoint the user is acknowledging."
      - `projectRid` · string
        "Identifier of the project that scoped a checkpoint."
      - `organizationRid` · string
        "Identifier of the organization associated with a checkpoint."
      - `namespaceRid` · string
        "Identifier of the namespace associated with a checkpoint."
      - `interactionRid` · string
        "Identifier of the interaction associated with a record."
      - `approvalsMetadata` · object
        "Metadata linking a checkpoint record to an Approvals workflow."
        - `approvalsTaskId` · string · required
          "Identifier of an Approvals task tied to the checkpoint."
        - `approvalsSubtaskIds` · list
          - `ApprovalsSubtaskId` · string · required
            "Identifier of an Approvals subtask tied to the checkpoint."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `SearchRecordsPermissionDenied` (PERMISSION_DENIED) — "Could not search the Record."
