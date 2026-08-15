<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/project-resource-references/add-project-resource-references/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Add Project Resource References

`POST /api/v2/filesystem/projects/{projectRid}/references/add`

Add references to the given project


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Path parameters

- `projectRid` · string · required
  "The unique resource identifier (RID) of a Project."

## Request

- `AddProjectResourceReferencesRequest` · object · required
  - `resources` · list
    - `AddResourceReferenceRequest` · union · required
      "A request to add a resource as a reference to a project"
      - `external` · object
        "A request to add an external resource as a reference to a project"
        - `resourceRid` · string · required
          "The resource identifier of the external resource to add as a reference. Note that this is not a Foundry filesystem resource."
        - `importName` · string · required
          "A user-provided label for this reference, used to identify the import within the project."
      - `filesystem` · object
        "A request to add a resource from the filesystem as a reference to a project"
        - `resourceRid` · string · required
          "The unique resource identifier (RID) of a resource."

## Errors

- `InvalidResourceReference` (INVALID_ARGUMENT) — "The resource reference is invalid. This can occur when the resource identifier is malformed,
the resource type does not match the reference type, or the resource cannot be added as a reference."
- `InvalidProject` (INVALID_ARGUMENT) — "The provided resource identifier does not refer to a valid project."
- `AddProjectResourceReferencesPermissionDenied` (PERMISSION_DENIED) — "Could not add the ProjectResourceReference."
- `ProjectNotFound` (NOT_FOUND) — "The given Project could not be found."
- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
