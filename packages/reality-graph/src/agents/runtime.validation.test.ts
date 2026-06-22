import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validateToolIO } from './runtime'

const schema = z.object({ variantId: z.string().uuid(), horizonDays: z.number().int().min(1).max(90) })

describe('validateToolIO', () => {
  it('passes a value that matches the zod schema', () => {
    expect(() => { validateToolIO(schema, { variantId: '00000000-0000-0000-0000-000000000000', horizonDays: 7 }, 'x input') }).not.toThrow()
  })

  it('throws with the label + offending path when the value is malformed', () => {
    expect(() => { validateToolIO(schema, { variantId: 'not-a-uuid', horizonDays: 7 }, "tool 'forecast_consumption' input") })
      .toThrow(/forecast_consumption' input failed schema validation: variantId/)
  })

  it('throws on out-of-range numbers (hallucinated args)', () => {
    expect(() => { validateToolIO(schema, { variantId: '00000000-0000-0000-0000-000000000000', horizonDays: 999 }, 'x input') })
      .toThrow(/horizonDays/)
  })

  it('passes through when the schema is not zod (plain-object placeholder)', () => {
    expect(() => { validateToolIO({ kind: 'consumption_forecast_input' }, { anything: true }, 'x input') }).not.toThrow()
  })
})
