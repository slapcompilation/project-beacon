// Behavior eval (corrections #8): the copilot refuses a constraint-violating ask.
//
// Exercises the real suggest-time path — copilotProposalToAction maps the LLM's
// snake_case proposal to a typed action, then the SAME evaluateConstraints engine
// dispatch uses decides. A hard violation blocks Apply in the UI; soft warns.
// Models the live hotel constraints (REQUEST_RESTOCK ≤ 500, actions 06:00–22:00).

import { describe, expect, it } from 'vitest'
import { copilotProposalToAction } from './copilotProposal'
import { evaluateConstraints, type ConstraintRecord } from '../constraints/index'

const HOTEL = '22222222-2222-4222-8222-222222222222'
const VAR = '11111111-1111-4111-8111-111111111111'

const constraints: ConstraintRecord[] = [
  {
    id: 'cap', body: 'Restock orders may not exceed 500 units',
    bucket: 'threshold', typedRule: { bucket: 'threshold', field: 'quantityNeeded', max: 500 },
    severity: 'hard', appliesToActionTypes: ['REQUEST_RESTOCK'], active: true,
  },
  {
    id: 'hours', body: 'Stock actions only between 06:00 and 22:00',
    bucket: 'time-window', typedRule: { bucket: 'time-window', startHour: 6, endHour: 22 },
    severity: 'hard', appliesToActionTypes: [], active: true,
  },
]

const MIDDAY = new Date('2026-05-29T12:00:00Z')
const NIGHT  = new Date('2026-05-29T02:00:00Z')

/** Replays the edge function's suggest-time guardrail for one copilot ask. */
function askVerdict(
  action: string,
  params: Record<string, unknown>,
  now: Date,
): { blocked: boolean; needsApproval: boolean; messages: string[] } {
  const typed = copilotProposalToAction(action, params, HOTEL)
  if (!typed) return { blocked: false, needsApproval: false, messages: [] }
  const violations = evaluateConstraints(typed, constraints, { now })
  return {
    blocked: violations.some((v) => v.severity === 'hard'),
    needsApproval: violations.length > 0 && !violations.some((v) => v.severity === 'hard'),
    messages: violations.map((v) => v.message),
  }
}

describe('copilot guardrail — refuses constraint-violating asks', () => {
  it('allows a compliant restock ask (within cap, within hours)', () => {
    const v = askVerdict('REQUEST_RESTOCK', { variant_id: VAR, quantity: 100 }, MIDDAY)
    expect(v.blocked).toBe(false)
    expect(v.needsApproval).toBe(false)
  })

  it('refuses an over-cap restock ask (hard threshold)', () => {
    const v = askVerdict('REQUEST_RESTOCK', { variant_id: VAR, quantity: 600 }, MIDDAY)
    expect(v.blocked).toBe(true)
    expect(v.messages.join(' ')).toContain('exceeds max 500')
  })

  it('refuses any stock ask outside the allowed hours (hard time-window)', () => {
    const v = askVerdict('REQUEST_RESTOCK', { variant_id: VAR, quantity: 100 }, NIGHT)
    expect(v.blocked).toBe(true)
    expect(v.messages.join(' ')).toMatch(/window/)
  })

  it('refuses a write-off ask placed after hours (time-window applies to all types)', () => {
    const v = askVerdict('ADJUST_STOCK', { variant_id: VAR, action: 'subtract', quantity: 3, reason: 'breakage' }, NIGHT)
    expect(v.blocked).toBe(true)
  })

  it('lets a write-off through during allowed hours (cap is restock-only)', () => {
    const v = askVerdict('WRITE_OFF', { variant_id: VAR, quantity: 999, reason: 'spoilage' }, MIDDAY)
    expect(v.blocked).toBe(false)
  })

  it('does not gate proposals with no typed action (e.g. BATCH_APPROVE)', () => {
    const v = askVerdict('BATCH_APPROVE', { max_cost: 100 }, NIGHT)
    expect(v.blocked).toBe(false)
    expect(v.messages).toEqual([])
  })

  it('flags (not blocks) a soft violation as needs-approval', () => {
    const soft: ConstraintRecord[] = [{
      id: 's', body: 'Large restocks need a second look',
      bucket: 'threshold', typedRule: { bucket: 'threshold', field: 'quantityNeeded', max: 50 },
      severity: 'soft', appliesToActionTypes: ['REQUEST_RESTOCK'], active: true,
    }]
    const typed = copilotProposalToAction('REQUEST_RESTOCK', { variant_id: VAR, quantity: 100 }, HOTEL)!
    const violations = evaluateConstraints(typed, soft, { now: MIDDAY })
    expect(violations).toHaveLength(1)
    expect(violations[0].severity).toBe('soft')
  })
})
