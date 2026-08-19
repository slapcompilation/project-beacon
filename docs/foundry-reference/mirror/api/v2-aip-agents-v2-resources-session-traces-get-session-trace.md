<!-- source: https://palantir.com/docs/foundry/api/v2/aip-agents-v2-resources/session-traces/get-session-trace/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Session Trace

`GET /api/v2/aipAgents/agents/{agentRid}/sessions/{sessionRid}/sessionTraces/{sessionTraceId}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get the trace of an Agent response. The trace lists the sequence of steps that an Agent took to arrive at
an answer. For example, a trace may include steps such as context retrieval and tool calls. Clients should
poll this endpoint to check the realtime progress of a response until the trace is completed.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:aip-agents-read`.

Scopes: `api:aip-agents-read`

## Path parameters

- `agentRid` · string · required
  "An RID identifying an Agent created in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."
- `sessionRid` · string · required
  "The Resource Identifier (RID) of the conversation session."
- `sessionTraceId` · string · required
  "The unique identifier for the trace."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `SessionTrace` · object · required
  - `id` · string · required
    "The unique identifier for the trace."
  - `status` · enum · required
    one of `IN_PROGRESS`, `COMPLETE`
    "This indicates whether the Agent has finished generating the final response. Clients should keep polling the `getSessionTrace` endpoint until the status is `COMPLETE`."
  - `contexts` · object
    "Any additional context which was provided by the client or retrieved automatically by the agent, grouped by context type. Empty if no additional context was provided or configured to be automatically retrieved. A present SessionExchangeContexts object with empty lists indicates that context retrieval was attempted but no context was found. Note that this field will only be populated once the response generation has completed."
    - `objectContexts` · list
      "Relevant object context for the user's message that was included in the prompt to the Agent."
      - `ObjectContext` · object · required
        "Details of relevant retrieved object instances for a user's message to include as additional context in the prompt to the Agent."
        - `objectRids` · list
          "The RIDs of the relevant object instances to include in the prompt."
          - `ObjectRid` · string · required
            "The unique resource identifier of an object, useful for interacting with other Foundry APIs."
        - `propertyTypeRids` · list
          "The RIDs of the property types for the given objects to include in the prompt."
          - `PropertyTypeRid` · string · required
            "The unique resource identifier of a property."
    - `functionRetrievedContexts` · list
      "Context retrieved from running a function that was included as additional context in the prompt to the Agent."
      - `FunctionRetrievedContext` · object · required
        "Context retrieved from running a function to include as additional context in the prompt to the Agent."
        - `functionRid` · string · required
          "The unique resource identifier of a Function, useful for interacting with other Foundry APIs."
        - `functionVersion` · string · required
          "The version of the given Function, written `<major>.<minor>.<patch>-<tag>`, where `-<tag>` is optional. Examples: `1.2.3`, `1.2.3-rc1`."
        - `retrievedPrompt` · string · required
          "String content returned from a context retrieval function."
  - `toolCallGroups` · list
    "List of tool call groups that were triggered at the same point in the trace for the agent response generation. The groups are returned in the same order as they were triggered by the agent."
    - `ToolCallGroup` · object · required
      "List of tool calls that were triggered at the same point in the trace for the agent response generation."
      - `toolCalls` · list
        - `ToolCall` · object · required
          "A tool call with its input and output."
          - `toolMetadata` · object · required
            "Details about the tool that was called, including the name and type of the tool."
            - `name` · string · required
              "The name of the tool that was called, as configured on the Agent."
            - `type` · enum · required
              one of `FUNCTION`, `ACTION`, `ONTOLOGY_SEMANTIC_SEARCH`, `OBJECT_QUERY`, `UPDATE_APPLICATION_VARIABLE`, `REQUEST_CLARIFICATION`, `OBJECT_QUERY_WITH_SQL`, `CODE_EXECUTION`
              "The type of the tool that was called."
          - `input` · object · required
            "Input parameters for a tool call."
            - `thought` · string
              "Any additional message content that the Agent provided for why it chose to call the tool."
            - `inputs` · map
              - `ToolInputName` · string · required
                "The name of a tool input parameter."
              - `ToolInputValue` · union · required
                "A tool input value, which can be either a string or a Resource Identifier (RID)."
                - `string` · object
                  "A string value that was passed as input to a tool."
                  - `value` · string · required
                - `rid` · object
                  "A Resource Identifier (RID) that was passed as input to a tool."
                  - `rid` · string · required
          - `output` · union
            "Empty if the tool call is in progress."
            - `success` · object
              "The successful output of a tool call."
              - `output` · union · required
                "A tool output value, which can be either a string or a Resource Identifier (RID)."
                - `string` · object
                  "A string value that was returned from a tool."
                  - `value` · string · required
                - `rid` · object
                  "A Resource Identifier (RID) value that was returned from a tool."
                  - `rid` · string · required
            - `failure` · object
              "The failed output of a tool call."
              - `correctionMessage` · string · required
                "The correction message returned by the tool if the tool call was not successful. This is a message that the tool returned to the Agent, which may be used to correct the Agent's input to the tool."

## Errors

- `SessionTraceNotFound` (NOT_FOUND) — "The given SessionTrace could not be found."
- `SessionNotFound` (NOT_FOUND) — "The given Session could not be found."
- `AgentNotFound` (NOT_FOUND) — "The given Agent could not be found."
