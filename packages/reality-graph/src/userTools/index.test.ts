import { describe, expect, it } from 'vitest'
import { evaluateUserTool, evaluateUserToolAcross, validateUserTool, describeUserTool, allProperties, subjectProperties } from './index'
import { EMPTY_VIEW_CONFIG, type ObjectTypeDef } from '../objectTypes/index'
import type { InterfaceDef } from '../interfaces/index'

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
  const base = { name: 'Open urgent', apiName: 'open_urgent', subjectTypeId: 't1', subjectInterfaceId: null }
  const on = { kind: 'type' as const, type }

  it('accepts an answerable tool', () => {
    expect(validateUserTool({ ...base, filters: [{ property: 'urgent', op: 'eq', value: true }], aggregation: { fn: 'count' } }, on)).toEqual([])
  })

  it('rejects an unknown property, a wrong-typed filter value, and ordering on text', () => {
    expect(validateUserTool({ ...base, filters: [{ property: 'nope', op: 'eq', value: 1 }], aggregation: { fn: 'count' } }, on)[0]).toContain('not on')
    expect(validateUserTool({ ...base, filters: [{ property: 'cost', op: 'gt', value: 'lots' }], aggregation: { fn: 'count' } }, on)[0]).toContain('needs a number')
    expect(validateUserTool({ ...base, filters: [{ property: 'room', op: 'gt', value: 'x' }], aggregation: { fn: 'count' } }, on)[0]).toContain('is / is not')
  })

  it('requires a numeric property for aggregations that reduce one', () => {
    expect(validateUserTool({ ...base, filters: [], aggregation: { fn: 'sum' } }, on)[0]).toContain('needs a numeric property')
    expect(validateUserTool({ ...base, filters: [], aggregation: { fn: 'sum', property: 'room' } }, on)[0]).toContain('is text')
  })

  it('needs a subject', () => {
    expect(validateUserTool({ ...base, filters: [], aggregation: { fn: 'count' } }, undefined)[0]).toContain('object type or interface')
  })

  it('refuses a tool claiming both a type and an interface', () => {
    expect(validateUserTool({ ...base, subjectInterfaceId: 'i1', filters: [], aggregation: { fn: 'count' } }, on))
      .toContain('A tool asks about one object type or one interface, not both')
  })
})

// ── Interface subjects — the reason interfaces exist ─────────────────────────

const roomed: InterfaceDef = {
  id: 'i1', organizationId: 'o1', apiName: 'roomed', label: 'Roomed', description: '',
  properties: [{ key: 'room', label: 'Room', type: 'text' }, { key: 'cost', label: 'Cost', type: 'number' }],
}

const incidentType: ObjectTypeDef = {
  ...type, id: 't2', apiName: 'incident', label: 'Incident',
  properties: [
    { key: 'room', label: 'Room', type: 'text', required: true },
    { key: 'cost', label: 'Cost', type: 'number', required: false },
    { key: 'severity', label: 'Severity', type: 'text', required: false },
  ],
  computedProperties: [],
}

describe('tools targeting an interface', () => {
  const onIface = { kind: 'interface' as const, iface: roomed }

  it('only offers the shared shape — not what one implementer happens to have', () => {
    expect(subjectProperties(onIface).map((p) => p.key)).toEqual(['room', 'cost'])
    // `severity` is real on Incident, but a tool using it would break on the
    // next implementer. That rejection is the load-bearing rule.
    const errs = validateUserTool(
      { name: 'x', apiName: 'x', subjectTypeId: null, subjectInterfaceId: 'i1',
        filters: [{ property: 'severity', op: 'eq', value: 'high' }], aggregation: { fn: 'count' } },
      onIface,
    )
    expect(errs[0]).toContain('shape they all share')
  })

  it('pools records so avg is the real mean, not the mean of each type mean', () => {
    const r = evaluateUserToolAcross(
      { filters: [], aggregation: { fn: 'avg', property: 'cost' } },
      [
        { type, records: [{ cost: 300 }] },
        { type: incidentType, records: [{ cost: 100 }, { cost: 100 }, { cost: 100 }] },
      ],
    )
    expect(r.value).toBe(150)          // (300+100+100+100)/4 — NOT (300+100)/2
    expect(r.matched).toBe(4)
    expect(r.basis).toContain('across 2 types')
  })

  it('shows which type each part of the answer came from', () => {
    const r = evaluateUserToolAcross(
      { filters: [], aggregation: { fn: 'sum', property: 'cost' } },
      [{ type, records: [{ cost: 10 }] }, { type: incidentType, records: [{ cost: 40 }] }],
    )
    expect(r.value).toBe(50)
    expect(r.byType).toEqual([
      { typeId: 't1', label: 'Maintenance Request', matched: 1, scanned: 1, value: 10 },
      { typeId: 't2', label: 'Incident',            matched: 1, scanned: 1, value: 40 },
    ])
  })

  it('answers an interface nothing implements yet with no confidence', () => {
    const r = evaluateUserToolAcross({ filters: [], aggregation: { fn: 'count' } }, [])
    expect(r.value).toBe(0)
    expect(r.confidence).toBe(0)
    expect(r.byType).toEqual([])
  })

  it('picks up a type implementing the interface later, with no re-authoring', () => {
    const def = { filters: [{ property: 'cost', op: 'gte' as const, value: 50 }], aggregation: { fn: 'count' as const } }
    const before = evaluateUserToolAcross(def, [{ type, records: [{ cost: 100 }] }])
    const after  = evaluateUserToolAcross(def, [{ type, records: [{ cost: 100 }] }, { type: incidentType, records: [{ cost: 60 }, { cost: 10 }] }])
    expect(before.value).toBe(1)
    expect(after.value).toBe(2)        // same definition, new implementer counted
  })
})

describe('describeUserTool + allProperties', () => {
  it('reads as a question, not a config blob', () => {
    expect(describeUserTool({ filters: [{ property: 'urgent', op: 'eq', value: true }], aggregation: { fn: 'count' } }, { kind: 'type', type }))
      .toBe('Count of Maintenance Request where Urgent is true')
  })

  it('says an interface tool spans every implementer', () => {
    expect(describeUserTool({ filters: [], aggregation: { fn: 'count' } }, { kind: 'interface', iface: roomed }))
      .toBe('Count of every Roomed')
  })

  it('exposes computed properties alongside stored ones', () => {
    expect(allProperties(type).map((p) => p.key)).toContain('days_open')
  })
})
