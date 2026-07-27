import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { runAuthoredAgent } from './run'
import type { LLMClient } from '../agents/llm'
import type { LogicTool } from '../tools/index'

const forecastTool = {
  name: 'forecast_consumption',
  category: 'logic',
  kind: 'inproc',
  version: '1.0.0',
  description: 'Projected units over a horizon.',
  inputSchema: z.object({ variantId: z.string() }),
  outputSchema: z.object({ projectedUnits: z.number() }),
  invoke: vi.fn(async () => ({ projectedUnits: 42 })),
} as unknown as LogicTool

const registry = new Map<string, LogicTool>([['forecast_consumption', forecastTool]])

const def = {
  name: 'Expiry watcher',
  apiName: 'expiry_watcher',
  purpose: 'Flags perishable stock that will expire before it is consumed.',
  scope: 'hotel' as const,
  toolset: ['forecast_consumption'],
  procedure: [{ instruction: 'Project consumption over the shelf life.', tool: 'forecast_consumption' }],
  clarificationThreshold: 0.6,
}

/** Replies with a tool call first, then the final output. */
function scriptedLLM(final: unknown): LLMClient {
  let turn = 0
  return {
    call: vi.fn(async () => {
      turn++
      if (turn === 1) {
        return {
          toolCalls: [{ toolName: 'forecast_consumption', input: { variantId: 'v1' }, thought: 'check the burn' }],
          tokensUsed: 100,
        }
      }
      return { toolCalls: [], output: final, tokensUsed: 80 }
    }),
  } as unknown as LLMClient
}

describe('runAuthoredAgent', () => {
  it('runs the compiled agent through the shared runtime and returns output + trace', async () => {
    const llm = scriptedLLM({
      outcome: 'proposal', actionType: 'WRITE_OFF', params: { quantity: 3 },
      confidence: 0.82, reasoning: 'forecast_consumption projected 42 units against 60 on hand',
    })
    const { output, trace } = await runAuthoredAgent({ def, llm, toolRegistry: registry, situation: 'Milk expires in 2 days' })

    expect(output.outcome).toBe('proposal')
    expect(output.confidence).toBeCloseTo(0.82, 5)
    expect(trace.steps.length).toBeGreaterThan(0)
    expect(forecastTool.invoke).toHaveBeenCalled()
  })

  it('passes the situation into the task prompt', async () => {
    const llm = scriptedLLM({ outcome: 'no-action', confidence: 0.9, reasoning: 'covered' })
    await runAuthoredAgent({ def, llm, toolRegistry: registry, situation: 'Yoghurt at risk' })
    const firstCall = (llm.call as unknown as { mock: { calls: { 0: { messages: { content: string }[] } }[] } }).mock.calls[0][0]
    expect(firstCall.messages[0].content).toContain('Yoghurt at risk')
  })

  it('offers only tools in the whitelist — an unregistered name is dropped, not offered', async () => {
    const llm = scriptedLLM({ outcome: 'no-action', confidence: 0.9, reasoning: 'ok' })
    await runAuthoredAgent({
      def: { ...def, toolset: ['forecast_consumption', 'not_registered'] },
      llm, toolRegistry: registry, situation: 's',
    })
    const firstCall = (llm.call as unknown as { mock: { calls: { 0: { tools: { name: string }[] } }[] } }).mock.calls[0][0]
    expect(firstCall.tools.map((t) => t.name)).toEqual(['forecast_consumption'])
  })

  it('degrades to no-action with a reason rather than throwing into the caller', async () => {
    // Output that never satisfies the schema — the loop gives up.
    const llm = { call: vi.fn(async () => ({ toolCalls: [], output: { nonsense: true }, tokensUsed: 10 })) } as unknown as LLMClient
    const { output, trace } = await runAuthoredAgent({
      def, llm, toolRegistry: registry, situation: 's', maxIterations: 2,
    })
    expect(output.outcome).toBe('no-action')
    expect(output.confidence).toBe(0)
    expect(output.reasoning).toContain('did not produce a valid proposal')
    expect(trace).toBeDefined()   // the trace still explains what happened
  })
})
