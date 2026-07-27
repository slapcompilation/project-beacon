import { describe, expect, it } from 'vitest'
import { evaluateUserTool, validateUserTool, describeUserTool, allProperties } from './index'
import { EMPTY_VIEW_CONFIG, type ObjectTypeDef } from '../objectTypes/index'

const type: ObjectTypeDef = {
  id: 't1', organizationId: 'o1', hotelId: null,
  apiName: 'maintenance_request', label: 'Maintenance Request', icon: 'wrench', description: '',
  properties: [
    { key: 'room',        label: 'Room',        type: 'text',    required: true },
    { key: 'urgent',      label: 'Urgent',      type: 'boolean', required: false },
    { key: 'cost',        label: 'Cost',        type: 'number',  required: false },
    { key: 'reported_on', label: 'Reported on', type: 'date',    required: false },
  ],
  computedProperties: [{ key: 'days_open', label: 'Days open', fn: 'days_since', inputs: ['reported_on'] }],
  viewConfig: EMPTY_VIEW_CONFIG,
  enabled: true, version: 1,
}

const records = [
  { room: '101', urgent: true,  cost: 100 },
  { room: '102', urgent: false, cost: 50 },
  { room: '103', urgent: true,  cost: 30 },
  { room: '104', urgent: true },              // no cost recorded
]

describe('evaluateUserTool', () => {
  it('counts matching records and reports what it scanned', () => {
    const r = evaluateUserTool({ filters: [{ property: 'urgent', op: 'eq', value: true }], aggregation: { fn: 'count' } }, records)
    expect(r.value).toBe(3)
    expect(r.matched).toBe(3)
    expect(r.scanned).toBe(4)
    expect(r.basis).toContain('3/4')
  })

  it('sums / averages / min / max a numeric property over matches', () => {
    const urgent = [{ property: 'urgent' as const, op: 'eq' as const, value: true }]
    expect(evaluateUserTool({ filters: urgent, aggregation: { fn: 'sum', property: 'cost' } }, records).value).toBe(130)
    expect(evaluateUserTool({ filters: urgent, aggregation: { fn: 'avg', property: 'cost' } }, records).value).toBe(65)
    expect(evaluateUserTool({ filters: [], aggregation: { fn: 'min', property: 'cost' } }, records).value).toBe(30)
    expect(evaluateUserTool({ filters: [], aggregation: { fn: 'max', property: 'cost' } }, records).value).toBe(100)
  })

  it('is honestly unconfident when nothing matches — not a confident zero', () => {
    const r = evaluateUserTool(
      { filters: [{ property: 'room', op: 'eq', value: 'nope' }], aggregation: { fn: 'sum', property: 'cost' } },
      records,
    )
    expect(r.value).toBe(0)
    expect(r.confidence).toBe(0)
  })

  it('discounts confidence when matches lack the number', () => {
    // 3 urgent rows, only 2 carry a cost.
    const r = evaluateUserTool(
      { filters: [{ property: 'urgent', op: 'eq', value: true }], aggregation: { fn: 'sum', property: 'cost' } },
      records,
    )
    expect(r.confidence).toBeCloseTo(2 / 3, 5)
  })

  it('compares text case-insensitively', () => {
    const r = evaluateUserTool({ filters: [{ property: 'room', op: 'eq', value: '101' }], aggregation: { fn: 'count' } },
      [{ room: ' 101 ' }])
    expect(r.value).toBe(1)
  })

  it('filters on a computed property like a stored one', () => {
    const iso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
    const rows = [{ reported_on: iso(10) }, { reported_on: iso(1) }]
    const r = evaluateUserTool(
      { filters: [{ property: 'days_open', op: 'gte', value: 5 }], aggregation: { fn: 'count' } },
      rows, type,
    )
    expect(r.value).toBe(1)
  })
})

describe('validateUserTool', () => {
  const base = { name: 'Open urgent', apiName: 'open_urgent', subjectTypeId: 't1' }

  it('accepts an answerable tool', () => {
    expect(validateUserTool({ ...base, filters: [{ property: 'urgent', op: 'eq', value: true }], aggregation: { fn: 'count' } }, type)).toEqual([])
  })

  it('rejects an unknown property, a wrong-typed filter value, and ordering on text', () => {
    expect(validateUserTool({ ...base, filters: [{ property: 'nope', op: 'eq', value: 1 }], aggregation: { fn: 'count' } }, type)[0]).toContain('not on')
    expect(validateUserTool({ ...base, filters: [{ property: 'cost', op: 'gt', value: 'lots' }], aggregation: { fn: 'count' } }, type)[0]).toContain('needs a number')
    expect(validateUserTool({ ...base, filters: [{ property: 'room', op: 'gt', value: 'x' }], aggregation: { fn: 'count' } }, type)[0]).toContain('is / is not')
  })

  it('requires a numeric property for aggregations that reduce one', () => {
    expect(validateUserTool({ ...base, filters: [], aggregation: { fn: 'sum' } }, type)[0]).toContain('needs a numeric property')
    expect(validateUserTool({ ...base, filters: [], aggregation: { fn: 'sum', property: 'room' } }, type)[0]).toContain('is text')
  })

  it('needs a subject type', () => {
    expect(validateUserTool({ ...base, filters: [], aggregation: { fn: 'count' } }, undefined)[0]).toContain('object type')
  })
})

describe('describeUserTool + allProperties', () => {
  it('reads as a question, not a config blob', () => {
    expect(describeUserTool({ filters: [{ property: 'urgent', op: 'eq', value: true }], aggregation: { fn: 'count' } }, type))
      .toBe('Count of Maintenance Request where Urgent is true')
  })

  it('exposes computed properties alongside stored ones', () => {
    expect(allProperties(type).map((p) => p.key)).toContain('days_open')
  })
})
