<!-- source: https://palantir.com/docs/foundry/api/aip-agents-v2-resources/sessions/create-session/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Session

`POST /api/v2/aipAgents/agents/{agentRid}/sessions`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Create a new conversation session between the calling user and an Agent.
Use `blockingContinue` or `streamingContinue` to start adding exchanges to the session.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:aip-agents-write`.

Scopes: `api:aip-agents-write`

## Path parameters

- `agentRid` · string · required
  "An RID identifying an Agent created in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `CreateSessionRequest` · object · required
  - `agentVersion` · string
    "The version of the Agent associated with the session. This can be set by clients on session creation. If not specified, defaults to use the latest published version of the Agent at session creation time."

## Response

- `Session` · object · required
  "The created Session"
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

- `NoPublishedAgentVersion` (INVALID_ARGUMENT) — "Failed to retrieve the latest published version of the Agent because the Agent has no published versions.
Try publishing the Agent in AIP Chatbot Studio to use the latest published version, or specify the version of the Agent to use."
- `ObjectTypeIdsNotFound` (NOT_FOUND) — "Some object types are configured for use by the Agent but could not be found.
The object types either do not exist or the client token does not have access.
Object types can be checked by listing available object types through the API, or searching in [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
- `ObjectTypeRidsNotFound` (NOT_FOUND) — "Some object types are configured for use by the Agent but could not be found.
The object types either do not exist or the client token does not have access.
Object types can be checked by listing available object types through the API, or searching in [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
- `FunctionLocatorNotFound` (NOT_FOUND) — "The specified function locator is configured for use by the Agent but could not be found.
The function type or version may not exist or the client token does not have access."
- `InvalidAgentVersion` (INVALID_ARGUMENT) — "The provided version string is not a valid format for an Agent version."
- `OntologyEntitiesNotFound` (NOT_FOUND) — "Some ontology types are configured for use by the Agent but could not be found.
The types either do not exist or the client token does not have access.
Object types and their link types can be checked by listing available object/link types through the API, or searching in [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
- `UnsupportedLanguageModelRid` (INVALID_ARGUMENT) — "The Agent is configured with a language model that is not supported or could not be resolved.
This can surface at runtime if the model was deprecated or is not accessible to the calling token.
Update the Agent's language model in AIP Chatbot Studio."
- `ActionTypeNotFound` (INVALID_ARGUMENT) — "An action tool configured on the Agent references an action type that could not be found.
This can surface at runtime if the action type was deleted or is not accessible to the calling token.
Verify the action type exists and is accessible, then review the Agent's tools in AIP Chatbot Studio."
- `CreateSessionPermissionDenied` (PERMISSION_DENIED) — "Could not create the Session."
- `AgentNotFound` (NOT_FOUND) — "The given Agent could not be found."
- `AgentVersionNotFound` (NOT_FOUND) — "The given AgentVersion could not be found."
- `SessionNotFound` (NOT_FOUND) — "The given Session could not be found."
