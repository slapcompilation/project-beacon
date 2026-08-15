<!-- source: https://palantir.com/docs/foundry/api/v2/aip-agents-v2-resources/sessions/get-session/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Session

`GET /api/v2/aipAgents/agents/{agentRid}/sessions/{sessionRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get the details of a conversation session between the calling user and an Agent.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:aip-agents-read`.

Scopes: `api:aip-agents-read`

## Path parameters

- `agentRid` · string · required
  "An RID identifying an Agent created in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."
- `sessionRid` · string · required
  "The Resource Identifier (RID) of the conversation session."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `Session` · object · required
  - `rid` · string · required
    "The Resource Identifier (RID) of the conversation session."
  - `metadata` · object · required
    "Metadata about the session."
    - `title` · string · required
      "The title of the session."
    - `createdTime` · string · required
      "The time the session was created."
    - `updatedTime` · string · required
      "The time the session was last updated."
    - `messageCount` · integer · required
      "The count of messages in the session. Includes both user messages and Agent replies, so each complete exchange counts as two messages."
    - `estimatedExpiresTime` · string · required
      "The estimated time at which the session is due to expire. Once a session has expired, it can no longer be accessed and a new session must be created. The expiry time is automatically extended when new exchanges are added to the session."
  - `agentRid` · string · required
    "The Resource Identifier (RID) of the Agent associated with the session."
  - `agentVersion` · string · required
    "The version of the Agent associated with the session. This can be set by clients on session creation. If not specified, defaults to use the latest published version of the Agent at session creation time."

## Errors

- `SessionNotFound` (NOT_FOUND) — "The given Session could not be found."
- `AgentNotFound` (NOT_FOUND) — "The given Agent could not be found."
