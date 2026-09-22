// OSv2's data restrictions, asked of the predicate the indexer runs.
//
// "Object Storage v2 (OSv2) enforces data restrictions to ensure the quality of
// data going into the ontology... These restrictions are validated during
// indexing" (object-indexing/data-restrictions). 841 built the value arms; the
// wire that connects them to a build is asserted in indexBuild.test.ts, because
// a predicate nobody calls always passes.
//
// The boundaries are the point. A cap asserted in the middle of its range
// proves the comparison exists, not where it sits.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

describe.skipIf(noDb)('OSv2 refuses these values at index time', () => {
  let db: pg.Client

  const problem = async (
    baseType: string, elementType: string | null, value: string,
  ): Promise<string | null> => {
    const { rows } = await db.query(
      `select public.osv2_value_problem($1,$2,$3::jsonb) as p`, [baseType, elementType, value])
    return (rows[0] as { p: string | null }).p
  }

  beforeAll(async () => { db = await connect() })
  afterAll(async () => { await rollback(db) })

  // "OSv2 does not allow `NaN` or `±infinity` as property values."
  it('refuses NaN and both infinities on a real number type, and nothing else', async () => {
    for (const t of ['float', 'double', 'decimal']) {
      for (const v of ['"NaN"', '"Infinity"', '"-Infinity"']) {
        expect(await problem(t, null, v), `${t} ${v}`).toContain('infinity')
      }
      expect(await problem(t, null, '1.5')).toBeNull()
      expect(await problem(t, null, '0')).toBeNull()
    }
    // The rule is about real numbers. A string property whose value spells NaN
    // is a string, and refusing it would be stricter than the page.
    expect(await problem('string', null, '"NaN"')).toBeNull()
    expect(await problem('integer', null, '"NaN"')).toBeNull()
  })

  // "Empty strings are not allowed in OSv2; in OSv1, empty strings were
  // silently converted to nulls." We build v2, so it fails rather than nulls.
  it('refuses the empty string, and keeps null meaning absent', async () => {
    expect(await problem('string', null, '""')).toContain('empty strings')
    expect(await problem('string', null, '" "')).toBeNull()
    expect(await problem('string', null, 'null')).toBeNull()
  })

  // "String properties | 12 MB", read as binary because that is the more
  // permissive of the two readings.
  it('caps a string property at 12 MB, at the boundary', async () => {
    const cap = 12 * 1024 * 1024
    const at = (await db.query(
      `select public.osv2_value_problem('string',null,to_jsonb(repeat('x',$1))) as p`, [cap]))
      .rows[0] as { p: string | null }
    const over = (await db.query(
      `select public.osv2_value_problem('string',null,to_jsonb(repeat('x',$1))) as p`, [cap + 1]))
      .rows[0] as { p: string | null }
    expect(at.p, 'exactly 12 MB is legal').toBeNull()
    expect(over.p, 'one byte more is not').toContain('12 MB')
  })

  // "Array properties | 100,000 elements"
  it('caps an array property at 100,000 elements, at the boundary', async () => {
    const at = (await db.query(
      `select public.osv2_value_problem('array','string',
         (select jsonb_agg('x'::text) from generate_series(1,100000))) as p`)).rows[0] as { p: string | null }
    const over = (await db.query(
      `select public.osv2_value_problem('array','string',
         (select jsonb_agg('x'::text) from generate_series(1,100001))) as p`)).rows[0] as { p: string | null }
    expect(at.p, 'exactly 100,000 is legal').toBeNull()
    expect(over.p, 'one more is not').toContain('100,000')
  })

  // "OSv2 does not allow properties with nested arrays." The DECLARATION arm is
  // already refused by the array_not_nested CHECK; this is the data arm.
  it('refuses a nested array and a null element, and admits an ordinary one', async () => {
    expect(await problem('array', 'string', '[["a"]]')).toContain('nested')
    expect(await problem('array', 'string', '["a",null]')).toContain('null elements')
    expect(await problem('array', 'string', '["a","b"]')).toBeNull()
    expect(await problem('array', 'string', '[]')).toBeNull()
  })

  // The declaration arm, asserted rather than assumed: a nested array type
  // cannot be written at all.
  it('cannot even declare an array of arrays', async () => {
    const { rows } = await db.query(
      `select pg_get_constraintdef(oid) as d from pg_constraint
        where conrelid='public.object_type_properties'::regclass and conname='array_not_nested'`)
    expect((rows[0] as { d: string }).d).toContain("'array'")
  })
})
