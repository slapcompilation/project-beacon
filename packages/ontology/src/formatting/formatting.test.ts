// The formatter and the rule chooser, against the examples the pages print.
//
// Every case whose expected output is quoted comes from a page rather than from
// what the code happens to do — the same discipline the platform suite uses:
// run the algorithm and compare against the answer the documentation prints.

import { describe, it, expect } from 'vitest'
import { formatValue, matchingRule, ruleSummary } from './index'
import type { FormatRule, ValueFormatting } from './index'

const num = (numberType: unknown): ValueFormatting =>
  ({ number: { numberType } } as ValueFormatting)

// The pages print their examples in English. Grouping is "locale-aware" by
// design, so the locale is pinned HERE rather than in the formatter — that is
// what makes these comparisons against the page and not against the machine.
const en = { locale: 'en-US' }

describe('value formatting', () => {
  it('has no opinion when there is no formatter or no value', () => {
    expect(formatValue('x', null)).toBeNull()
    expect(formatValue(null, num({ standard: { baseFormatOptions: {} } }), en)).toBeNull()
    expect(formatValue(undefined, num({ standard: { baseFormatOptions: {} } }), en)).toBeNull()
  })

  // "useGrouping: true makes 1234567 display as "1,234,567""
  // "maximumFractionDigits: 2 makes 3.14159 display as "3.14""
  it('formats a standard number the way the api documents it', () => {
    expect(formatValue(1234567, num({ standard: { baseFormatOptions: { useGrouping: true } } }), en))
      .toBe('1,234,567')
    expect(formatValue(3.14159, num({ standard: { baseFormatOptions: { maximumFractionDigits: 2 } } }), en))
      .toBe('3.14')
    // "Set to `2` to display `3.5` as `3.50`."
    expect(formatValue(3.5, num({ standard: { baseFormatOptions: { minimumFractionDigits: 2 } } }), en))
      .toBe('3.50')
    // "Set to `2` to display `5` as `05`."
    expect(formatValue(5, num({ standard: { baseFormatOptions: { minimumIntegerDigits: 2 } } }), en))
      .toBe('05')
  })

  // "If true, wrap negative numbers in parentheses instead of a minus sign."
  it('wraps a negative in parentheses when asked', () => {
    expect(formatValue(-42, num({ standard: { baseFormatOptions: { convertNegativeToParenthesis: true } } }), en))
      .toBe('(42)')
    expect(formatValue(42, num({ standard: { baseFormatOptions: { convertNegativeToParenthesis: true } } }), en))
      .toBe('42')
  })

  // "THOUSANDS: 1500 displays as "1.5K" - MILLIONS: 2500000 displays as "2.5M"
  //  - BILLIONS: 3200000000 displays as "3.2B""
  it('scales by the published factors and suffixes', () => {
    expect(formatValue(1500, num({ scale: { scaleType: 'THOUSANDS', baseFormatOptions: {} } }), en)).toBe('1.5K')
    expect(formatValue(2500000, num({ scale: { scaleType: 'MILLIONS', baseFormatOptions: {} } }), en)).toBe('2.5M')
    expect(formatValue(3200000000, num({ scale: { scaleType: 'BILLIONS', baseFormatOptions: {} } }), en)).toBe('3.2B')
  })

  // "PERCENTAGE: Multiply by 100 and add "%" suffix (0.15 → "15%")
  //  - PER_MILLE: (0.015 → "15‰") - BASIS_POINTS: (0.0015 → "15bps")"
  it('scales a ratio by the published factors', () => {
    expect(formatValue(0.15, num({ ratio: { ratioType: 'PERCENTAGE', baseFormatOptions: {} } }), en)).toBe('15%')
    expect(formatValue(0.015, num({ ratio: { ratioType: 'PER_MILLE', baseFormatOptions: {} } }), en)).toBe('15‰')
    expect(formatValue(0.0015, num({ ratio: { ratioType: 'BASIS_POINTS', baseFormatOptions: {} } }), en)).toBe('15bps')
  })

  // "Example: {1: "First", 2: "Second", 3: "Third"} would display 2 as "Second"."
  it('maps a fixed value, and leaves an unmapped one alone', () => {
    const f = num({ fixedValues: { values: { 1: 'First', 2: 'Second', 3: 'Third' } } })
    expect(formatValue(2, f, en)).toBe('Second')
    expect(formatValue(9, f, en)).toBe('9')
  })

  // "Human readable: 3661 seconds displays as "1h 1m 1s"
  //  - Timecode: 3661 seconds displays as "01:01:01""
  it('formats a duration both published ways', () => {
    expect(formatValue(3661, num({ duration: { formatStyle: { humanReadable: {} }, baseValue: 'SECONDS' } }), en))
      .toBe('1h 1m 1s')
    expect(formatValue(3661, num({ duration: { formatStyle: { timecode: {} }, baseValue: 'SECONDS' } }), en))
      .toBe('01:01:01')
    // baseValue says what the stored number means.
    expect(formatValue(3661000, num({ duration: { formatStyle: { timecode: {} }, baseValue: 'MILLISECONDS' } }), en))
      .toBe('01:01:01')
    // "Specifies the maximum precision to apply when formatting a duration."
    expect(formatValue(3661, num({ duration: { formatStyle: { humanReadable: {} }, baseValue: 'SECONDS', precision: 'MINUTES' } }), en))
      .toBe('1h 1m')
    expect(formatValue(3661, num({ duration: { formatStyle: { humanReadable: { showFullUnits: true } }, baseValue: 'SECONDS', precision: 'HOURS' } }), en))
      .toBe('1 hour')
  })

  // "prefix "USD " and postfix " total" displays as "USD 1,234.56 total""
  it('attaches an affix from a constant or another property', () => {
    expect(formatValue(1234.56, num({
      affix: {
        baseFormatOptions: { useGrouping: true, minimumFractionDigits: 2 },
        affix: { prefix: { constant: { value: 'USD ' } }, postfix: { constant: { value: ' total' } } },
      },
    }), en)).toBe('USD 1,234.56 total')
    // An operand may read another property of the same object.
    expect(formatValue(1500, num({
      affix: { baseFormatOptions: {}, affix: { postfix: { propertyType: { propertyApiName: 'unit' } } } },
    }), { ...en, row: { unit: ' widgets' } })).toBe('1500 widgets')
  })

  // "1234.56 with currency "USD" displays as "USD 1,234.56" (standard)"
  // "25 with unit "celsius"" and "1500 with unit "widgets" displays as
  //  "1,500 widgets""
  it('renders currency and units', () => {
    expect(formatValue(1234.56, num({
      currency: { style: 'STANDARD', currencyCode: { constant: { value: 'USD' } },
        baseFormatOptions: { useGrouping: true, minimumFractionDigits: 2 } },
    }), en)).toBe('USD 1,234.56')
    expect(formatValue(1500, num({
      customUnit: { unit: { constant: { value: 'widgets' } }, baseFormatOptions: { useGrouping: true } },
    }), en)).toBe('1,500 widgets')
  })

  it('renders a boolean as the two strings it was given', () => {
    const f: ValueFormatting = { boolean: { valueIfTrue: 'Yes', valueIfFalse: 'No' } }
    expect(formatValue(true, f)).toBe('Yes')
    expect(formatValue(false, f)).toBe('No')
  })

  it('renders a date in the published styles', () => {
    const iso = '2020-07-22T13:00:00.000Z'
    // "ISO instant | Both the date and time (ISO 8601 format) | 2020-07-22T13:00:00.000Z"
    expect(formatValue(iso, { date: { format: { localizedFormat: { format: 'DATE_FORMAT_ISO_INSTANT' } } } }, en))
      .toBe('2020-07-22T13:00:00.000Z')
    // A strict pattern is the api's other branch.
    expect(formatValue(iso, { timestamp: {
      format: { stringFormat: { pattern: 'yyyy-MM-dd' } },
      displayTimezone: { static: { zoneId: { constant: { value: 'UTC' } } } },
    } }, en)).toBe('2020-07-22')
    expect(formatValue(iso, { timestamp: {
      format: { stringFormat: { pattern: 'HH:mm:ss' } },
      displayTimezone: { static: { zoneId: { constant: { value: 'UTC' } } } },
    } }, en)).toBe('13:00:00')
  })

  // "applications will only format in relative terms up to 24 hours ago. After
  //  this, it will render in Date and time (short) form with the day of the week"
  it('stops formatting relatively after twenty-four hours', () => {
    const now = new Date('2020-07-22T13:08:00.000Z')
    const eightMinutes = '2020-07-22T13:00:00.000Z'
    // "Relative to now | The date relative to right now | 8 minutes ago"
    expect(formatValue(eightMinutes, { date: { format: { localizedFormat: { format: 'DATE_FORMAT_RELATIVE_TO_NOW' } } } }, { ...en, now }))
      .toBe('8 minutes ago')
    const twoDays = '2020-07-20T13:00:00.000Z'
    const older = formatValue(twoDays, { date: { format: { localizedFormat: { format: 'DATE_FORMAT_RELATIVE_TO_NOW' } } } }, { ...en, now })
    expect(older).not.toMatch(/ago/)
    expect(older).toMatch(/Mon|2020/)
  })

  it('renders a Foundry id as a name when one is known', () => {
    const f: ValueFormatting = { knownType: { knownType: 'USER_OR_GROUP_ID' } }
    expect(formatValue('u-1', f, { displayName: (id) => (id === 'u-1' ? 'Ada Lovelace' : undefined) }))
      .toBe('Ada Lovelace')
    expect(formatValue('u-2', f, { displayName: () => undefined })).toBe('u-2')
    expect(formatValue('ri.foundry.main.dataset.orders', { knownType: { knownType: 'RESOURCE_RID' } }))
      .toBe('orders')
  })
})

