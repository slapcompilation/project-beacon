<!-- source: https://palantir.com/docs/foundry/api/ontology-mcp-v2-resources/mcp-servers/get-mcp-server/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Mcp Server

`GET /api/v2/ontologyMcp/mcpServers/{mcpServerRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get details of an MCP server.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontology-mcp-read`.

Scopes: `api:ontology-mcp-read`

## Path parameters

- `mcpServerRid` · string · required
  "The RID of the MCP server."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `McpServer` · object · required
  - `rid` · string · required
    "The RID of the MCP server."
  - `name` · string · required
    "The display name of the MCP server."
  - `description` · string
    "An LLM-oriented description of the MCP server."
  - `backingResource` · union · required
    "The resource that backs this MCP server."
    - `thirdPartyApplication` · object
      "A third-party application that backs an MCP server."
      - `rid` · string · required
        "The RID of a third-party application backing an MCP server."
    - `artifactsRepository` · object
      "An artifacts repository that backs an MCP server."
      - `rid` · string · required
        "The RID of an artifacts repository that backs an MCP server. Today this can only be the RID of a Stemma repository that publishes an OSDK package."
  - `toolConfig` · map
    "Per-tool configuration overlay, keyed by tool ID."
    - `ToolId` · string · required
      "A stable identifier for a tool exposed by an MCP server. For derived tools (actions, functions) this is the underlying API name; for generic tools (e.g. OSQL) this is a stable string identifier."
    - `ToolConfig` · object · required
      "User configuration for a tool exposed by an MCP server."
      - `enabled` · boolean · required
        "Whether the tool is enabled for this MCP server."

## Errors

- `McpServerNotFound` (NOT_FOUND) — "The given McpServer could not be found."
