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
// WHAT CHANGED, and why it matters more than it looks. `PUBLISHED` used to be a
// HAND-COPIED transcription of that table sitting in this file. It could catch
// the database and TypeScript drifting apart, and could not catch a token wrong
// in all three at once — the restatement carried whatever error the CHECK did.
//
// 599 proved it. I renamed `cipher` to `cipher_text` on the strength of
// base-types, property-reducers and the api; 600 reverted it, because the page
// THIS FILE NAMES enumerates twenty-two names in its first column and calls it
// `Cipher`. Our set is a 1:1 snake_case of that column. The hand-copy did not
// cause the mistake and could not have prevented it: I moved all three together
// and it passed.
//
// So the map is now PARSED FROM THE PAGE at test time. A rename that the table
// does not support fails here, and a table that changes upstream fails here too,
// which is what `check:doc-drift` can only notify about.
//
// Verified once against the transcription it replaces: 22 types, identical
// title-key and primary-key verdicts, no differences.
//
// AND THE RULE THE PARSER CANNOT ENFORCE. Foundry is internally inconsistent
// about the cipher type's name, and no guard decides which page wins. An
// ENUMERATION beats a DESCRIPTION: our set is that table, so borrowing one
// element's spelling from a page that merely describes it leaves the set a
// mixture of two sources.

import fs from 'node:fs'
import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  PROPERTY_TYPES, primaryKeyEligibility, canBeTitleKey, type PropertyType,
} from '@beacon/ontology'
import { noDb, connect, rollback } from './harness'

const PAGE = new URL(
  '../../../docs/foundry-reference/mirror/object-link-types/properties-overview.md',
  import.meta.url)

type Published = Record<string, { title: boolean; primary: 'yes' | 'discouraged' | 'no' }>

/** The page's own table, read rather than restated. Throws rather than
 *  returning a thin map: a parser that silently finds three types would make
 *  every assertion below vacuous. */
function published(): Published {
  const lines = fs.readFileSync(PAGE, 'utf8').split(/\r?\n/)
  const from = lines.findIndex((l) => l.startsWith('## Supported property types'))
  if (from < 0) throw new Error('properties-overview no longer has the section this file reads')

  const out: Published = {}
  let started = false
  for (const line of lines.slice(from)) {
    if (!line.startsWith('|')) { if (started) break; else continue }
    started = true
    const cells = line.split('|').slice(1, -1)
    if (cells.length < 3) continue
    const names = [...cells[0].matchAll(/`([A-Z][A-Za-z ]*?)`/g)].map((m) => m[1])
    if (names.length === 0) continue                     // header and separator
    const primary = cells[2].trim().toLowerCase()
    if (primary !== 'yes' && primary !== 'discouraged' && primary !== 'no') {
      throw new Error(`unreadable primary-key verdict on the page: "${cells[2].trim()}"`)
    }
    const title = /^yes$/i.test(cells[1].trim())
    for (const n of names) out[n.trim().toLowerCase().replace(/\s+/g, '_')] = { title, primary }
  }
  if (Object.keys(out).length < 20) {
    throw new Error(`only ${Object.keys(out).length} type(s) parsed; the table's shape has changed`)
  }
  return out
}

const PUBLISHED = published()

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
