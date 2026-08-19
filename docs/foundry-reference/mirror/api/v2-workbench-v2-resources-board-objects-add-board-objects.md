<!-- source: https://palantir.com/docs/foundry/api/v2/workbench-v2-resources/board-objects/add-board-objects/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Add Board Objects

`PUT /api/v2/workbench/boards/{boardRid}/objects/add`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Adds Foundry Objects to a Workbench Board. This operation links the objects to the board,
allowing them to be tracked within the board's workflow. If no state is specified, the objects
will be placed in the board's default state (first column).


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:workbench-write`.

Scopes: `api:workbench-write`

## Path parameters

- `boardRid` · string · required
  "The unique identifier for a Workbench Board"

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `AddBoardObjectsRequest` · object · required
  - `objectRids` · list
    "The RIDs of the Foundry Objects to add to the board"
    - `FoundryObjectRid` · string · required
      "The unique identifier for a Foundry Object"
  - `stateId` · string
    "Optional state (column) to place the objects in. If not specified, the objects will be placed in the board's default state (the first state in the board's configured order)."

## Response

- `EmptySuccessResponse` · any · required
  "An empty response object indicating the request was successful"

## Errors

- `ObjectAlreadyOnBoard` (CONFLICT) — "One or more objects are already on the specified board and cannot be added again."
- `BoardStateNotFound` (NOT_FOUND) — "The specified state does not exist on the board."
- `BoardHasNoDefaultState` (INVALID_ARGUMENT) — "The board has no default state configured and no state was specified in the request."
- `ObjectNotFound` (NOT_FOUND) — "One or more Foundry Objects could not be found or accessed."
- `ObjectTypeNotSupported` (INVALID_ARGUMENT) — "One or more objects do not implement the interface type or object type required by the board."
- `BoardInterfaceTypeNotSet` (FAILED_PRECONDITION) — "The board requires an interface type to be configured before objects can be added."
- `ObjectSecurityNotSatisfied` (INVALID_ARGUMENT) — "One or more objects do not satisfy the security requirements of the board."
- `BoardExceededItemLimit` (INVALID_ARGUMENT) — "Adding the requested objects would exceed the maximum number of items allowed on the board."
- `BoardOperationNotSupported` (INVALID_ARGUMENT) — "The requested operation cannot be performed on this board."
- `AddBoardObjectsPermissionDenied` (PERMISSION_DENIED) — "Could not add the BoardObject."
