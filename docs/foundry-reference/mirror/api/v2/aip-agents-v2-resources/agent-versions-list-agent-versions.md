<!-- source: https://palantir.com/docs/foundry/api/v2/aip-agents-v2-resources/agent-versions/list-agent-versions/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Agent Versions

`GET /api/v2/aipAgents/agents/{agentRid}/agentVersions`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

List all versions for an Agent.
Versions are returned in descending order, by most recent versions first.


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

- `ListAgentVersionsResponse` · object · required
  - `data` · list
    - `AgentVersion` · object · required
      - `string` · string · required
        "The semantic version of the Agent, formatted as "majorVersion.minorVersion"."
      - `version` · object · required
        "Semantic version details of the Agent."
        - `major` · integer · required
          "The major version of the Agent. Incremented every time the Agent is published."
        - `minor` · integer · required
          "The minor version of the Agent. Incremented every time the Agent is saved."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `AgentNotFound` (NOT_FOUND) — "The given Agent could not be found."
