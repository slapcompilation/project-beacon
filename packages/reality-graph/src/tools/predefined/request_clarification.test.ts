import { describe, expect, it } from 'vitest'
import { requestClarificationTool } from './request_clarification'

describe('request_clarification', () => {
  it('echoes input back as a paused-output envelope', async () => {
    const r = await requestClarificationTool.invoke({
      question:           'Sysco or Riverside?',
      contextSummary:     'Gap 200u by Fri. Sister 80u; Sysco 1d lead.',
      currentConfidence:  0.55,
    })
    expect(r).toEqual({
      paused:            true,
      question:          'Sysco or Riverside?',
      contextSummary:    'Gap 200u by Fri. Sister 80u; Sysco 1d lead.',
      currentConfidence: 0.55,
    })
  })

  it('declares the predefined category — runtime resolves it specially', () => {
    expect(requestClarificationTool.category).toBe('predefined')
  })
})
