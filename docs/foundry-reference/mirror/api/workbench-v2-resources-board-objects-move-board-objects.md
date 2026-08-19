<!-- source: https://palantir.com/docs/foundry/api/workbench-v2-resources/board-objects/move-board-objects/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Move Board Objects

`PUT /api/v2/workbench/boards/{boardRid}/objects/move`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Moves Foundry Objects from their current state to a different state on a Workbench Board.
This operation preserves the objects' board item identifiers and edit history, allowing users
to track the objects' progression through workflow states.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:workbench-write`.

Scopes: `api:workbench-write`

## Path parameters

- `boardRid` · string · required
  "The unique identifier for a Workbench Board"

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `MoveBoardObjectsRequest` · object · required
  - `objectRids` · list
    "The RIDs of the Foundry Objects to move"
    - `FoundryObjectRid` · string · required
      "The unique identifier for a Foundry Object"
  - `stateId` · string · required
    "The destination state (column) to move the objects to"

## Response

- `EmptySuccessResponse` · any · required
  "An empty response object indicating the request was successful"

## Errors

- `ObjectNotOnBoard` (NOT_FOUND) — "One or more objects are not on the specified board and cannot be moved."
- `BoardStateNotFound` (NOT_FOUND) — "The specified state does not exist on the board."
- `BoardOperationNotSupported` (INVALID_ARGUMENT) — "The requested operation cannot be performed on this board."
- `MoveBoardObjectsPermissionDenied` (PERMISSION_DENIED) — "Could not move the BoardObject."
