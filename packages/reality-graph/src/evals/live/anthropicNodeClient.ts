// Node/fetch LLMClient for LIVE eval runs only — never imported by the shipped
// graph or the browser bundle (it lives under src/evals, which the package
// tsconfig excludes, and is loaded only by the skipped live eval). It talks to
// the Anthropic API directly with fetch (no SDK dependency), mirroring the
// P2.2 web client's two modes: plain structured output, and the JSON
// tool-protocol that drives runToolLoop. Used as both the agent model and the
// LLM-as-judge in a live version diff.

import type { LLMCallInput, LLMClient, LLMResponse } from '../../agents/llm'

// This dir ships without @types/node and is excluded from type-check; declare
// the two runtime globals we touch.
declare const process: { env: Record<string, string | undefined> }
declare const fetch: (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>
  usage?: { input_tokens?: number; output_tokens?: number }
}

interface ToolProtocolReply {
  action?: 'call_tool' | 'final'
  tool?: string
  input?: unknown
  thought?: string
  output?: unknown
}

const API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

export class AnthropicNodeLLMClient implements LLMClient {
  private readonly apiKey: string
  private readonly model: string

  constructor(opts?: { apiKey?: string; model?: string }) {
    const key = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('ANTHROPIC_API_KEY is required for a live judgment run')
    this.apiKey = key
    this.model = opts?.model ?? DEFAULT_MODEL
  }

  async call<T>(input: LLMCallInput<T>): Promise<LLMResponse<T>> {
    const messages = input.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const usingTools = !!input.tools && input.tools.length > 0

    if (!usingTools) {
      const system = input.outputSchema
        ? `${input.systemPrompt}\n\nRespond with ONLY a JSON object matching this schema. No prose, no markdown fences:\n${JSON.stringify(serializeSchema(input.outputSchema))}`
        : input.systemPrompt
      const { text, tokensUsed } = await this.post(system, messages, 1024)
      const output = input.outputSchema ? (parseJson(text) as T) : (text as unknown as T)
      return { output, toolCalls: [], tokensUsed }
    }

    const toolList = (input.tools ?? [])
      .map((t) => `- ${t.name}: ${t.description}\n    input: ${JSON.stringify(serializeSchema(t.inputSchema))}`)
      .join('\n')
    const system =
      `${input.systemPrompt}\n\nAVAILABLE TOOLS:\n${toolList}\n\n` +
      `Respond with exactly ONE JSON object, no prose:\n` +
      `• to call a tool: {"action":"call_tool","tool":"<name>","input":{...},"thought":"<why>"}\n` +
      `• when finished:  {"action":"final","output":${JSON.stringify(serializeSchema(input.outputSchema))}}\n` +
      `Call one tool at a time; read its result before the next. Use only the tools listed.`

    const { text, tokensUsed } = await this.post(system, messages, 2048)
    const reply = (parseJson(text) ?? {}) as ToolProtocolReply
    if (reply.action === 'call_tool' && typeof reply.tool === 'string') {
      return { toolCalls: [{ toolName: reply.tool, input: reply.input ?? {}, thought: reply.thought }], tokensUsed }
    }
    const output = (reply.action === 'final' ? reply.output : reply) as T
    return { output, toolCalls: [], tokensUsed }
  }

  private async post(
    system: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens: number,
  ): Promise<{ text: string; tokensUsed: number }> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, max_tokens: maxTokens, system, messages }),
    })
    const raw = await res.text()
    if (!res.ok) throw new Error(`Anthropic API ${String(res.status)}: ${raw.slice(0, 300)}`)
    const data = JSON.parse(raw) as AnthropicResponse
    const text = data.content?.find((b) => b.type === 'text')?.text ?? ''
    const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)
    return { text, tokensUsed }
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''))
  } catch {
    return undefined
  }
}

/** Minimal zod → JSON-shape hint so the model has something concrete to match. */
function serializeSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return undefined
  const s = schema as { _def?: { typeName?: string }; shape?: () => Record<string, unknown> }
  if (s._def?.typeName === 'ZodObject' && typeof s.shape === 'function') {
    const fields = s.shape()
    const out: Record<string, string> = {}
    for (const key of Object.keys(fields)) out[key] = inferType(fields[key])
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
