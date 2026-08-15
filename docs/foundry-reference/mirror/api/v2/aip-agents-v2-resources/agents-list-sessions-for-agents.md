<!-- source: https://palantir.com/docs/foundry/api/v2/aip-agents-v2-resources/agents/list-sessions-for-agents/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Sessions For Agents

`GET /api/v2/aipAgents/agents/allSessions`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

List all conversation sessions between the calling user and all accessible Agents that were created by this client.
Sessions are returned in order of most recently updated first.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:aip-agents-write`.

Scopes: `api:aip-agents-write`

## Query parameters

- `pageSize` · integer
  "The maximum number of sessions to return in a single page. The maximum allowed value is 100. Defaults to 100 if not specified."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `AgentsSessionsPage` · object · required
  "A page of results for sessions across all accessible Agents for the calling user. Sessions are returned in order of most recently updated first."
  - `nextPageToken` · string
    "The page token that should be used when requesting the next page of results. Empty if there are no more results to retrieve."
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

## Errors

- `GetAllSessionsAgentsPermissionDenied` (PERMISSION_DENIED) — "The calling user does not have permission to list all sessions across all Agents.
Listing all sessions across all agents requires the `api:aip-agents-write` scope."
- `ListSessionsForAgentsPermissionDenied` (PERMISSION_DENIED) — "Could not allSessions the Agent."
