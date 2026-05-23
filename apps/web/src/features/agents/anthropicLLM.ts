// AnthropicLLMClient — implements the @beacon/reality-graph LLMClient interface
// by proxying through the agent-llm edge function. The Anthropic API key never
// reaches the browser; the function checks the user's auth + injects it.

import { supabase } from '@/lib/supabase/client'
import type { LLMCallInput, LLMClient, LLMResponse } from '@beacon/reality-graph'

interface EdgeFunctionResponse {
  output?: unknown
  tokensUsed?: number
  error?: string
  raw?: string
}

export class AnthropicLLMClient implements LLMClient {
  async call<T>(input: LLMCallInput<T>): Promise<LLMResponse<T>> {
    // Filter messages to roles the proxy accepts (system goes via systemPrompt).
    const messages = input.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const invokeResult = await supabase.functions.invoke<EdgeFunctionResponse>('agent-llm', {
      body: {
        systemPrompt: input.systemPrompt,
        messages,
        outputSchema: serializeSchema(input.outputSchema),
      },
    })
    const data = invokeResult.data
    const error: unknown = invokeResult.error

    if (error instanceof Error) throw new Error(`agent-llm edge function failed: ${error.message}`)
    if (!data) throw new Error('agent-llm returned no data')
    if (data.error) throw new Error(`agent-llm: ${data.error}`)

    return {
      output: data.output as T,
      toolCalls: [],
      tokensUsed: data.tokensUsed ?? 0,
    }
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
