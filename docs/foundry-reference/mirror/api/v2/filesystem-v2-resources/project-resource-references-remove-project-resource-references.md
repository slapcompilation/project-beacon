<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/project-resource-references/remove-project-resource-references/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Remove Project Resource References

`POST /api/v2/filesystem/projects/{projectRid}/references/remove`

Remove references from the given project


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Path parameters

- `projectRid` · string · required
  "The unique resource identifier (RID) of a Project."

## Request

- `RemoveProjectResourceReferencesRequest` · object · required
  - `resources` · list
    "The resource identifiers to remove as references. These may be either filesystem or external resource identifiers."

## Errors

- `InvalidResourceReference` (INVALID_ARGUMENT) — "The resource reference is invalid. This can occur when the resource identifier is malformed,
the resource type does not match the reference type, or the resource cannot be added as a reference."
- `InvalidProject` (INVALID_ARGUMENT) — "The provided resource identifier does not refer to a valid project."
- `RemoveProjectResourceReferencesPermissionDenied` (PERMISSION_DENIED) — "Could not remove the ProjectResourceReference."
- `ProjectNotFound` (NOT_FOUND) — "The given Project could not be found."
- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
