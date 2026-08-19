<!-- source: https://palantir.com/docs/foundry/api/v2/aip-agents-v2-resources/sessions/update-session-title/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Update Session Title

`PUT /api/v2/aipAgents/agents/{agentRid}/sessions/{sessionRid}/updateTitle`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Update the title for a session.
Use this to set a custom title for a session to help identify it in the list of sessions with an Agent.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:aip-agents-write`.

Scopes: `api:aip-agents-write`

## Path parameters

- `agentRid` · string · required
  "An RID identifying an Agent created in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."
- `sessionRid` · string · required
  "The Resource Identifier (RID) of the conversation session."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `UpdateSessionTitleRequest` · object · required
  - `title` · string · required
    "The new title for the session. The maximum title length is 200 characters. Titles are truncated if they exceed this length."

## Errors

- `UpdateSessionTitlePermissionDenied` (PERMISSION_DENIED) — "Could not updateTitle the Session."
- `SessionNotFound` (NOT_FOUND) — "The given Session could not be found."
- `AgentNotFound` (NOT_FOUND) — "The given Agent could not be found."
