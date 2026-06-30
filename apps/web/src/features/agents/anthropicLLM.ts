// AnthropicLLMClient — implements the @beacon/reality-graph LLMClient interface
// by proxying through the agent-llm edge function. The Anthropic API key never
// reaches the browser; the function checks the user's auth + injects it.
//
// Two modes, both single-request-per-call:
//   • extraction (no tools): returns the structured output verbatim.
//   • tool loop (tools present): a JSON tool-protocol — the model replies with
//     {action:'call_tool', tool, input, thought} or {action:'final', output}.
//     runToolLoop drives the loop, executing tools and feeding results back as
//     messages. This reuses the JSON-output edge fn — no native tool-use needed.

import { supabase } from '@/lib/supabase/client'
import type { LLMCallInput, LLMClient, LLMResponse } from '@beacon/reality-graph'

interface EdgeFunctionResponse {
  output?: unknown
  tokensUsed?: number
  error?: string
  raw?: string
}

interface ToolProtocolReply {
  action?: 'call_tool' | 'final'
  tool?: string
  input?: unknown
  thought?: string
  output?: unknown
}

export class AnthropicLLMClient implements LLMClient {
  async call<T>(input: LLMCallInput<T>): Promise<LLMResponse<T>> {
    const messages = input.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const usingTools = !!input.tools && input.tools.length > 0

    if (!usingTools) {
      const data = await this.invokeEdge({
        systemPrompt: input.systemPrompt,
        messages,
        outputSchema: serializeSchema(input.outputSchema),
      })
      return { output: data.output as T, toolCalls: [], tokensUsed: data.tokensUsed ?? 0 }
    }

    // Tool-loop turn: describe the tools + the JSON protocol, let the model pick.
    const toolList = (input.tools ?? [])
      .map((t) => `- ${t.name}: ${t.description}\n    input: ${JSON.stringify(serializeSchema(t.inputSchema))}`)
      .join('\n')
    const protocolSystem =
      `${input.systemPrompt}\n\n` +
      `AVAILABLE TOOLS:\n${toolList}\n\n` +
      `Respond with exactly ONE JSON object, no prose:\n` +
      `• to call a tool: {"action":"call_tool","tool":"<name>","input":{...},"thought":"<why>"}\n` +
      `• when finished:  {"action":"final","output":${JSON.stringify(serializeSchema(input.outputSchema))}}\n` +
      `Call one tool at a time; read its result before the next. Use only the tools listed.`

    const data = await this.invokeEdge({
      systemPrompt: protocolSystem,
      messages,
      outputSchema: { action: 'call_tool | final', tool: 'string', input: 'object', thought: 'string', output: 'object' },
      maxTokens: 2048,
    })
    const reply = (data.output ?? {}) as ToolProtocolReply
    const tokensUsed = data.tokensUsed ?? 0

    if (reply.action === 'call_tool' && typeof reply.tool === 'string') {
      return {
        toolCalls: [{ toolName: reply.tool, input: reply.input ?? {}, thought: reply.thought }],
        tokensUsed,
      }
    }
    // 'final' (or an unwrapped object the model returned directly) → terminal output.
    const output = (reply.action === 'final' ? reply.output : reply) as T
    return { output, toolCalls: [], tokensUsed }
  }

  private async invokeEdge(body: Record<string, unknown>): Promise<EdgeFunctionResponse> {
    const invokeResult = await supabase.functions.invoke<EdgeFunctionResponse>('agent-llm', { body })
    const data = invokeResult.data
    const error: unknown = invokeResult.error
    if (error instanceof Error) throw new Error(`agent-llm edge function failed: ${error.message}`)
    if (!data) throw new Error('agent-llm returned no data')
    if (data.error) throw new Error(`agent-llm: ${data.error}`)
    return data
  }
}

/**
 * Tries to surface a minimal JSON-shape hint from a zod schema so the model
 * has something concrete to match. Falls back to forwarding the schema
 * verbatim if it isn't a zod object — the edge function stringifies whatever
 * we send.
 */
function serializeSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return undefined
  const s = schema as { _def?: { typeName?: string }; shape?: () => Record<string, unknown> }
  if (s._def?.typeName === 'ZodObject' && typeof s.shape === 'function') {
    const fields = s.shape()
    const out: Record<string, string> = {}
    for (const key of Object.keys(fields)) {
      out[key] = inferType(fields[key])
    }
    return out
  }
  return schema
}

function inferType(field: unknown): string {
  if (!field || typeof field !== 'object') return 'unknown'
  const f = field as { _def?: { typeName?: string } }
  switch (f._def?.typeName) {
    case 'ZodString':   return 'string'
    case 'ZodNumber':   return 'number'
    case 'ZodBoolean':  return 'boolean'
    case 'ZodArray':    return 'array'
    case 'ZodObject':   return 'object'
    case 'ZodNullable': return 'string | null'
    case 'ZodOptional': return 'optional'
    case 'ZodEnum':     return 'enum string'
    case 'ZodLiteral':  return 'literal'
    default:            return 'unknown'
  }
}
