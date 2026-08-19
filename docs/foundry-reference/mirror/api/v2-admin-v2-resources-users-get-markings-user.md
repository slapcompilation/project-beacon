<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/users/get-markings-user/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Markings User

`GET /api/v2/admin/users/{userId}/getMarkings`

Retrieve Markings that the user is currently a member of.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `userId` · string · required
  "A Foundry User ID."

## Response

- `GetUserMarkingsResponse` · object · required
  - `view` · list
    "The markings that the user has access to. The user will be able to access resources protected with these markings. This includes organization markings for organizations in which the user is a guest member."
    - `MarkingId` · string · required
      "The ID of a security marking."

## Errors

- `UserDeleted` (INVALID_ARGUMENT) — "The user is deleted."
- `GetMarkingsUserPermissionDenied` (PERMISSION_DENIED) — "Could not getMarkings the User."
- `UserNotFound` (NOT_FOUND) — "The given User could not be found."
