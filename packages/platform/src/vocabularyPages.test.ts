// Every value in every CHECK traces to a page. That is CLAUDE.md's rule, and
// until 601 nothing verified it.
//
// 599 is what it cost. I renamed the `cipher` base type on the strength of three
// pages that DESCRIBE it, without opening the one that ENUMERATES it, and every
// guard passed. #730 fixed that one vocabulary by parsing its table — but Foundry
// states vocabularies in at least three shapes, a table, `* **Name:**` bullets
// and `Strategy 1: Name` lines, so one parser cannot read them all.
//
// This is the weaker check that generalises: a value set names its page in the
// constraint's comment, and every value's WORD FORM must appear on that page.
//
// WHAT IT CANNOT DO, stated so nobody trusts it further than it goes: it cannot
// notice a value the page has and we lack. Parsing the list does that, and
// vocabulary.test.ts does it for the one vocabulary whose page is a table. This
// notices an invented value, or a rename the page does not support — the failure
// that actually happened.
//
// The undeclared count is printed, not exempted. `check:shape` and the old
// `check:vocabulary` were deleted for needing an allowlist to tell "ahead of its
// runtime" from "dead"; an allowlist says *these are fine, skip them*, and a
// count says *these are unchecked*. It can only fall: check:readings refuses a
// new migration that adds a value set without a declaration.
import fs from 'node:fs'
import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

const MIRROR = new URL('../../../docs/foundry-reference/mirror/', import.meta.url)

interface ValueSet {
  table: string
  constraint: string
  column: string
  values: string[]
  page: string | null
}

/** A plain `col = ANY (ARRAY['a','b'])`. A composite CHECK is not a value set —
 *  `link_types` has one reading `backing_kind IS DISTINCT FROM 'join_table' OR
 *  cardinality = 'many_to_many'`, whose literals are a rule, not a vocabulary. */
function valueSets(rows: { t: string; n: string; d: string; cm: string | null }[]): ValueSet[] {
  const out: ValueSet[] = []
  for (const r of rows) {
    const m = /([a-z_]+)\s*=\s*ANY\s*\(ARRAY\[([^\]]+)\]/.exec(r.d)
    if (m === null) continue
    const values = [...m[2].matchAll(/'([^']+)'/g)].map((v) => v[1])
    if (values.length < 2) continue
    // No dot in the class: a slug has none, and `[a-z0-9./-]+` swallowed the
    // full stop ending the sentence the declaration sits in.
    const page = /Values from ([a-z0-9/-]+)/.exec(r.cm ?? '')
    out.push({ table: r.t, constraint: r.n, column: m[1], values, page: page === null ? null : page[1] })
  }
  return out
}

/** `one_to_one` is written "one-to-one" on its page and `media_reference` as
 *  "Media Reference". Try each separator rather than guessing which. */
const forms = (v: string): string[] =>
  [v.replace(/_/g, ' '), v.replace(/_/g, '-'), v].map((f) => f.toLowerCase())
const flatten = (s: string): string => s.toLowerCase().replace(/[`*_]/g, '').replace(/\s+/g, ' ')

describe.skipIf(noDb)('a value set names the page it came from', () => {
  let db: pg.Client
  let sets: ValueSet[] = []

  beforeAll(async () => {
    db = await connect()
    const { rows } = await db.query(`
      select rel.relname as t, con.conname as n,
             pg_get_constraintdef(con.oid) as d,
             obj_description(con.oid, 'pg_constraint') as cm
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
       where ns.nspname = 'public' and con.contype = 'c'`)
    sets = valueSets(rows as { t: string; n: string; d: string; cm: string | null }[])
  })
  afterAll(async () => { await rollback(db) })

  it('every declared page is mirrored', () => {
    for (const s of sets) {
      if (s.page === null) continue
      const file = new URL(`${s.page}.md`, MIRROR)
      expect(fs.existsSync(file), `${s.table}.${s.column} declares ${s.page}`).toBe(true)
    }
  })

  it('every value of a declared set appears on the page it names', () => {
    for (const s of sets) {
      if (s.page === null) continue
      const page = flatten(fs.readFileSync(new URL(`${s.page}.md`, MIRROR), 'utf8'))
      for (const v of s.values) {
        expect(
          forms(v).some((f) => page.includes(f)),
          `${s.table}.${s.column} = '${v}' is not on ${s.page}`,
        ).toBe(true)
      }
    }
  })

  it('reports how many value sets have not declared one yet', () => {
    const declared = sets.filter((s) => s.page !== null)
    const undeclared = sets.filter((s) => s.page === null)
    // Printed, not asserted against a number: a threshold here would be the
    // allowlist this deliberately is not. The count exists to be read.
    // stdout directly: vitest captures console.log in run mode, and a count
    // nobody sees is the thing CLAUDE.md warns about — "read the count it
    // prints, not just its exit code".
    process.stdout.write(`\n   value sets ${String(sets.length)}`
      + ` · declared ${String(declared.length)}`
      + ` · undeclared ${String(undeclared.length)}\n`)
    expect(declared.length).toBeGreaterThan(0)
  })
})
