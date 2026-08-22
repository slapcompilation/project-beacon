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
import { noDb, connect, rollback, refused } from './harness'

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

  // 632. Every base type already had a column type; what the geo pair lacked
  // was a SHAPE, and the column type was wrong besides — geospatial/ontology
  // says both are strings and ours were jsonb. That section was not on disk
  // until it was mirrored, which is why this went unnoticed.
  describe('geopoint and geoshape carry the shape the page prints', () => {
    const ok = async (fn: string, v: string) => Number((await db.query(
      `select public.${fn}($1)::int n`, [v])).rows[0].n)

    it('stores both as the strings the page describes, and moves nothing else', async () => {
      for (const [t, want] of [['geopoint', 'text'], ['geoshape', 'text'],
                               ['string', 'text'], ['struct', 'jsonb'],
                               ['timestamp', 'timestamptz']] as const) {
        const { c } = (await db.query(
          `select public.property_column_type($1) as c`, [t])).rows[0] as { c: string }
        expect(c, `${t} column type`).toBe(want)
      }
    })

    // "a string of either latitude,longitude ... or a Geohash"
    it('takes the two geopoint forms the page names, and nothing else', async () => {
      expect(await ok('geopoint_valid', '57.64911,10.40744')).toBe(1)  // the page's own
      expect(await ok('geopoint_valid', 'u4pruydqqvj')).toBe(1)        // the page's own
      expect(await ok('geopoint_valid', '91,0')).toBe(0)               // WGS 84 bounds
      expect(await ok('geopoint_valid', '0,181')).toBe(0)
      expect(await ok('geopoint_valid', 'u4pruydqqvi')).toBe(0)        // no i in base32
      expect(await ok('geopoint_valid', '{"lat":1}')).toBe(0)
    })

    // Six types must be allowed, three must not — and Point is on the allowed
    // list while "should not" be used, so it is legal and discouraged.
    it('allows the six geoshape geometries and refuses the three collections', async () => {
      expect(await ok('geoshape_valid',
        '{ "type": "LineString", "coordinates": [ [100.0, 0.0], [101.0, 1.0] ] }')).toBe(1)
      expect(await ok('geoshape_valid', '{"type":"Point","coordinates":[1,2]}')).toBe(1)
      for (const bad of ['{"type":"Feature","geometry":{}}',
                         '{"type":"FeatureCollection","features":[]}',
                         '{"type":"GeometryCollection","geometries":[]}',
                         'not json']) {
        expect(await ok('geoshape_valid', bad), bad).toBe(0)
      }
    })

    // The clause is only worth anything if it is SQL that refuses, so build a
    // table out of it and make it refuse.
    it('emits a CHECK that a real table enforces', async () => {
      const { c } = (await db.query(
        `select public.property_column_check('geopoint','g') as c`)).rows[0] as { c: string }
      expect(c).toContain('geopoint_valid')
      await db.query(`create temp table geo632 (g text${c})`)
      await db.query(`insert into geo632 values ('57.64911,10.40744')`)
      // A deliberate failure inside a shared transaction needs a savepoint, or
      // it aborts every test after it.
      expect(await refused(db, () => db.query(
        `insert into geo632 values ('{"nonsense":true}')`))).not.toBeNull()
      await db.query(`drop table geo632`)
      // and a base type with no published shape emits nothing
      expect((await db.query(
        `select public.property_column_check('string','x') as c`)).rows[0]).toEqual({ c: '' })
    })

    it('is reached by the indexer, not just defined', async () => {
      const { d } = (await db.query(
        `select pg_get_functiondef('public.index_object_type(uuid,uuid)'::regprocedure) as d`))
        .rows[0] as { d: string }
      expect(d).toContain('property_column_check')
    })
  })

  // 633. `struct` was a base type with nothing behind it — a jsonb column of
  // any shape and no way to say what fields it has. Foundry gives it six pages,
  // and the fields belong to the PROPERTY, not to a named struct type.
  describe('a struct property has fields', () => {
    it('offers the twelve the page enumerates, all of them real base types', async () => {
      const { f } = (await db.query(
        `select public.struct_field_types() as f`)).rows[0] as { f: string[] }
      expect(f).toHaveLength(12)
      expect([...f].sort()).toEqual([
        'boolean', 'byte', 'date', 'decimal', 'double', 'float',
        'geopoint', 'integer', 'long', 'short', 'string', 'timestamp',
      ])
      // a subset of the base types, not a second vocabulary
      const { n } = (await db.query(
        `select count(*)::int n from unnest(public.struct_field_types()) x
          where not (x = any (public.property_base_types()))`)).rows[0] as { n: number }
      expect(n).toBe(0)
      // "Structs have a depth of one and cannot be nested" — enforced by the
      // enumeration rather than by a separate rule.
      expect(f).not.toContain('struct')
    })

    it('the at-least-one-field MUST is a violation, not a refusal', async () => {
      // A refusal would make the property uncreatable: the base type is chosen
      // before the first field exists.
      const d = (await db.query(
        `select pg_get_functiondef('public.ontology_violations()'::regprocedure) as d`))
        .rows[0] as { d: string }
      expect(d.d).toContain('struct_property_problems')
      // and it is not in the warnings list, which does not block a save
      const w = (await db.query(
        `select pg_get_functiondef('public.ontology_warnings()'::regprocedure) as d`))
        .rows[0] as { d: string }
      expect(w.d).not.toContain('struct_property_problems')
    })

    it('starts with its write policy already scoped, unlike its neighbour', async () => {
      // 619 had to go back and split object_type_properties-style FOR ALL
      // policies off the read path. This table was built with them split.
      const { rows } = await db.query(
        `select cmd from pg_policies where tablename = 'property_struct_fields'`)
      const cmds = (rows as { cmd: string }[]).map((r) => r.cmd).sort()
      expect(cmds).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE'])
      expect(cmds).not.toContain('ALL')
    })
  })

  // The surface for the embeddingModel union writes these five columns
  // DIRECTLY, on the strength of save_object_type not naming them — so a
  // schema save cannot clobber them. If that stops being true the card has to
  // move into the draft model, and this is where whoever changed it finds out.
  it('the property writer does not touch the vector embedding columns', async () => {
    // apply_object_type is what actually writes a property row, and 635 taught
    // it `vector_dimension`. It still does NOT write the five embedding
    // columns, which is what lets the surface set them directly. If that
    // changes, the card has to move into the draft model, and this is where
    // whoever changed it finds out.
    const { d } = (await db.query(
      `select pg_get_functiondef('public.apply_object_type(jsonb,jsonb,jsonb)'::regprocedure) as d`))
      .rows[0] as { d: string }
    expect(d).toContain('vector_dimension')
    for (const c of ['vector_embedding_kind', 'vector_embedding_model',
                     'vector_deployment_rid', 'vector_deployment_input_param',
                     'vector_deployment_output_param']) {
      expect(d, `${c} is written by save_object_type`).not.toContain(c)
    }
  })
})