describe('conditional formatting', () => {
  const colour = (intent: string): FormatRule =>
    ({ kind: 'always_true', formatting: { type: 'intent', intent } } as FormatRule)

  const isExactly = (property: string, value: string, intent: string): FormatRule => ({
    kind: 'standard',
    formatting: { type: 'intent', intent } as FormatRule['formatting'],
    condition: { property, comparison: 'string', operator: 'is_exactly', value: { constant: { value } } },
  })

  // The page's own worked example: type coloured by exact match between A320,
  // A321 and A330, with an Always true rule as the fallback.
  it('takes the first matching rule, top to bottom', () => {
    const rules = [isExactly('type', 'A320', 'primary'), isExactly('type', 'A321', 'success'), colour('warning')]
    expect(matchingRule('A320', rules, { row: { type: 'A320' } })?.formatting.intent).toBe('primary')
    expect(matchingRule('A321', rules, { row: { type: 'A321' } })?.formatting.intent).toBe('success')
    // "Use Always true as a fallback in case your other rules do not match."
    expect(matchingRule('A330', rules, { row: { type: 'A330' } })?.formatting.intent).toBe('warning')
    expect(matchingRule('A330', rules.slice(0, 2), { row: { type: 'A330' } })).toBeNull()
  })

  // A condition reads the property it NAMES, out of the row, and only that. A
  // dangling reference — a renamed source, a hidden property the Explorer's
  // own rule strips from the row — goes quiet; it must never silently read the
  // coloured value instead, which would invert "Copied rules will continue
  // referencing their original properties."
  it('does not match when the row lacks the property the condition names', () => {
    const rule = isExactly('status', 'open', 'danger')
    expect(matchingRule('open', [rule], { row: { priority: 'open' } })).toBeNull()
    expect(matchingRule('open', [rule], { row: {} })).toBeNull()
    // The Always true fallback still fires, since it reads nothing.
    expect(matchingRule('open', [rule, colour('warning')], { row: {} })?.formatting.intent).toBe('warning')
  })

  // "this dropdown allows you to choose to apply the rule based on the value of
  //  another property" — colour Type from the value of Performance factor.
  it('reads the property the condition names, not the one it colours', () => {
    const rule: FormatRule = {
      kind: 'standard',
      formatting: { type: 'intent', intent: 'danger' },
      condition: { property: 'performanceFactor', comparison: 'numeric_range', value: { max: 0.5 } },
    }
    expect(matchingRule('A320', [rule], { row: { performanceFactor: 0.4 } })).not.toBeNull()
    expect(matchingRule('A320', [rule], { row: { performanceFactor: 0.9 } })).toBeNull()
  })

  // "To color all planes in blue that are not A320, switch this to False."
  it('inverts a False rule', () => {
    const rule = { ...isExactly('type', 'A320', 'primary'), is_true: false }
    expect(matchingRule('A320', [rule], { row: { type: 'A320' } })).toBeNull()
    expect(matchingRule('A330', [rule], { row: { type: 'A330' } })).not.toBeNull()
  })

  it('honours the case-sensitivity switch and the string operators', () => {
    const sensitive: FormatRule = {
      kind: 'standard', formatting: { type: 'intent', intent: 'primary' },
      condition: { property: 'type', comparison: 'string', operator: 'is_exactly', value: { constant: { value: 'a320' } } },
    }
    expect(matchingRule('A320', [sensitive], { row: { type: 'A320' } })).toBeNull()
    expect(matchingRule('A320', [{ ...sensitive, condition: { ...sensitive.condition!, case_sensitive: false } }],
      { row: { type: 'A320' } })).not.toBeNull()
    // "Use this to color all plane type values that Start with "A32"."
    const startsWith: FormatRule = {
      kind: 'standard', formatting: { type: 'intent', intent: 'primary' },
      condition: { property: 'type', comparison: 'string', operator: 'starts_with', value: { constant: { value: 'A32' } } },
    }
    expect(matchingRule('A320', [startsWith], { row: { type: 'A320' } })).not.toBeNull()
    expect(matchingRule('A330', [startsWith], { row: { type: 'A330' } })).toBeNull()
  })

  // "for property wifi, we assign green if the value of the property is "true"
  //  for each object in the table, and red if it is "false.""
  it('matches a boolean, and an empty value', () => {
    const wifi: FormatRule[] = [
      { kind: 'standard', formatting: { type: 'intent', intent: 'success' },
        condition: { property: 'wifi', comparison: 'boolean', value: { constant: { value: true } } } } as unknown as FormatRule,
      { kind: 'standard', formatting: { type: 'intent', intent: 'danger' },
        condition: { property: 'wifi', comparison: 'boolean', value: { constant: { value: false } } } } as unknown as FormatRule,
    ]
    expect(matchingRule(true, wifi, { row: { wifi: true } })?.formatting.intent).toBe('success')
    expect(matchingRule(false, wifi, { row: { wifi: false } })?.formatting.intent).toBe('danger')
    // A boolean rule stores a real boolean; the editor once stored the STRING
    // 'true', whose strict comparison could never match a typed column while
    // the preview — fed the same string — showed it matching.
    const stringly = {
      kind: 'standard', formatting: { type: 'intent', intent: 'success' },
      condition: { property: 'wifi', comparison: 'boolean', value: { constant: { value: 'true' } } },
    } as unknown as FormatRule
    expect(matchingRule(true, [stringly], { row: { wifi: true } })).toBeNull()

    const nullRule: FormatRule = {
      kind: 'standard', formatting: { type: 'intent', intent: 'warning' },
      condition: { property: 'type', comparison: 'is_null' },
    }
    expect(matchingRule(null, [nullRule], { row: { type: null } })).not.toBeNull()
    expect(matchingRule('A320', [nullRule], { row: { type: 'A320' } })).toBeNull()
  })

  // The sentence the property pane prints: 'Type is "A320".'
  it('summarises a rule the way the card prints it', () => {
    expect(ruleSummary(isExactly('type', 'A320', 'primary'), 'Type')).toBe('Type is "A320".')
    expect(ruleSummary(colour('warning'))).toBe('Always true.')
    expect(ruleSummary({ ...isExactly('type', 'A320', 'primary'), is_true: false }, 'Type'))
      .toBe('Type does not equal "A320".')
    expect(ruleSummary({
      kind: 'standard', formatting: { type: 'intent', intent: 'warning' },
      condition: { property: 'type', comparison: 'is_null' },
    }, 'Type')).toBe('Type is empty.')
  })
})
