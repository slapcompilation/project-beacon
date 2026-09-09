// The type class catalogue against the page that enumerates it.
//
// 710 hand-wrote `ontology_type_classes_catalogue()` from
// object-link-types/metadata-typeclasses and its COMMENT claimed "17 vertex +
// 13 timeseries rows". The page has SEVENTEEN timeseries rows, so four were
// refused by name by `guard_ontology_type_class()` — three of them carrying a
// blank Deprecated column, which the page's legend makes the value meaning
// current. 781 corrected the four; this file is why a fifth cannot happen
// quietly.
//
// It is the shape CLAUDE.md already prescribes from the base types:
// `vocabulary.test.ts` "now PARSES that table instead of restating it, so this
// particular mistake is refused mechanically". A restatement drifts the moment
// the mirror is refreshed; a parser fails CI.
//
// Only `vertex` and `timeseries` are compared. Those are the two kinds the
// catalogue deliberately holds — "Kinds the page carries that no application
// here consumes yet (hubble, schedules, …) refuse until catalogued
// deliberately" — so a hubble row appearing upstream must NOT fail this file.

import fs from 'node:fs'
import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

const PAGE = new URL(
  '../../../docs/foundry-reference/mirror/object-link-types/metadata-typeclasses.md',
  import.meta.url)

/** The kinds the catalogue is responsible for. */
const OWNED = new Set(['vertex', 'timeseries'])

/** The three the catalogue holds that this page does not carry — they come from
 *  vertex/graphs-display-options, and the COMMENT says so. Named here so the
 *  superset assertion below cannot quietly grow. */
const OFF_PAGE = new Set(['link_primary_direction', 'link_undirectional', 'link_bidirectional'])

interface Row { kind: string; name: string; appliesTo: string; deprecated: boolean }

/** The page's own table, read rather than restated. Throws rather than
 *  returning a thin list: a parser that finds three rows would make every
 *  assertion here vacuous. */
function published(): Row[] {
  const lines = fs.readFileSync(PAGE, 'utf8').split(/\r?\n/)
  const out: Row[] = []
  for (const line of lines) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').slice(1, -1)
    if (cells.length < 4) continue
    const kind = cells[2].trim().toLowerCase()
    if (!OWNED.has(kind)) continue

    // `timeseries\_id`, `key\_measure.\<measure\_>`, `endorsement\_status:<br>x`
    // — unescape, drop the line break, and keep the base name before the dot.
    const raw = cells[3].replace(/\\/g, '').replace(/<br>/g, '').trim()
    const name = raw.split('.')[0].trim()
    if (name === '' || name.toLowerCase() === 'name') continue

    const appliesTo = cells[1].trim().toLowerCase()
    // The Deprecated column carries three values: the literal token, the
    // "Configure in Capabilities page" note, or blank. Only the first means
    // deprecated — which is why `timeseries_is_deprecated` is not.
    const deprecated = /^deprecated\b/i.test(cells[0].replace(/ /g, ' ').trim())
    out.push({ kind, name, appliesTo, deprecated })
  }
  if (out.length < 30) {
    throw new Error(`only ${String(out.length)} vertex/timeseries row(s) parsed; the table's shape has changed`)
  }
  return out
}

describe.skipIf(noDb)('type classes', () => {
  let db: pg.Client
  let held: Row[] = []

  beforeAll(async () => {
    db = await connect()
    const r = await db.query(
      `select kind, name, applies_to, deprecated from public.ontology_type_classes_catalogue()
        where kind = any($1::text[])`, [[...OWNED]])
    held = r.rows.map((x: Record<string, unknown>) => ({
      kind: x.kind as string, name: x.name as string,
      appliesTo: x.applies_to as string, deprecated: x.deprecated as boolean,
    }))
  })
  afterAll(async () => { await rollback(db) })

  it('parses the page it claims to enumerate', () => {
    const page = published()
    // The two kinds, counted rather than asserted: 17 vertex and 17 timeseries
    // as of the 2026 mirror. A change here is the point of the file — read the
    // page before changing the number.
    expect(page.filter((r) => r.kind === 'vertex').length).toBeGreaterThanOrEqual(17)
    expect(page.filter((r) => r.kind === 'timeseries').length).toBe(17)
  })

  it('holds every vertex and timeseries row the page carries', () => {
    const key = (r: Row) => `${r.kind}.${r.name}`
    const have = new Set(held.map(key))
    const missing = published().filter((r) => !have.has(key(r)))
    // 710 held 13 of 17 and the omission surfaced as Ontology:UnknownTypeClass
    // at assignment time, which is the wrong place to learn it.
    expect(missing.map(key)).toEqual([])
  })

  it('carries nothing the page does not, beyond the three from graphs-display-options', () => {
    const onPage = new Set(published().map((r) => `${r.kind}.${r.name}`))
    const extra = held.filter((r) => !onPage.has(`${r.kind}.${r.name}`) && !OFF_PAGE.has(r.name))
    expect(extra.map((r) => `${r.kind}.${r.name}`)).toEqual([])
  })

  it('takes the Property/Relation column and the Deprecated column from the page', () => {
    const held0 = new Map(held.map((r) => [`${r.kind}.${r.name}`, r]))
    const wrong: string[] = []
    for (const r of published()) {
      const h = held0.get(`${r.kind}.${r.name}`)
      if (h === undefined) continue                        // the test above owns this
      if (h.appliesTo !== r.appliesTo) {
        wrong.push(`${r.kind}.${r.name} applies_to ${h.appliesTo}, page says ${r.appliesTo}`)
      }
      if (h.deprecated !== r.deprecated) {
        wrong.push(`${r.kind}.${r.name} deprecated=${String(h.deprecated)}, page says ${String(r.deprecated)}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('does not read a name as deprecated', () => {
    // The trap 710 would have hit either way: the row is called
    // timeseries_is_deprecated and its Deprecated column says "Configure in
    // Capabilities page". The column decides.
    const row = held.find((r) => r.name === 'timeseries_is_deprecated')
    expect(row).toBeDefined()
    expect(row?.deprecated).toBe(false)
    // and the one that IS the token still reads as deprecated
    expect(held.find((r) => r.name === 'timeseries_sensor_type')?.deprecated).toBe(true)
  })
})
