import { describe, it, expect } from 'vitest'
import {
  evaluateAutomation,
  evaluateAutomations,
  validateAutomation,
  describeAutomation,
  automationsToProposals,
  type Automation,
  type AutomationReading,
  type AutomationDraft,
} from './index'

const base: Automation = {
  id: 'a1',
  name: 'Low OJ → restock',
  organizationId: 'org1',
  hotelId: 'h1',
  when: { subject: 'variant', metric: 'units_below_par', op: 'gt', value: 0 },
  objectSetId: null,
  effect: 'REQUEST_RESTOCK',
  gate: 'review',
  confidence: 0.7,
  enabled: true,
  stage: 'production',
  version: 1,
}

const readings: AutomationReading[] = [
  { subject: 'variant', subjectId: 'v1', subjectName: 'Orange Juice', metrics: { current_stock: 13, par_level: 113, units_below_par: 100, stock_vs_par_pct: 11 } },
  { subject: 'variant', subjectId: 'v2', subjectName: 'Lime',         metrics: { current_stock: 327, par_level: 242, units_below_par: 0, stock_vs_par_pct: 135 } },
]

describe('evaluateAutomation', () => {
  it('fires on subjects that satisfy the condition', () => {
    const hits = evaluateAutomation(base, readings)
    expect(hits.map((h) => h.subjectName)).toEqual(['Orange Juice'])
    expect(hits[0].effect).toBe('REQUEST_RESTOCK')
    expect(hits[0].reason).toContain('Units below PAR')
    expect(hits[0].reason).toContain('actual 100')
  })

  it('returns nothing when disabled', () => {
    expect(evaluateAutomation({ ...base, enabled: false }, readings)).toEqual([])
  })

  it('skips subjects of a different type', () => {
    const other: AutomationReading = { subject: 'variant', subjectId: 'x', subjectName: 'x', metrics: {} }
    // metric absent → skipped, not thrown
    expect(evaluateAutomation(base, [other])).toEqual([])
  })

  it('honours each comparison operator', () => {
    const gte = evaluateAutomation({ ...base, when: { subject: 'variant', metric: 'stock_vs_par_pct', op: 'gte', value: 135 } }, readings)
    expect(gte.map((h) => h.subjectName)).toEqual(['Lime'])
    const lt = evaluateAutomation({ ...base, when: { subject: 'variant', metric: 'stock_vs_par_pct', op: 'lt', value: 50 } }, readings)
    expect(lt.map((h) => h.subjectName)).toEqual(['Orange Juice'])
  })

  it('carries the gate + confidence onto each hit (the gate decides later)', () => {
    const hits = evaluateAutomation({ ...base, gate: 'auto', confidence: 0.9 }, readings)
    expect(hits[0].gate).toBe('auto')
    expect(hits[0].confidence).toBe(0.9)
  })
})

describe('evaluateAutomations', () => {
  it('flattens hits across a set', () => {
    const a2: Automation = { ...base, id: 'a2', effect: 'WRITE_OFF', when: { subject: 'variant', metric: 'stock_vs_par_pct', op: 'gt', value: 100 } }
    const hits = evaluateAutomations([base, a2], readings)
    expect(hits.map((h) => `${h.automationId}:${h.subjectName}`)).toEqual(['a1:Orange Juice', 'a2:Lime'])
  })
})

describe('validateAutomation', () => {
  const draft: AutomationDraft = { objectSetId: null, name: 'x', when: base.when, effect: 'REQUEST_RESTOCK', gate: 'review', confidence: 0.7 }
  it('accepts a well-formed draft', () => {
    expect(validateAutomation(draft).ok).toBe(true)
  })
  it('rejects an empty name', () => {
    expect(validateAutomation({ ...draft, name: '  ' }).ok).toBe(false)
  })
  it('rejects a metric outside the registry', () => {
    const r = validateAutomation({ ...draft, when: { subject: 'variant', op: 'gt', value: 0, metric: 'made_up' } })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('made_up')
  })
  it('rejects auto-execute below the 0.6 confidence floor', () => {
    const r = validateAutomation({ ...draft, gate: 'auto', confidence: 0.4 })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('0.6')
  })
})

