// The property vocabulary exists twice, and nothing was checking the two agree.
//
// `@beacon/ontology` decides what the form offers and validates; the database
// decides what it will store. Both encode the same published table —
// `object-link-types/properties-overview#supported-property-types` — and if they
// drift, the failure is silent in the worst way: a form that offers a type the
// CHECK rejects, or validation that permits a primary key the constraint refuses.
//
// One rule in one place is the usual answer, but SQL and TypeScript genuinely
// both need it. So the next best thing is to assert the agreement, and to assert
// both against the page rather than against each other — two implementations
// agreeing on the same mistake is not a passing test.
//
// THE LIMIT OF THAT, learned in 599. `PUBLISHED` below is a HAND-COPIED
// restatement of the page, so it catches drift between the database and
// TypeScript and cannot catch a token that was wrong in all three from the
// start. `cipher` sat here for as long as it sat in the CHECK, because the page
// says "Cipher text" and the copy dropped a word. Three things agreeing is not
// three witnesses when one of them was copied from the other two.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  PROPERTY_TYPES, primaryKeyEligibility, canBeTitleKey, type PropertyType,
} from '@beacon/ontology'
import { noDb, connect, rollback } from './harness'

/** Transcribed from the page's table. The third column is the primary-key
 *  verdict, the second the title-key one. */
const PUBLISHED: Record<string, { title: boolean; primary: 'yes' | 'discouraged' | 'no' }> = {
  // "Commonly used: String, Integer, Short — Yes / Yes"
  string: { title: true, primary: 'yes' },
  integer: { title: true, primary: 'yes' },
  short: { title: true, primary: 'yes' },
  // "Time-based: Date, Timestamp — Yes / Discouraged"
  date: { title: true, primary: 'discouraged' },
  timestamp: { title: true, primary: 'discouraged' },
  // "Number-like: Boolean, Byte, Long — Yes / Discouraged"
  boolean: { title: true, primary: 'discouraged' },
  byte: { title: true, primary: 'discouraged' },
  long: { title: true, primary: 'discouraged' },
  // "Float-like: Float, Double, Decimal — Yes / No"
  float: { title: true, primary: 'no' },
  double: { title: true, primary: 'no' },
  decimal: { title: true, primary: 'no' },
  vector: { title: false, primary: 'no' },
  array: { title: true, primary: 'no' },
  struct: { title: false, primary: 'no' },
  // "Media Reference, Time Series, Geotemporal Series, Attachment — No / No"
  media_reference: { title: false, primary: 'no' },
  time_series: { title: false, primary: 'no' },
  geotemporal_series: { title: false, primary: 'no' },
  attachment: { title: false, primary: 'no' },
  geopoint: { title: true, primary: 'no' },
  geoshape: { title: false, primary: 'no' },
  marking: { title: false, primary: 'no' },
  cipher_text: { title: true, primary: 'no' },
}

describe.skipIf(noDb)('the property vocabulary', () => {
  let db: pg.Client
  beforeAll(async () => { db = await connect() })
  afterAll(async () => { await rollback(db) })

  it('the database offers exactly the types the page lists', async () => {
    const { rows: [r] } = await db.query('select public.property_base_types() as t')
    expect([...(r as { t: string[] }).t].sort()).toEqual(Object.keys(PUBLISHED).sort())
  })

  it('and TypeScript offers exactly the same set', () => {
    expect(PROPERTY_TYPES.map((t) => t.value).sort()).toEqual(Object.keys(PUBLISHED).sort())
  })

  it('both agree with the page on primary-key eligibility, type by type', async () => {
    const { rows } = await db.query(
      `select t as base_type, public.primary_key_eligibility(t) as verdict
         from unnest(public.property_base_types()) t`)
    const fromDb = Object.fromEntries(
      (rows as { base_type: string; verdict: string }[]).map((r) => [r.base_type, r.verdict]))

    for (const [type, published] of Object.entries(PUBLISHED)) {
      expect(fromDb[type], `database, ${type}`).toBe(published.primary)
      expect(primaryKeyEligibility(type as PropertyType), `TypeScript, ${type}`).toBe(published.primary)
    }
  })

  it('both agree with the page on title-key eligibility, type by type', async () => {
    const { rows } = await db.query(
      `select t as base_type, public.title_key_eligible(t) as ok
         from unnest(public.property_base_types()) t`)
    const fromDb = Object.fromEntries(
      (rows as { base_type: string; ok: boolean }[]).map((r) => [r.base_type, r.ok]))

    for (const [type, published] of Object.entries(PUBLISHED)) {
      expect(fromDb[type], `database, ${type}`).toBe(published.title)
      expect(canBeTitleKey(type as PropertyType), `TypeScript, ${type}`).toBe(published.title)
    }
  })
})
