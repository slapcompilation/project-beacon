<!-- source: https://palantir.com/docs/foundry/api/v2/aip-agents-v2-resources/sessions/list-sessions/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Sessions

`GET /api/v2/aipAgents/agents/{agentRid}/sessions`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

List all conversation sessions between the calling user and an Agent that was created by this client.
This does not list sessions for the user created by other clients.
For example, any sessions created by the user in AIP Chatbot Studio will not be listed here.
Sessions are returned in order of most recently updated first.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:aip-agents-read`.

Scopes: `api:aip-agents-read`

## Path parameters

- `agentRid` · string · required
  "An RID identifying an Agent created in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ListSessionsResponse` · object · required
  - `data` · list
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
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `AgentNotFound` (NOT_FOUND) — "The given Agent could not be found."
