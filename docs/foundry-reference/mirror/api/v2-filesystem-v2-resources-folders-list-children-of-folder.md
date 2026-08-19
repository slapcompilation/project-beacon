<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/folders/list-children-of-folder/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Children Of Folder

`GET /api/v2/filesystem/folders/{folderRid}/children`

List all child resources of the Folder.

This is a paged endpoint. The page size will be limited to 2,000 results per page. If no page size is
provided, this page size will also be used as the default.

## Path parameters

- `folderRid` · string · required
  "The unique resource identifier (RID) of a Folder."

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListChildrenOfFolderResponse` · object · required
  - `data` · list
    - `Resource` · object · required
      - `rid` · string · required
        "The unique resource identifier (RID) of a resource."
      - `displayName` · string · required
        "The display name of the resource"
      - `description` · string
        "The description of the resource"
      - `documentation` · string
        "The documentation associated with the resource"
      - `path` · string · required
        "The full path to the resource, including the resource name itself"
      - `type` · enum · required
        one of `AIP_PROFILE`, `AIP_AGENTS_AGENT`, `AIP_AGENTS_SESSION`, `AIP_ASSIST_FLOW_CAPTURE`, `AIP_ASSIST_WALKTHROUGH`, `ARTIFACTS_REPOSITORY`, `BELLASO_CIPHER_CHANNEL`, `BELLASO_CIPHER_LICENSE`, `BLACKSMITH_DOCUMENT`, `BLOBSTER_ARCHIVE`, `BLOBSTER_AUDIO`, `BLOBSTER_BLOB`, `BLOBSTER_CODE`, `BLOBSTER_CONFIGURATION`, `BLOBSTER_DOCUMENT`, `BLOBSTER_IMAGE`, `BLOBSTER_JUPYTERNOTEBOOK`, `BLOBSTER_PDF`, `BLOBSTER_PRESENTATION`, `BLOBSTER_SPREADSHEET`, `BLOBSTER_VIDEO`, `BLOBSTER_XML`, `CARBON_WORKSPACE`, `COMPASS_FOLDER`, `COMPASS_WEB_LINK`, `CONTOUR_ANALYSIS`, `DATA_HEALTH_MONITORING_VIEW`, `DECISIONS_EXPLORATION`, `DREDDIE_PIPELINE`, `EDDIE_LOGIC`, `EDDIE_PIPELINE`, `FFORMS_FORM`, `FLOW_WORKFLOW`, `FOUNDRY_DATASET`, `FOUNDRY_DEPLOYED_APP`, `FOUNDRY_ACADEMY_TUTORIAL`, `FOUNDRY_CONTAINER_SERVICE_CONTAINER`, `FOUNDRY_ML_OBJECTIVE`, `FOUNDRY_TEMPLATES_TEMPLATE`, `FUSION_DOCUMENT`, `GEOTIME_CATALOG_INTEGRATION`, `GPS_VIEW`, `HUBBLE_EXPLORATION_LAYOUT`, `HYPERAUTO_INTEGRATION`, `LOGIC_FLOWS_CONNECTED_FLOW`, `MACHINERY_DOCUMENT`, `MAGRITTE_AGENT`, `MAGRITTE_DRIVER`, `MAGRITTE_EXPORT`, `MAGRITTE_SOURCE`, `MARKETPLACE_BLOCK_SET_INSTALLATION`, `MARKETPLACE_BLOCK_SET_REPO`, `MARKETPLACE_LOCAL`, `MARKETPLACE_REMOTE_STORE`, `MIO_MEDIA_SET`, `MODELS_MODEL`, `MODELS_MODEL_VERSION`, `MONOCLE_GRAPH`, `NOTEPAD_NOTEPAD`, `NOTEPAD_NOTEPAD_TEMPLATE`, `OBJECT_SENTINEL_MONITOR`, `OBJECT_SET_VERSIONED_OBJECT_SET`, `OPUS_GRAPH`, `OPUS_GRAPH_TEMPLATE`, `OPUS_MAP`, `OPUS_MAP_LAYER`, `OPUS_MAP_TEMPLATE`, `OPUS_SEARCH_AROUND`, `QUIVER_ANALYSIS`, `QUIVER_ARTIFACT`, `QUIVER_DASHBOARD`, `QUIVER_FUNCTION`, `QUIVER_OBJECT_SET_PATH`, `REPORT_REPORT`, `SLATE_DOCUMENT`, `SOLUTION_DESIGN_DIAGRAM`, `STEMMA_REPOSITORY`, `TABLES_TABLE`, `TAURUS_WORKFLOW`, `THIRD_PARTY_APPLICATIONS_APPLICATION`, `TIME_SERIES_CATALOG_SYNC`, `VECTOR_TEMPLATE`, `VECTOR_WORKBOOK`, `WORKSHOP_MODULE`, `WORKSHOP_STATE`
        "The type of the resource derived from the Resource Identifier (RID)."
      - `createdBy` · string · required
        "The user that created the resource"
      - `updatedBy` · string · required
        "The user that last updated the resource."
      - `createdTime` · string · required
        "The timestamp that the resource was last created."
      - `updatedTime` · string · required
        "The timestamp that the resource was last modified. For folders, this includes any of its descendants. For top level folders (spaces and projects), this is not updated by child updates for performance reasons."
      - `trashStatus` · enum · required
        one of `DIRECTLY_TRASHED`, `ANCESTOR_TRASHED`, `NOT_TRASHED`
        "The trash status of the resource. If trashed, this could either be because the resource itself has been trashed or because one of its ancestors has been trashed."
      - `parentFolderRid` · string · required
        "The parent folder Resource Identifier (RID). For projects, this will be the Space RID."
      - `projectRid` · string · required
        "The Project Resource Identifier (RID) that the resource lives in. If the resource itself is a Project, this value will still be populated with the Project RID."
      - `spaceRid` · string · required
        "The Space Resource Identifier (RID) that the resource lives in."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `InvalidFolder` (INVALID_ARGUMENT) — "The given resource is not a Folder."
- `GetRootFolderNotSupported` (INVALID_ARGUMENT) — "Getting the root folder as a resource is not supported."
- `GetSpaceResourceNotSupported` (INVALID_ARGUMENT) — "Getting a space as a resource is not supported."
- `FolderNotFound` (NOT_FOUND) — "The given Folder could not be found."
- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