describe('automationsToProposals', () => {
  const withHotel: AutomationReading[] = readings.map((r) => ({ ...r, hotelId: 'h1' }))

  it('turns a hit into a proposal carrying the subject and the actor', () => {
    // The old version asserted a REQUEST_RESTOCK payload sized from par level.
    // Action types are authored now and carry their own parameters, so what
    // this layer owes the proposal is the subject, the property and who asked.
    const props = automationsToProposals([base], withHotel, { requestorId: 'u1' })
    expect(props).toHaveLength(1)
    const p = props[0]
    expect(p.subjectId).toBe('v1')
    expect(p.proposal.action).toMatchObject({ type: 'REQUEST_RESTOCK', subjectId: 'v1', hotelId: 'h1', requestorId: 'u1' })
    expect(p.proposal.confidence).toBe(0.7)
    expect(p.proposal.provenance[0].ref).toBe('automation:a1')
    expect(p.proposal.reasoning).toContain('Low OJ → restock')
  })

  it('skips a restock when hotelId is missing (needed to build the action)', () => {
    expect(automationsToProposals([base], readings, { requestorId: 'u1' })).toEqual([])
  })

  it('submits whatever action type the automation names', () => {
    const other: Automation = { ...base, effect: 'SOME_AUTHORED_ACTION' }
    const props = automationsToProposals([other], withHotel, { requestorId: 'u1' })
    expect(props[0].proposal.action.type).toBe('SOME_AUTHORED_ACTION')
  })
})

describe('describeAutomation', () => {
  it('renders a plain-language sentence with the % unit', () => {
    const s = describeAutomation({ objectSetId: null, when: { subject: 'variant', metric: 'stock_vs_par_pct', op: 'lt', value: 25 }, effect: 'REQUEST_RESTOCK', gate: 'review' })
    expect(s).toContain('Stock vs PAR is below 25%')
    expect(s).toContain('queue it for review')
  })
  it('describes the auto gate', () => {
    const s = describeAutomation({ objectSetId: null, when: base.when, effect: 'TRANSFER_STOCK', gate: 'auto' })
    expect(s).toContain('auto-execute it when confident')
  })
})

describe('cohort-backed automations', () => {
  const cohort: Automation = { ...base, when: null, objectSetId: 's1', objectSetName: 'Below par' }
  const cohortDraft: AutomationDraft = {
    name: 'Below par → restock', when: null, objectSetId: 's1',
    effect: 'REQUEST_RESTOCK', gate: 'review', confidence: 0.7,
  }

  it('fires on the members the caller resolved, not on a metric', () => {
    const members = new Map([['s1', new Set(['v2'])]])
    const hits = evaluateAutomation(cohort, readings, members)
    expect(hits.map((h) => h.subjectName)).toEqual(['Lime'])
    expect(hits[0].reason).toBe('in cohort "Below par"')
  })

  it('fires on NOTHING when membership was not resolved — unknown is not empty', () => {
    // Silently firing on zero would read as a quiet healthy run rather than a
    // missing input, which is how a dead rule hides.
    expect(evaluateAutomation(cohort, readings)).toEqual([])
    expect(evaluateAutomation(cohort, readings, new Map())).toEqual([])
  })

  it('ignores members that have no reading', () => {
    const members = new Map([['s1', new Set(['v1', 'ghost'])]])
    expect(evaluateAutomation(cohort, readings, members).map((h) => h.subjectId)).toEqual(['v1'])
  })

  it('builds the same proposal a metric automation would', () => {
    const members = new Map([['s1', new Set(['v1'])]])
    const out = automationsToProposals(
      [cohort],
      readings.map((r) => ({ ...r, hotelId: 'h1' })),
      { requestorId: 'u1' },
      members,
    )
    expect(out).toHaveLength(1)
    expect(out[0].proposal.action.type).toBe('REQUEST_RESTOCK')
    expect(out[0].proposal.reasoning).toContain('Below par')
  })

  it('rejects a draft carrying both a cohort and a metric condition', () => {
    const r = validateAutomation({ ...cohortDraft, when: { subject: 'variant', metric: 'current_stock', op: 'lt', value: 5 } })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('not both')
  })

  it('rejects a draft carrying neither', () => {
    const r = validateAutomation({ ...cohortDraft, objectSetId: null })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('Pick a cohort')
  })

  it('accepts a well-formed cohort draft', () => {
    expect(validateAutomation(cohortDraft).ok).toBe(true)
  })

  it('reads as a sentence naming the cohort', () => {
    expect(describeAutomation(cohort)).toContain('"Below par" cohort')
  })
})
