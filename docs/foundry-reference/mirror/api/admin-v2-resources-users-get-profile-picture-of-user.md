<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/users/get-profile-picture-of-user/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Profile Picture Of User

`GET /api/v2/admin/users/{userId}/profilePicture`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `userId` · string · required
  "A Foundry User ID."

## Response

- `body` · string · required
  "The user's profile picture in binary format. The format is the original format uploaded by the user. The response will contain a `Content-Type` header that can be used to identify the media type."

## Errors

- `InvalidProfilePicture` (INVALID_ARGUMENT) — "The user's profile picture is not a valid image"
- `ProfileServiceNotPresent` (INTERNAL) — "The Profile service is unexpectedly not present."
- `UserDeleted` (INVALID_ARGUMENT) — "The user is deleted."
- `GetProfilePictureOfUserPermissionDenied` (PERMISSION_DENIED) — "Could not profilePicture the User."
- `UserNotFound` (NOT_FOUND) — "The given User could not be found."
