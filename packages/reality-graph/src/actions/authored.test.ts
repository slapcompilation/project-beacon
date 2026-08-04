import { describe, it, expect } from 'vitest'
import {
  authoredActionDescriptor, validateAuthoredAction, evaluateSubmissionCriteria,
  SHIPPED_ACTION_NAMES, parametersFromProperties, type AuthoredActionDef,
} from './authored'

const base: AuthoredActionDef = {
  id: 'a1', organizationId: 'org', hotelId: null,
  name: 'Close ticket', apiName: 'CLOSE_TICKET',
  description: 'Marks a maintenance ticket resolved.',
  subjectTypeId: 't1', operation: 'modify',
  parameters: [
    { key: 'status', label: 'Status', type: 'text', required: true },
    { key: 'hours', label: 'Hours spent', type: 'number', required: false },
  ],
  submissionCriteria: [{ parameter: 'hours', operator: 'lte', value: 8 }],
  invocationMode: 'open-form', approvalTier: 'self', enabled: true,
}

describe('authoredActionDescriptor', () => {
  it('renders as a descriptor the action form can draw without knowing it is authored', () => {
    const d = authoredActionDescriptor(base)
    expect(d.title).toBe('Close ticket')
    expect(d.invocationMode).toBe('open-form')
    expect(d.fields.map((f) => f.name)).toEqual(['status', 'hours'])
    expect(d.fields[0].required).toBe(true)
  })

  it('maps each property type to the matching field kind, not all to text', () => {
    const d = authoredActionDescriptor(base)
    expect(d.fields[0].kind).toBe('string')
    expect(d.fields[1].kind).toBe('number')
    expect(authoredActionDescriptor({ ...base, parameters: [
      { key: 'due', label: 'Due', type: 'date', required: false },
    ] }).fields[0].kind).toBe('date')
  })

  it('gives a delete no fields — the record is context, not a parameter', () => {
    expect(authoredActionDescriptor({ ...base, operation: 'delete' }).fields).toEqual([])
  })
})

describe('validateAuthoredAction', () => {
  it('accepts a well-formed action type', () => {
    expect(validateAuthoredAction(base)).toEqual([])
  })

  it('refuses a shipped name, because a shipped action always wins', () => {
    for (const name of SHIPPED_ACTION_NAMES) {
      expect(validateAuthoredAction({ ...base, apiName: name }).join(' '))
        .toMatch(/code-defined action/)
    }
  })

  it('requires SHOUTING_SNAKE_CASE, matching the code-defined ones', () => {
    expect(validateAuthoredAction({ ...base, apiName: 'closeTicket' }).join(' '))
      .toMatch(/SHOUTING_SNAKE_CASE/)
  })

  it('refuses a create or modify that edits nothing', () => {
    expect(validateAuthoredAction({ ...base, parameters: [] }).join(' '))
      .toMatch(/at least one parameter/)
    // A delete legitimately has none.
    expect(validateAuthoredAction({ ...base, operation: 'delete', parameters: [], submissionCriteria: [] }))
      .toEqual([])
  })

  it('refuses a criterion testing a parameter that does not exist', () => {
    expect(validateAuthoredAction({
      ...base, submissionCriteria: [{ parameter: 'nope', operator: 'eq', value: 1 }],
    }).join(' ')).toMatch(/not a parameter of this action/)
  })

  it('refuses a duplicate parameter key', () => {
    expect(validateAuthoredAction({
      ...base, parameters: [...base.parameters, { key: 'status', label: 'Again', type: 'text', required: false }],
    }).join(' ')).toMatch(/declared twice/)
  })
})

describe('evaluateSubmissionCriteria', () => {
  it('passes only when every criterion is met', () => {
    // "Actions can only be submitted if all the submission criteria are met."
    expect(evaluateSubmissionCriteria(base.submissionCriteria, { hours: 4 })).toEqual([])
    expect(evaluateSubmissionCriteria(base.submissionCriteria, { hours: 12 })).toHaveLength(1)
  })

  it('names the parameter, so the form can put the message where the operator is', () => {
    const [fail] = evaluateSubmissionCriteria(base.submissionCriteria, { hours: 12 })
    expect(fail.parameter).toBe('hours')
    expect(fail.message).toMatch(/at most 8/)
  })

  it('fails a comparison against a missing value rather than passing silently', () => {
    // An absent parameter is not evidence the condition holds.
    expect(evaluateSubmissionCriteria(base.submissionCriteria, {})).toHaveLength(1)
  })

  it('handles non_empty, which compares against nothing', () => {
    const c = [{ parameter: 'status', operator: 'non_empty' as const }]
    expect(evaluateSubmissionCriteria(c, { status: 'closed' })).toEqual([])
    expect(evaluateSubmissionCriteria(c, { status: '' })).toHaveLength(1)
    expect(evaluateSubmissionCriteria(c, {})).toHaveLength(1)
  })

  it('compares numbers written as strings, which is what a form yields', () => {
    expect(evaluateSubmissionCriteria([{ parameter: 'hours', operator: 'lte', value: 8 }], { hours: '4' }))
      .toEqual([])
  })
})

describe('parametersFromProperties', () => {
  // Foundry derives the form from the rule: "the Ticket and Priority parameter
  // have already been created based by the Rule."
  const props = [
    { key: 'status',   label: 'Status',   type: 'text' as const,   required: true },
    { key: 'priority', label: 'Priority', type: 'text' as const,   required: false },
    { key: 'hours',    label: 'Hours',    type: 'number' as const, required: false },
  ]

  it('turns the properties an action modifies into its typed parameters', () => {
    expect(parametersFromProperties(props, ['status', 'hours'])).toEqual([
      { key: 'status', label: 'Status', type: 'text', required: true },
      { key: 'hours', label: 'Hours', type: 'number', required: false },
    ])
  })

  it('keeps the object type\'s own order, not the click order', () => {
    expect(parametersFromProperties(props, ['hours', 'status']).map((p) => p.key))
      .toEqual(['status', 'hours'])
  })

  it('ignores a key the type does not have', () => {
    expect(parametersFromProperties(props, ['gone'])).toEqual([])
  })
})

describe('submission criteria failure messages', () => {
  it('uses the author\'s message when there is one', () => {
    // "Add a failure message so users can see why an action has failed."
    const [fail] = evaluateSubmissionCriteria(
      [{ parameter: 'hours', operator: 'lte', value: 8, message: 'A shift cannot exceed 8 hours.' }],
      { hours: 12 },
    )
    expect(fail.message).toBe('A shift cannot exceed 8 hours.')
  })

  it('falls back to a generated one, which states the rule but not the reason', () => {
    const [fail] = evaluateSubmissionCriteria(
      [{ parameter: 'hours', operator: 'lte', value: 8 }], { hours: 12 },
    )
    expect(fail.message).toMatch(/at most 8/)
  })

  it('uses the author\'s message for a missing value too', () => {
    const [fail] = evaluateSubmissionCriteria(
      [{ parameter: 'hours', operator: 'lte', value: 8, message: 'Hours are required.' }], {},
    )
    expect(fail.message).toBe('Hours are required.')
  })
})
