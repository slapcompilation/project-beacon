<!-- source: https://palantir.com/docs/foundry/api/filesystem-v2-resources/resources/get-resources-batch/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Resources Batch

`POST /api/v2/filesystem/resources/getBatch`

Fetches multiple resources in a single request.
Returns a map from RID to the corresponding resource. If a resource does not exist, or if it is a root folder or space, its RID will not be included in the map.
At most 1,000 resources should be requested at once.


The maximum batch size for this endpoint is 1000.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-read`.

Scopes: `api:filesystem-read`

## Request

- `body` · list · required
  - `GetResourcesBatchRequestElement` · object · required
    - `resourceRid` · string · required
      "The unique resource identifier (RID) of a resource."

## Response

- `GetResourcesBatchResponse` · object · required
  - `data` · map
    - `ResourceRid` · string · required
      "The unique resource identifier (RID) of a resource."
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
