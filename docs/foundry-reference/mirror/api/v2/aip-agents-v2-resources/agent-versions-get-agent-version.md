<!-- source: https://palantir.com/docs/foundry/api/v2/aip-agents-v2-resources/agent-versions/get-agent-version/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Agent Version

`GET /api/v2/aipAgents/agents/{agentRid}/agentVersions/{agentVersionString}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get version details for an Agent.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:aip-agents-read`.

Scopes: `api:aip-agents-read`

## Path parameters

- `agentRid` · string · required
  "An RID identifying an Agent created in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."
- `agentVersionString` · string · required
  "The semantic version of the Agent, formatted as "majorVersion.minorVersion"."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `AgentVersion` · object · required
  - `string` · string · required
    "The semantic version of the Agent, formatted as "majorVersion.minorVersion"."
  - `version` · object · required
    "Semantic version details of the Agent."
    - `major` · integer · required
      "The major version of the Agent. Incremented every time the Agent is published."
    - `minor` · integer · required
      "The minor version of the Agent. Incremented every time the Agent is saved."

## Errors

- `InvalidAgentVersion` (INVALID_ARGUMENT) — "The provided version string is not a valid format for an Agent version."
- `NoPublishedAgentVersion` (INVALID_ARGUMENT) — "Failed to retrieve the latest published version of the Agent because the Agent has no published versions.
Try publishing the Agent in AIP Chatbot Studio to use the latest published version, or specify the version of the Agent to use."
- `AgentVersionNotFound` (NOT_FOUND) — "The given AgentVersion could not be found."
- `AgentNotFound` (NOT_FOUND) — "The given Agent could not be found."
