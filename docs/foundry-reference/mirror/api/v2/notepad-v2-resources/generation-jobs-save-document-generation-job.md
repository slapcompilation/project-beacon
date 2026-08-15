<!-- source: https://palantir.com/docs/foundry/api/v2/notepad-v2-resources/generation-jobs/save-document-generation-job/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Save Document Generation Job

`POST /api/v2/notepad/templates/{templateRid}/generationJobs/{generationJobRid}/saveDocument`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Save generated content as a new notepad document. This is only possible if the GenerationJob succeeded.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:notepad-write`.

Scopes: `api:notepad-write`

## Path parameters

- `templateRid` · string · required
  "The unique identifier for a Template"
- `generationJobRid` · string · required
  "The unique identifier for a GenerationJob"

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `SaveDocumentGenerationJobRequest` · object · required
  - `documentName` · string
    "The name of the document to save. If not provided, a name will be generated."
  - `parentFolderRid` · string · required
    "The parent folder to save the document in."

## Response

- `SaveDocumentResponse` · object · required
  "Response for saving a document"
  - `documentRid` · string · required
    "The RID of the newly created document"

## Errors

- `GenerationJobStatusFailed` (FAILED_PRECONDITION) — "The operation cannot be completed because the generation job has failed status."
- `GenerationJobStatusRunning` (FAILED_PRECONDITION) — "The operation cannot be completed because the generation job has running status."
- `InvalidDisplayName` (INVALID_ARGUMENT) — "The display name of a resource should not be exactly `.` or `..`, contain a forward slash `/` and must be
less than or equal to 700 characters."
- `ResourceNameAlreadyExists` (CONFLICT) — "The provided resource name is already in use by another resource in the same folder."
- `InvalidFolder` (INVALID_ARGUMENT) — "The given resource is not a Folder."
- `SaveDocumentGenerationJobPermissionDenied` (PERMISSION_DENIED) — "Could not saveDocument the GenerationJob."
- `FolderNotFound` (NOT_FOUND) — "The given Folder could not be found."
