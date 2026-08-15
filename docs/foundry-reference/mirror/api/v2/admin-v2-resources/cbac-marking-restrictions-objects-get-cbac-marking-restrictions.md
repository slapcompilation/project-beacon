<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/cbac-marking-restrictions-objects/get-cbac-marking-restrictions/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Cbac Marking Restrictions

`GET /api/v2/admin/cbacMarkingRestrictions`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Returns disallowed, implied, and required markings for the given set of marking IDs.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Query parameters

- `markingIds` · list
  "The marking IDs for which to get restrictions."
  - `MarkingId` · string · required
    "The ID of a security marking."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `CbacMarkingRestrictions` · object · required
  - `disallowedMarkings` · list
    "Markings that cannot appear in conjunction with the provided markings. This includes all such markings, not just those present in the provided set."
    - `MarkingId` · string · required
      "The ID of a security marking."
  - `impliedMarkings` · list
    "Markings that are automatically granted when a user has membership in any of the provided markings."
    - `MarkingId` · string · required
      "The ID of a security marking."
  - `requiredMarkings` · list
    "Markings that must appear in conjunction with the provided markings. Each list contains the requirements for one of the provided markings, and at least one marking from each must be included in the provided markingIds to constitute a valid classification."
    - `array` · list · required
      - `MarkingId` · string · required
        "The ID of a security marking."
  - `userSatisfiesMarkings` · boolean · required
    "True if the current user satisfies the provided markings. The user must be a member of all conjunctive markings. The provided disjunctive markings are grouped by category, and the user must be a member of at least one marking in each group."
  - `isValid` · boolean · required
    "True if the provided markings constitute a valid classification, containing no disallowed markings and satisfying all required marking constraints."

## Errors

- `GetCbacMarkingRestrictionInfoPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to get the CBAC marking restrictions for the markings."
- `CbacUnavailable` (INVALID_ARGUMENT) — "CBAC is not available."
- `CbacMarkingRestrictionsNotFound` (NOT_FOUND) — "The given CbacMarkingRestrictions could not be found."
