// Verifies the Node judge client's request/response mapping with a mocked
// fetch — no API key, no network. Only the real-API round-trip stays unverified
// (that needs a key; see liveJudgment.eval.ts).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { AnthropicNodeLLMClient } from './anthropicNodeClient'

function mockFetch(text: string, ok = true, status = 200): void {
  const body = JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5 } })
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok, status, text: () => Promise.resolve(ok ? body : text) })))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('AnthropicNodeLLMClient', () => {
  it('parses plain structured output and sums tokens', async () => {
    mockFetch(JSON.stringify({ checks: [{ id: 'a', passed: true, rationale: 'ok' }] }))
    const client = new AnthropicNodeLLMClient({ apiKey: 'test' })
    const r = await client.call({ systemPrompt: 'grade', messages: [{ role: 'user', content: 'x' }], outputSchema: z.object({ checks: z.array(z.unknown()) }) })
    expect(r.output).toEqual({ checks: [{ id: 'a', passed: true, rationale: 'ok' }] })
    expect(r.toolCalls).toHaveLength(0)
    expect(r.tokensUsed).toBe(15)
  })

  it('maps a tool_call reply into toolCalls (tool-protocol mode)', async () => {
    mockFetch(JSON.stringify({ action: 'call_tool', tool: 'forecast_consumption', input: { variantId: 'v' }, thought: 'size it' }))
    const client = new AnthropicNodeLLMClient({ apiKey: 'test' })
    const r = await client.call({
      systemPrompt: 'reason',
      messages: [{ role: 'user', content: 'x' }],
      tools: [{ name: 'forecast_consumption', description: 'f', inputSchema: z.object({ variantId: z.string() }) }],
      outputSchema: z.object({ proposals: z.array(z.unknown()) }),
    })
    expect(r.toolCalls).toEqual([{ toolName: 'forecast_consumption', input: { variantId: 'v' }, thought: 'size it' }])
    expect(r.output).toBeUndefined()
  })

  it('maps a final reply into output (tool-protocol mode)', async () => {
    mockFetch(JSON.stringify({ action: 'final', output: { proposals: [], paused: null } }))
    const client = new AnthropicNodeLLMClient({ apiKey: 'test' })
    const r = await client.call({
      systemPrompt: 'reason',
      messages: [{ role: 'user', content: 'x' }],
      tools: [{ name: 't', description: 'd', inputSchema: z.object({}) }],
      outputSchema: z.object({ proposals: z.array(z.unknown()) }),
    })
    expect(r.output).toEqual({ proposals: [], paused: null })
    expect(r.toolCalls).toHaveLength(0)
  })

  it('throws on a non-2xx API response', async () => {
    mockFetch('rate limited', false, 429)
    const client = new AnthropicNodeLLMClient({ apiKey: 'test' })
    await expect(
      client.call({ systemPrompt: 's', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toThrow(/429/)
  })

  it('requires an API key', () => {
    expect(() => new AnthropicNodeLLMClient({ apiKey: '' })).toThrow(/ANTHROPIC_API_KEY/)
  })
})
