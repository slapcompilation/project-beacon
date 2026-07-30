import { describe, expect, it } from 'vitest'
import { evaluateUserTool, evaluateUserToolAcross, validateUserTool, describeUserTool, allProperties, subjectProperties, bindToolArgs } from './index'
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

  it('compares dates as dates, not as NaN', () => {
    // Number('2026-06-25') is NaN, so an ordering filter on a date used to match
    // NOTHING and report it as a confident zero — the worst kind of wrong answer.
    const rows = [
      { lot: 'A', expiry_date: '2026-06-25' },
      { lot: 'B', expiry_date: '2026-08-01' },
    ]
    const r = evaluateUserTool(
      { filters: [{ property: 'expiry_date', op: 'lte', value: '2026-07-01' }], aggregation: { fn: 'count' } },
      rows,
    )
    expect(r.value).toBe(1)
  })

  it('does not compare a date against a number', () => {
    const r = evaluateUserTool(
      { filters: [{ property: 'expiry_date', op: 'gte', value: 5 }], aggregation: { fn: 'count' } },
      [{ expiry_date: '2026-06-25' }],
    )
    expect(r.value).toBe(0)   // a timestamp vs 5 is meaningless, not "everything"
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
  const base = { name: 'Open urgent', apiName: 'open_urgent', subjectTypeId: 't1', subjectInterfaceId: null, parameters: [] }
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
      .toContain('Pick one object type or one interface, not both')
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
      { name: 'x', apiName: 'x', subjectTypeId: null, subjectInterfaceId: 'i1', parameters: [],
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

// ── Input parameters — one tool answering a family of questions ──────────────

describe('tool parameters', () => {
  const on = { kind: 'type' as const, type }
  const urgencyParam = { key: 'is_urgent', label: 'Urgent?', type: 'boolean' as const, required: true }
  const paramTool = {
    name: 'By urgency', apiName: 'by_urgency', subjectTypeId: 't1', subjectInterfaceId: null,
    parameters: [urgencyParam],
    filters: [{ property: 'urgent', op: 'eq' as const, value: true, param: 'is_urgent' }],
    aggregation: { fn: 'count' as const },
  }

  it('accepts a filter that takes its value from a declared parameter', () => {
    expect(validateUserTool(paramTool, on)).toEqual([])
  })

  it('rejects a parameter no filter reads — the caller would supply nothing', () => {
    expect(validateUserTool({ ...paramTool, filters: [{ property: 'urgent', op: 'eq', value: true }] }, on)[0])
      .toContain("isn't used by any filter")
  })

  it('rejects a parameter whose type does not match the property it filters', () => {
    expect(validateUserTool({
      ...paramTool, parameters: [{ ...urgencyParam, type: 'number' }],
    }, on)[0]).toContain('is number, but "Urgent" is boolean')
  })

  it('answers differently for different arguments — one tool, two questions', () => {
    const yes = bindToolArgs(paramTool, { is_urgent: true })
    const no  = bindToolArgs(paramTool, { is_urgent: false })
    expect(yes.errors).toEqual([])
    expect(evaluateUserTool({ ...paramTool, filters: yes.filters }, records).value).toBe(3)
    expect(evaluateUserTool({ ...paramTool, filters: no.filters }, records).value).toBe(1)
  })

  it('refuses to answer with the fallback when a required argument is missing', () => {
    const { errors } = bindToolArgs(paramTool, {})
    expect(errors[0]).toContain('Missing required argument "is_urgent"')
  })

  it('falls back to the authored value only when the parameter is optional', () => {
    const optional = { ...paramTool, parameters: [{ ...urgencyParam, required: false }] }
    const { filters, errors } = bindToolArgs(optional, {})
    expect(errors).toEqual([])
    expect(filters[0].value).toBe(true)      // the authored default
  })

  it('rejects an argument of the wrong type rather than coercing it', () => {
    expect(bindToolArgs(paramTool, { is_urgent: 'yes' }).errors[0]).toContain('must be true or false')
  })

  it('reads as a question shape, with the parameter as a placeholder', () => {
    expect(describeUserTool(paramTool, on)).toBe('Count of Maintenance Request where Urgent is {is_urgent}')
  })
})

// ── G4: an interface over BUILT-IN types, with a date parameter ──────────────
// The composition the whole arc was for — interfaces (#414), interface-targeted
// tools (#415), input parameters (#417) and derived built-in properties (G2)
// meeting on the operational domain rather than authored types.

describe('a parameterised tool over an interface spanning built-in types', () => {
  const perishable: InterfaceDef = {
    id: 'i-per', organizationId: 'o1', apiName: 'perishable', label: 'Perishable', description: '',
    properties: [
      { key: 'expiry_date', label: 'Expiry date', type: 'date' },
      { key: 'lot_number', label: 'Lot number', type: 'text' },
    ],
  }
  const variantType: ObjectTypeDef = {
    ...type, id: 'bt-variant', apiName: 'variant', label: 'Variant', kind: 'builtin',
    sourceTable: 'product_variants', titleKey: 'name',
    properties: [
      { key: 'expiry_date', label: 'Expiry date', type: 'date', required: false },
      { key: 'lot_number', label: 'Lot number', type: 'text', required: false },
    ],
    computedProperties: [],
  }
  const batchType: ObjectTypeDef = {
    ...variantType, id: 'bt-batch', apiName: 'product_batch', label: 'Product Batch',
    sourceTable: 'product_batches', titleKey: 'lot_number',
  }

  const def = {
    name: 'Perishables expiring by', apiName: 'perishables_expiring_by',
    subjectTypeId: null, subjectInterfaceId: 'i-per',
    parameters: [{ key: 'before', label: 'Expiring before', type: 'date' as const, required: true }],
    filters: [{ property: 'expiry_date', op: 'lte' as const, value: '', param: 'before' }],
    aggregation: { fn: 'count' as const },
  }

  const groups = [
    { type: variantType, records: [{ expiry_date: '2026-06-30' }, { expiry_date: '2026-08-15' }] },
    { type: batchType,   records: [{ expiry_date: '2026-06-25' }, { expiry_date: '2026-12-01' }] },
  ]

  it('is answerable against the interface', () => {
    expect(validateUserTool(def, { kind: 'interface', iface: perishable })).toEqual([])
  })

  it('answers differently per argument, pooling both built-in types', () => {
    const july = bindToolArgs(def, { before: '2026-07-01' })
    const dec  = bindToolArgs(def, { before: '2026-12-31' })
    expect(july.errors).toEqual([])
    // one variant + one batch fall before July; everything falls before December
    expect(evaluateUserToolAcross({ ...def, filters: july.filters }, groups).value).toBe(2)
    expect(evaluateUserToolAcross({ ...def, filters: dec.filters }, groups).value).toBe(4)
  })

  it('attributes the answer to each built-in type', () => {
    const { filters } = bindToolArgs(def, { before: '2026-07-01' })
    expect(evaluateUserToolAcross({ ...def, filters }, groups).byType).toEqual([
      { typeId: 'bt-variant', label: 'Variant',       matched: 1, scanned: 2, value: 1 },
      { typeId: 'bt-batch',   label: 'Product Batch', matched: 1, scanned: 2, value: 1 },
    ])
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
