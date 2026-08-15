<!-- source: https://palantir.com/docs/foundry/api/v2/notepad-v2-resources/templates/generate-template/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Generate Template

`POST /api/v2/notepad/templates/{templateRid}/generate`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Creates a new GenerationJob. The template generation job will produce new document content by applying 
template parameters to an existing template. If the GenerationJob succeeds, the resulting contents can
be saved as a new Document or exported to a File.

The user must have the api:notepad-write scope to create GenerationJobs. Once created a GenerationJob
is only accessible to the user that created it.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:notepad-write`.

Scopes: `api:notepad-write`

## Path parameters

- `templateRid` · string · required
  "The unique identifier for a Template"

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `GenerateTemplateRequest` · object · required
  - `templateVersion` · string
    "The published version of the template to use. If not provided, the latest published version will be used."
  - `templateParameters` · map
    "The parameters to apply to the template during generation."
    - `TemplateParameterName` · string · required
      "The name of a Template parameter"
    - `TemplateParameterValue` · union · required
      "A value for a template parameter"
      - `objectSetRid` · object
        "Object set RID parameter value"
        - `value` · string · required
      - `date` · object
        "Date parameter value"
        - `value` · string · required
      - `dateTime` · object
        "DateTime parameter value"
        - `timestamp` · string · required
          "The number of milliseconds since Unix epoch (January 1, 1970 00:00:00 UTC)."
        - `timezone` · string · required
          "The timezone associated with the DateTime value. Only IANA timezones are accepted (a two part timezone ID in the form of Area/Location, e.g. 'America/New_York')."
      - `string` · object
        "String parameter value"
        - `value` · string · required
      - `double` · object
        "Double parameter value"
        - `value` · number · required
      - `objectRid` · object
        "Object RID parameter value"
        - `value` · string · required
          "The unique resource identifier of an object, useful for interacting with other Foundry APIs."

## Response

- `GenerationJobRid` · string · required
  "The unique identifier for a GenerationJob"

## Errors

- `TemplateNotFound` (NOT_FOUND) — "The requested template was not found."
- `InvalidTimezone` (INVALID_ARGUMENT) — "The provided timezone is not valid."
- `InvalidGenerationJobTemplateVersion` (INVALID_ARGUMENT) — "The provided template version doesn't exist or the template has no published versions."
- `MissingGenerationJobTemplateParameters` (INVALID_ARGUMENT) — "One or more template parameters are missing."
- `InvalidGenerationJobTemplateParameter` (INVALID_ARGUMENT) — "A template parameter value is invalid (for example, is of the wrong type)."
- `GenerateTemplatePermissionDenied` (PERMISSION_DENIED) — "Could not generate the Template."
