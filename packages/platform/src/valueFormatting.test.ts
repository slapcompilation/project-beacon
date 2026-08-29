// The valueFormatting union, re-asked on every CI run.
//
// 736 asserts all of this once, at the moment it landed, and never again —
// applied migrations are immutable and run once. These are the same questions
// asked continuously, because the union IS the vocabulary and a vocabulary
// drifts silently:
//
//   "Comprehensive formatting configuration for displaying property values in
//    user interfaces. Supports different value types including numbers, dates,
//    timestamps, booleans, and known Foundry types."
//   — api/ontologies-v2-resources-object-types-get-object-type-full-metadata.md
//
// 673 built this from the two prose pages and never opened api/, which is how
// date and timestamp came to share one kind, boolean had no form at all, and
// three published sets were stored short.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

describe.skipIf(noDb)('value formatting', () => {
  let db: pg.Client

  const valid = async (base: string, j: unknown): Promise<boolean> =>
    (await db.query('select public.value_formatting_valid($1, $2::jsonb) v',
      [base, JSON.stringify(j)])).rows[0].v as boolean

  const num = (numberType: unknown) => ({ number: { numberType } })

  beforeAll(async () => { db = await connect() })
  afterAll(async () => { await rollback(db) })

  it('has exactly the five members the api publishes', async () => {
    // Each on the base type its required fields make sense for; the binding is
    // 736's stated inference, and this is where it would fail loudly.
    expect(await valid('date', { date: { format: { localizedFormat: { format: 'DATE_FORMAT_DATE' } } } })).toBe(true)
    expect(await valid('timestamp', { timestamp: { format: { localizedFormat: { format: 'DATE_FORMAT_TIME' } }, displayTimezone: { user: {} } } })).toBe(true)
    expect(await valid('double', num({ standard: { baseFormatOptions: {} } }))).toBe(true)
    expect(await valid('boolean', { boolean: { valueIfTrue: 'Yes', valueIfFalse: 'No' } })).toBe(true)
    expect(await valid('string', { knownType: { knownType: 'RESOURCE_RID' } })).toBe(true)

    // A sixth member is not a member.
    expect(await valid('string', { text: { upper: true } })).toBe(false)
    // Nor is a union body carrying two of them.
    expect(await valid('double', {
      number: { numberType: { standard: { baseFormatOptions: {} } } },
      boolean: { valueIfTrue: 'y', valueIfFalse: 'n' },
    })).toBe(false)
  })

  // "timestamp … displayTimezone · union · required" — and `date` has none.
  // 673 collapsed the two into one kind with an optional timezone, so both of
  // these were accepted.
  it('keeps date and timestamp apart, and requires the timezone of one', async () => {
    expect(await valid('timestamp', { timestamp: { format: { stringFormat: { pattern: 'HH:mm' } } } })).toBe(false)
    expect(await valid('date', { date: { format: { localizedFormat: { format: 'DATE_FORMAT_DATE' } } }, })).toBe(true)
    expect(await valid('timestamp', { date: { format: { localizedFormat: { format: 'DATE_FORMAT_DATE' } } } })).toBe(false)
    expect(await valid('date', { timestamp: { format: { localizedFormat: { format: 'DATE_FORMAT_DATE' } }, displayTimezone: { user: {} } } })).toBe(false)
    // A static zone is a constant or a property, the api's operand union.
    expect(await valid('timestamp', { timestamp: { format: { stringFormat: { pattern: 'HH:mm' } }, displayTimezone: { static: { zoneId: { propertyType: { propertyApiName: 'tz' } } } } } })).toBe(true)
    expect(await valid('timestamp', { timestamp: { format: { stringFormat: { pattern: 'HH:mm' } }, displayTimezone: { static: { zoneId: 'Europe/Athens' } } } })).toBe(false)
  })

  it('takes the seven localized date formats, one more than the prose table', async () => {
    const seven = ['DATE_FORMAT_RELATIVE_TO_NOW', 'DATE_FORMAT_DATE', 'DATE_FORMAT_YEAR_AND_MONTH',
      'DATE_FORMAT_DATE_TIME', 'DATE_FORMAT_DATE_TIME_SHORT', 'DATE_FORMAT_TIME', 'DATE_FORMAT_ISO_INSTANT']
    for (const format of seven) {
      expect(await valid('date', { date: { format: { localizedFormat: { format } } } }), format).toBe(true)
    }
    // The prose table's own spellings are not the wire tokens.
    expect(await valid('date', { date: { format: { localizedFormat: { format: 'relative' } } } })).toBe(false)
  })

  it('takes the nine numberType members and refuses a tenth', async () => {
    const nine: unknown[] = [
      { standard: { baseFormatOptions: { useGrouping: true, notation: 'STANDARD' } } },
      { duration: { formatStyle: { timecode: {} }, baseValue: 'MILLISECONDS' } },
      { fixedValues: { values: { 1: 'First', 2: 'Second' } } },
      { affix: { baseFormatOptions: {}, affix: { prefix: { constant: { value: 'USD ' } } } } },
      { scale: { scaleType: 'THOUSANDS', baseFormatOptions: {} } },
      { currency: { style: 'STANDARD', currencyCode: { constant: { value: 'USD' } }, baseFormatOptions: {} } },
      { standardUnit: { unit: { constant: { value: 'celsius' } }, baseFormatOptions: {} } },
      { customUnit: { unit: { constant: { value: 'widgets' } }, baseFormatOptions: {} } },
      { ratio: { ratioType: 'PER_MILLE', baseFormatOptions: {} } },
    ]
    for (const m of nine) {
      expect(await valid('long', num(m)), JSON.stringify(m)).toBe(true)
    }
    expect(await valid('long', num({ roman: { uppercase: true } }))).toBe(false)
  })

  // Every enum inside, so a member cannot quietly gain or lose one.
  it('closes every enum the api closes', async () => {
    expect(await valid('long', num({ standard: { baseFormatOptions: { notation: 'COMPACT' } } }))).toBe(true)
    expect(await valid('long', num({ standard: { baseFormatOptions: { notation: 'PLAIN' } } }))).toBe(false)
    expect(await valid('long', num({ standard: { baseFormatOptions: { roundingMode: 'ROUND_CLOSEST' } } }))).toBe(true)
    expect(await valid('long', num({ standard: { baseFormatOptions: { roundingMode: 'HALF_UP' } } }))).toBe(false)
    expect(await valid('long', num({ scale: { scaleType: 'BILLIONS', baseFormatOptions: {} } }))).toBe(true)
    expect(await valid('long', num({ scale: { scaleType: 'TRILLIONS', baseFormatOptions: {} } }))).toBe(false)
    expect(await valid('long', num({ ratio: { ratioType: 'BASIS_POINTS', baseFormatOptions: {} } }))).toBe(true)
    expect(await valid('long', num({ ratio: { ratioType: 'PER_CENT', baseFormatOptions: {} } }))).toBe(false)
    expect(await valid('long', num({ currency: { style: 'COMPACT', currencyCode: { constant: { value: 'EUR' } }, baseFormatOptions: {} } }))).toBe(true)
    expect(await valid('long', num({ currency: { style: 'LONG', currencyCode: { constant: { value: 'EUR' } }, baseFormatOptions: {} } }))).toBe(false)
    expect(await valid('long', num({ duration: { formatStyle: { humanReadable: { showFullUnits: true } }, baseValue: 'SECONDS', precision: 'HOURS' } }))).toBe(true)
    expect(await valid('long', num({ duration: { formatStyle: { humanReadable: {} }, baseValue: 'SECONDS', precision: 'WEEKS' } }))).toBe(false)
    expect(await valid('long', num({ duration: { formatStyle: { humanReadable: {} }, baseValue: 'NANOSECONDS' } }))).toBe(false)
  })

  // "Map integer values to custom human-readable strings" — 673 excluded this
  // as named-but-never-specified, which the api falsifies.
  it('maps fixed values by integer keys only', async () => {
    expect(await valid('integer', num({ fixedValues: { values: { '-1': 'Below', 0: 'None', 3: 'Third' } } }))).toBe(true)
    expect(await valid('integer', num({ fixedValues: { values: { first: 'One' } } }))).toBe(false)
    expect(await valid('integer', num({ fixedValues: { values: [] } }))).toBe(false)
  })

  // "one of USER_OR_GROUP_ID, RESOURCE_RID, ARTIFACT_GID" — three, and the
  // reading had excluded the third because artifacts are a product we lack.
  // Storing the token is not rendering it, and an enumeration beats a
  // description.
  it('knows all three known types, artifact included', async () => {
    for (const k of ['USER_OR_GROUP_ID', 'RESOURCE_RID', 'ARTIFACT_GID']) {
      expect(await valid('string', { knownType: { knownType: k } }), k).toBe(true)
    }
    expect(await valid('string', { knownType: { knownType: 'DATASET_RID' } })).toBe(false)
    expect(await valid('long', { knownType: { knownType: 'RESOURCE_RID' } })).toBe(false)
  })

  it('gives boolean the two strings it requires', async () => {
    expect(await valid('boolean', { boolean: { valueIfTrue: 'Yes', valueIfFalse: 'No' } })).toBe(true)
    expect(await valid('boolean', { boolean: { valueIfTrue: 'Yes' } })).toBe(false)
    expect(await valid('boolean', { boolean: { valueIfTrue: 1, valueIfFalse: 0 } })).toBe(false)
  })

  // 737. Every arm of 736 returned NULL rather than false for a missing
  // required key, because jsonb_typeof(NULL) is NULL and NULL rides an AND
  // chain. A CHECK treats NULL as satisfied, so the union failed OPEN — and
  // 736's own probe could not see it, because `IF valid(...) THEN RAISE` does
  // not take its branch on a NULL either. toBe(false), not toBeFalsy().
  it('fails closed on a missing required field, in every arm', async () => {
    const malformed: [string, unknown][] = [
      ['boolean', { boolean: { valueIfTrue: 'Yes' } }],
      ['boolean', { boolean: {} }],
      ['date', { date: {} }],
      ['date', { date: { format: {} } }],
      ['date', { date: { format: { stringFormat: {} } } }],
      ['timestamp', { timestamp: { format: { localizedFormat: { format: 'DATE_FORMAT_TIME' } } } }],
      ['timestamp', { timestamp: { format: { localizedFormat: { format: 'DATE_FORMAT_TIME' } }, displayTimezone: { static: {} } } }],
      ['string', { knownType: {} }],
      ['double', { number: {} }],
      ['double', num({ standard: {} })],
      ['double', num({ currency: { style: 'STANDARD' } })],
      ['double', num({ affix: { baseFormatOptions: {} } })],
      ['double', num({ fixedValues: {} })],
      ['double', num({ duration: { formatStyle: { timecode: {} } } })],
    ]
    for (const [base, j] of malformed) {
      expect(await valid(base, j), `${base} ${JSON.stringify(j)}`).toBe(false)
    }
  })

  // The shapes 673 stored. Nothing carries them — 736 refused to run otherwise
  // — and this is what makes it a replacement rather than an addition.
  it('no longer accepts the flat kinds 673 invented', async () => {
    expect(await valid('string', { kind: 'user' })).toBe(false)
    expect(await valid('string', { kind: 'resource_rid' })).toBe(false)
    expect(await valid('timestamp', { kind: 'datetime', style: 'relative' })).toBe(false)
    expect(await valid('double', { kind: 'numeric', base: 'currency' })).toBe(false)
  })
})
