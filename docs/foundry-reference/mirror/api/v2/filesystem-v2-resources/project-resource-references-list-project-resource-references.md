<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/project-resource-references/list-project-resource-references/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Project Resource References

`GET /api/v2/filesystem/projects/{projectRid}/references`

List all references in the given project


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-read`.

Scopes: `api:filesystem-read`

## Path parameters

- `projectRid` · string · required
  "The unique resource identifier (RID) of a Project."

## Query parameters

- `referenceType` · enum
  one of `EXTERNAL`, `FILESYSTEM`
  "Filter references by type. If not provided, all references are returned."
- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListProjectResourceReferencesResponse` · object · required
  - `data` · list
    - `ProjectResourceReference` · object · required
      - `reference` · union · required
        "A [reference](/docs/foundry/security/projects-and-roles/#references) represents a resource from outside of the current project that has been imported to the given project."
        - `external` · object
          "A reference to a resource that exists outside of the Foundry filesystem such as a spark profile or an LLM model."
          - `resourceRid` · string · required
            "The resource identifier of the external resource."
          - `name` · string · required
            "The user-provided label for this reference, used to identify the import within the project."
          - `importedAt` · string · required
          - `importedBy` · string · required
            "A Foundry User ID."
        - `filesystem` · object
          "A reference to a resource that exists within another project"
          - `resourceRid` · string · required
            "The unique resource identifier (RID) of a resource."
          - `name` · string · required
            "The display name of the referenced resource."
          - `importedAt` · string · required
          - `importedBy` · string · required
            "A Foundry User ID."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `ProjectNotFound` (NOT_FOUND) — "The given Project could not be found."
