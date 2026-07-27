import { describe, expect, it } from 'vitest'
import { validateAuthoredAgent, compileAgent, describeAuthoredAgent } from './index'

const TOOLS = ['forecast_consumption', 'query_open_restock_requests', 'request_clarification']

const draft = {
  name: 'Expiry watcher',
  apiName: 'expiry_watcher',
  purpose: 'Flags perishable stock that will expire before it is consumed.',
  scope: 'hotel' as const,
  toolset: ['forecast_consumption', 'request_clarification'],
  procedure: [
    { instruction: 'Project consumption over the shelf life.', tool: 'forecast_consumption' },
    { instruction: 'Propose a WRITE_OFF only when projected consumption is below stock on hand.' },
  ],
  clarificationThreshold: 0.6,
}

describe('validateAuthoredAgent', () => {
  it('accepts a well-formed agent', () => {
    expect(validateAuthoredAgent(draft, TOOLS)).toEqual([])
  })

  it('rejects an agent with no tools — it could only guess', () => {
    expect(validateAuthoredAgent({ ...draft, toolset: [] }, TOOLS).join()).toContain('at least one tool')
  })

  it('rejects tools outside the registry', () => {
    expect(validateAuthoredAgent({ ...draft, toolset: ['made_up'] }, TOOLS).join()).toContain('Not in the tool registry')
  })

  it('rejects a step calling a tool the agent may not call', () => {
    const bad = { ...draft, procedure: [{ instruction: 'peek', tool: 'query_open_restock_requests' }] }
    expect(validateAuthoredAgent(bad, TOOLS).join()).toContain('not in this agent\'s toolset')
  })

  it('requires a procedure and a purpose', () => {
    expect(validateAuthoredAgent({ ...draft, procedure: [] }, TOOLS).join()).toContain('at least one step')
    expect(validateAuthoredAgent({ ...draft, purpose: '  ' }, TOOLS).join()).toContain('Purpose is required')
  })

  it('bounds the clarification threshold', () => {
    expect(validateAuthoredAgent({ ...draft, clarificationThreshold: 1.5 }, TOOLS).join()).toContain('between 0 and 1')
  })
})

describe('compileAgent', () => {
  const compiled = compileAgent(draft)

  it('states scope and the tool whitelist in the system prompt', () => {
    expect(compiled.systemPrompt).toContain('hotel scope')
    expect(compiled.systemPrompt).toContain('forecast_consumption')
    expect(compiled.systemPrompt).toContain('never perform retrieval, arithmetic or writes yourself')
  })

  it('numbers the procedure and names each tool call', () => {
    expect(compiled.taskPrompt).toContain('1. Call `forecast_consumption`.')
    expect(compiled.taskPrompt).toContain('2. Propose a WRITE_OFF')
  })

  it('always appends the clarification rule — it is not optional', () => {
    expect(compiled.taskPrompt).toContain('3. If your confidence is below 0.60')
    expect(compiled.taskPrompt).toContain('request_clarification')
    // Even if the author never mentioned it.
    expect(draft.procedure.some((s) => s.tool === 'request_clarification')).toBe(false)
  })

  it('is deterministic — the same definition compiles identically', () => {
    expect(compileAgent(draft)).toEqual(compiled)
  })
})

describe('describeAuthoredAgent', () => {
  it('reads as a sentence', () => {
    expect(describeAuthoredAgent({ ...draft, cadence: 'daily', approval: 'review' }))
      .toBe('Daily · hotel scope · 2 step(s) · 2 tool(s) · queues for review')
  })
})
