<!-- source: https://palantir.com/docs/foundry/api/filesystem-v2-resources/resources/get-access-requirements/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Access Requirements

`GET /api/v2/filesystem/resources/{resourceRid}/getAccessRequirements`

Returns a list of access requirements a user needs in order to view a resource. Access requirements are
composed of Organizations and Markings, and can either be applied directly to the resource or inherited.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-read`.

Scopes: `api:filesystem-read`

## Path parameters

- `resourceRid` · string · required
  "The unique resource identifier (RID) of a resource."

## Response

- `AccessRequirements` · object · required
  "Access requirements for a resource are composed of Markings and Organizations. Organizations are disjunctive, while Markings are conjunctive."
  - `organizations` · list
    - `Organization` · object · required
      "[Organizations](/docs/foundry/security/orgs-and-spaces/#organizations) are access requirements applied to Projects that enforce strict silos between groups of users and resources. Every user is a member of only one Organization, but can be a guest member of multiple Organizations. In order to meet access requirements, users must be a member or guest member of at least one Organization applied to a Project. Organizations are inherited via the file hierarchy and direct dependencies."
      - `markingId` · string · required
        "The ID of a security marking."
      - `organizationRid` · string · required
      - `isDirectlyApplied` · boolean · required
        "Boolean flag to indicate if the marking is directly applied to the resource, or if it's applied to a parent resource and inherited by the current resource."
  - `markings` · list
    - `Marking` · object · required
      "[Markings](/docs/foundry/security/markings/) provide an additional level of access control for files, folders, and Projects within Foundry. Markings define eligibility criteria that restrict visibility and actions to users who meet those criteria. To access a resource, a user must be a member of all Markings applied to a resource to access it."
      - `markingId` · string · required
        "The ID of a security marking."
      - `isDirectlyApplied` · boolean · required
        "Boolean flag to indicate if the marking is directly applied to the resource, or if it's applied to a parent resource and inherited by the current resource."

## Errors

- `GetAccessRequirementsPermissionDenied` (PERMISSION_DENIED) — "Could not getAccessRequirements the Resource."
- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
