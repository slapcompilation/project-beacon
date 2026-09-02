// Conditional formatting rules, re-asked on every CI run.
//
// 738 asserts this once at landing; these are the durable questions. The one
// that matters most is the last: a validator that returns NULL satisfies a
// CHECK, so "not accepted" and "refused" are different answers and only one of
// them is safe.
//
//   "Compare against a constant or a property reference."
//   "Switch between a Standard rule, an Always true rule, or a Math rule."
//   "Toggle between a True or False rule."
//   "Switch between hex, RGB or Blueprint colors based on need"
//   — object-link-types/conditional-formatting.md

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

describe.skipIf(noDb)('conditional formatting', () => {
  let db: pg.Client

  const valid = async (r: unknown): Promise<boolean> =>
    (await db.query('select public.format_rule_valid($1::jsonb) v',
      [JSON.stringify(r)])).rows[0].v as boolean

  const intent = { type: 'intent', intent: 'warning' }
  const rule = (condition: unknown, extra: Record<string, unknown> = {}) =>
    ({ kind: 'standard', formatting: intent, condition, ...extra })

  beforeAll(async () => { db = await connect() })
  afterAll(async () => { await rollback(db) })

  // "Compare against a constant or a property reference." Before 738 a rule
  // could name an operator and no operand at all, and be accepted.
  it('makes a rule say what it compares against', async () => {
    expect(await valid(rule({ property: 'p', comparison: 'string', operator: 'is_exactly' }))).toBe(false)
    expect(await valid(rule({ property: 'p', comparison: 'string', operator: 'is_exactly', value: { constant: { value: 'A320' } } }))).toBe(true)
    expect(await valid(rule({ property: 'p', comparison: 'string', operator: 'contains', value: { propertyType: { propertyApiName: 'model' } } }))).toBe(true)
    // One member of the union, not both.
    expect(await valid(rule({ property: 'p', comparison: 'string', operator: 'is_exactly', value: { constant: { value: 'A' }, propertyType: { propertyApiName: 'b' } } }))).toBe(false)
    // A comparison's constant is typed by the property, unlike the api operand.
    expect(await valid(rule({ property: 'n', comparison: 'exact_numeric', value: { constant: { value: 0.8 } } }))).toBe(true)
    expect(await valid(rule({ property: 'b', comparison: 'boolean', value: { constant: { value: true } } }))).toBe(true)
    expect(await valid(rule({ property: 'n', comparison: 'exact_numeric', value: { constant: {} } }))).toBe(false)
  })

  // The rule may colour one property from the value of another — but it has to
  // name it. An empty name was accepted before 738.
  it('requires the property the condition reads', async () => {
    expect(await valid(rule({ property: '', comparison: 'is_null' }))).toBe(false)
    expect(await valid(rule({ comparison: 'is_null' }))).toBe(false)
    expect(await valid(rule({ property: 'performanceFactor', comparison: 'is_null' }))).toBe(true)
  })

  it('takes the two rule kinds it has, and refuses the third', async () => {
    expect(await valid({ kind: 'always_true', formatting: intent })).toBe(true)
    // Math stays out for the reason 673 recorded — its grammar is one sentence.
    expect(await valid({ kind: 'math', formatting: intent })).toBe(false)
    expect(await valid({ kind: 'sometimes', formatting: intent })).toBe(false)
  })

  // "Toggle between a True or False rule." Absent is a True rule.
  it('carries the true/false switch as a boolean', async () => {
    expect(await valid({ kind: 'always_true', formatting: intent, is_true: false })).toBe(true)
    expect(await valid({ kind: 'always_true', formatting: intent, is_true: true })).toBe(true)
    expect(await valid({ kind: 'always_true', formatting: intent, is_true: 'yes' })).toBe(false)
  })

  it('takes a colour in the notations the page names', async () => {
    const colour = (color: string) => ({ kind: 'always_true', formatting: { type: 'custom', color } })
    expect(await valid(colour('#137cbd'))).toBe(true)
    expect(await valid(colour('#abc'))).toBe(true)
    expect(await valid(colour('rgb(19, 124, 189)'))).toBe(true)
    expect(await valid(colour('rgba(19,124,189,0.5)'))).toBe(true)
    // A Blueprint colour NAME is the scoped divergence 738 records: no page
    // publishes the palette's tokens, and the editor resolves one to a value.
    expect(await valid(colour('cobalt4'))).toBe(false)
    expect(await valid(colour('red'))).toBe(false)
    expect(await valid({ kind: 'always_true', formatting: { type: 'intent', intent: 'success' } })).toBe(true)
    expect(await valid({ kind: 'always_true', formatting: { type: 'intent', intent: 'chartreuse' } })).toBe(false)
  })

  it('closes the comparison set and the string operators', async () => {
    for (const comparison of ['string', 'exact_numeric', 'numeric_range', 'boolean', 'is_null']) {
      const cond: Record<string, unknown> = { property: 'p', comparison }
      if (comparison === 'string') { cond.operator = 'is_exactly'; cond.value = { constant: { value: 'x' } } }
      else if (comparison === 'numeric_range') cond.value = { min: 0, max: 1 }
      else if (comparison !== 'is_null') cond.value = { constant: { value: comparison === 'boolean' ? true : 1 } }
      expect(await valid(rule(cond)), comparison).toBe(true)
    }
    expect(await valid(rule({ property: 'p', comparison: 'regex', value: { constant: { value: 'x' } } }))).toBe(false)
    // The page says "Is exactly, Contains, Starts with, etc." and never closes
    // the list; ours is closed at the three it names, which 738 records as a
    // scoped divergence rather than guessing at the rest.
    expect(await valid(rule({ property: 'p', comparison: 'string', operator: 'ends_with', value: { constant: { value: 'x' } } }))).toBe(false)
  })

  // The lesson 737 learned one function over. NULL satisfies a CHECK, so every
  // one of these has to be false rather than merely not-true.
  it('fails closed on every malformed rule', async () => {
    const malformed: unknown[] = [
      { kind: 'always_true' },
      { kind: 'standard', formatting: intent },
      { kind: 'always_true', formatting: { type: 'custom' } },
      { kind: 'always_true', formatting: {} },
      { formatting: intent },
      { kind: 'standard', formatting: intent, condition: {} },
      'not an object',
      [],
    ]
    for (const r of malformed) {
      expect(await valid(r), JSON.stringify(r)).toBe(false)
    }
  })

  it('carries the verdict through the array wrapper', async () => {
    const rules = async (j: unknown): Promise<boolean> =>
      (await db.query('select public.format_rules_valid($1::jsonb) v', [JSON.stringify(j)])).rows[0].v as boolean
    expect(await rules([])).toBe(true)
    expect(await rules([{ kind: 'always_true', formatting: intent }])).toBe(true)
    expect(await rules([{ kind: 'always_true', formatting: intent }, { kind: 'math', formatting: intent }])).toBe(false)
    expect(await rules({ kind: 'always_true', formatting: intent })).toBe(false)
  })
})
