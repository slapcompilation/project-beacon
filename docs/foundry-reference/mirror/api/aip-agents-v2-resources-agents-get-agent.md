<!-- source: https://palantir.com/docs/foundry/api/aip-agents-v2-resources/agents/get-agent/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Agent

`GET /api/v2/aipAgents/agents/{agentRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get details for an Agent.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:aip-agents-read`.

Scopes: `api:aip-agents-read`

## Path parameters

- `agentRid` · string · required
  "An RID identifying an Agent created in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."

## Query parameters

- `version` · string
  "The version of the Agent to retrieve. If not specified, the latest published version will be returned."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `Agent` · object · required
  - `rid` · string · required
    "An RID identifying an Agent created in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."
  - `version` · string · required
    "The version of this instance of the Agent."
  - `metadata` · object · required
    "Metadata for an Agent."
    - `displayName` · string · required
      "The name of the Agent."
    - `description` · string
      "The description for the Agent."
    - `inputPlaceholder` · string
      "The default text to show as the placeholder input for chats with the Agent."
    - `suggestedPrompts` · list
      "Prompts to show to the user as example messages to start a conversation with the Agent."
  - `parameters` · map
    "The types and names of variables configured for the Agent in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/) in the [application state](/docs/foundry/chatbot-studio/application-state/). These variables can be used to send custom values in prompts sent to an Agent to customize and control the Agent's behavior."
    - `ParameterId` · string · required
      "The unique identifier for a variable configured in the application state of an Agent in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."
    - `Parameter` · object · required
      "A variable configured in the application state of an Agent in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."
      - `parameterType` · union · required
        "Details of the types of values accepted and defaults for this variable."
        - `string` · object
          - `defaultValue` · string
            "The default value to use for this variable."
        - `objectSet` · object
          - `expectedObjectTypes` · list
            "The types of objects that are expected in ObjectSet values passed for this variable."
            - `ObjectTypeId` · string · required
              "The unique identifier (ID) for an object type. This can be viewed in [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
      - `access` · enum · required
        one of `READ_ONLY`, `READ_WRITE`
        "The access mode controls how the Agent is able to interact with the variable."
      - `description` · string
        "A description to explain the use of this variable. This description is injected into the Agent's prompt to provide context for when to use the variable."

## Errors

- `NoPublishedAgentVersion` (INVALID_ARGUMENT) — "Failed to retrieve the latest published version of the Agent because the Agent has no published versions.
Try publishing the Agent in AIP Chatbot Studio to use the latest published version, or specify the version of the Agent to use."
- `InvalidAgentVersion` (INVALID_ARGUMENT) — "The provided version string is not a valid format for an Agent version."
- `AgentNotFound` (NOT_FOUND) — "The given Agent could not be found."
- `AgentVersionNotFound` (NOT_FOUND) — "The given AgentVersion could not be found."
