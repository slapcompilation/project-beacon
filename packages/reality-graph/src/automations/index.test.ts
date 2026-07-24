import { describe, it, expect } from 'vitest'
import {
  evaluateAutomation,
  evaluateAutomations,
  validateAutomation,
  describeAutomation,
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
  const draft: AutomationDraft = { name: 'x', when: base.when, effect: 'REQUEST_RESTOCK', gate: 'review', confidence: 0.7 }
  it('accepts a well-formed draft', () => {
    expect(validateAutomation(draft).ok).toBe(true)
  })
  it('rejects an empty name', () => {
    expect(validateAutomation({ ...draft, name: '  ' }).ok).toBe(false)
  })
  it('rejects a metric outside the registry', () => {
    const r = validateAutomation({ ...draft, when: { ...draft.when, metric: 'made_up' } })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('made_up')
  })
  it('rejects auto-execute below the 0.6 confidence floor', () => {
    const r = validateAutomation({ ...draft, gate: 'auto', confidence: 0.4 })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('0.6')
  })
})

describe('describeAutomation', () => {
  it('renders a plain-language sentence with the % unit', () => {
    const s = describeAutomation({ when: { subject: 'variant', metric: 'stock_vs_par_pct', op: 'lt', value: 25 }, effect: 'REQUEST_RESTOCK', gate: 'review' })
    expect(s).toContain('Stock vs PAR is below 25%')
    expect(s).toContain('queue it for review')
  })
  it('describes the auto gate', () => {
    const s = describeAutomation({ when: base.when, effect: 'TRANSFER_STOCK', gate: 'auto' })
    expect(s).toContain('auto-execute it when confident')
  })
})
