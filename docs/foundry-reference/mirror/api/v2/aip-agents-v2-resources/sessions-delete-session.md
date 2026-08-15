<!-- source: https://palantir.com/docs/foundry/api/v2/aip-agents-v2-resources/sessions/delete-session/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Delete Session

`DELETE /api/v2/aipAgents/agents/{agentRid}/sessions/{sessionRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Delete a conversation session between the calling user and an Agent.
Once deleted, the session can no longer be accessed and will not appear in session lists.


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

## Errors

- `DeleteSessionPermissionDenied` (PERMISSION_DENIED) — "Could not delete the Session."
- `SessionNotFound` (NOT_FOUND) — "The given Session could not be found."
- `AgentNotFound` (NOT_FOUND) — "The given Agent could not be found."
