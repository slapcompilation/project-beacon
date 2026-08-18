// A granular policy may never be widened by an attribute we cannot evaluate.
//
// `authorized_group_ids` is the one user attribute Foundry declines to define —
// "Contact your Palantir administrator if you plan to use granular policies
// with scoped sessions" — so 484 and 490 left it unbound. They bound it to an
// empty array, which is fail-closed for `intersects` and `superset_of` and
// fail-OPEN for `subset_of`, because the empty set is a subset of everything.
//
// 568 makes the comparison compile to `false` instead, so the outcome no longer
// depends on the operator or on which side the attribute sits.
//
// The durable question is the class: **every comparison mentioning an unbound
// attribute must be unsatisfiable**, in every operator and both positions. That
// is checked by construction below rather than by listing the four shapes that
// happened to exist when this was written.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

// A collection column is typed ARRAY — a marking-backed column "must be of
// type STRING ARRAY" — and the shape checker compares that token exactly.
const FIELDS = '[{"name":"groups","type":"ARRAY"},{"name":"owner","type":"STRING"}]'
const COLLECTION_OPS = ['intersects', 'subset_of', 'superset_of'] as const

describe.skipIf(noDb)('a policy is never widened by an unbound attribute', () => {
  let db: pg.Client
  beforeAll(async () => { db = await connect() })
  afterAll(async () => { await rollback(db) })

  const compile = async (comparison: string, left: object, right: object) => {
    const { rows } = await db.query(
      `select public.granular_comparison_sql(
         jsonb_build_object('comparison', $1::text, 'left', $2::jsonb, 'right', $3::jsonb),
         $4::jsonb, 't') as s`,
      [comparison, JSON.stringify(left), JSON.stringify(right), FIELDS])
    return (rows[0] as { s: string }).s
  }

  it('compiles every unbound comparison to false, both positions, every operator', async () => {
    for (const op of COLLECTION_OPS) {
      const attrLeft = await compile(op, { user_attribute: 'authorized_group_ids' }, { column: 'groups' })
      const attrRight = await compile(op, { column: 'groups' }, { user_attribute: 'authorized_group_ids' })
      expect(attrLeft, `${op} with the attribute on the left`).toBe('false')
      expect(attrRight, `${op} with the attribute on the right`).toBe('false')
    }
  })

  it('would have been widened by the old placeholder', async () => {
    // The defect, stated as arithmetic so the next reader sees why a value
    // could not work: an empty array is a subset of every array, so the old
    // binding made `attribute subset_of column` true for every row.
    const { rows } = await db.query(`
      select ('{}'::text[] <@ ARRAY['a']) as subset_was_true,
             ('{}'::text[] && ARRAY['a']) as intersects_was_false`)
    expect(rows[0].subset_was_true).toBe(true)
    expect(rows[0].intersects_was_false).toBe(false)
  })

  it('leaves every bound attribute binding to the caller', async () => {
    // A fix to one binding, not a narrowing of the compiler.
    for (const [attr, fn] of [
      ['group_ids', 'auth_group_ids'],
      ['group_names', 'auth_group_names'],
      ['marking_ids', 'auth_marking_ids'],
      ['organization_marking_ids', 'auth_org_marking_ids'],
    ]) {
      const s = await compile('intersects', { user_attribute: attr }, { column: 'groups' })
      expect(s, `${attr} binds to ${fn}`).toContain(fn)
    }
    const uid = await compile('equal', { user_attribute: 'user_id' }, { column: 'owner' })
    expect(uid).toContain('auth.uid()')
  })

  it('refuses NOT, which is the same hazard through the documented door', async () => {
    // "Avoid using NOT conditions with group, marking, or organization
    // memberships … causing the condition to pass and grant more access than
    // intended." Ours refuses outright; asserted because a guard nobody has
    // watched fail is not a guard.
    await db.query('savepoint not_probe')
    let err: string | null = null
    try {
      await db.query(
        `select public.granular_comparison_check(
           jsonb_build_object('not', jsonb_build_object(
             'comparison','equal',
             'left', jsonb_build_object('user_attribute','user_id'),
             'right', jsonb_build_object('column','owner'))),
           $1::jsonb)`, [FIELDS])
    } catch (e) { err = e instanceof Error ? e.message : String(e) }
    await db.query('rollback to savepoint not_probe')
    expect(err).toContain('Policies:NotUnsupported')
  })

  it('keeps a policy that only mentions the attribute granting nothing', async () => {
    // false composes: unsatisfiable alone, harmless as an alternative.
    const policy = {
      match: 'all',
      rules: [{
        comparison: 'subset_of',
        left: { user_attribute: 'authorized_group_ids' },
        right: { column: 'groups' },
      }],
    }
    const { rows } = await db.query(
      `select public.granular_policy_sql($1::jsonb, $2::jsonb, 't') as s`,
      [JSON.stringify(policy), FIELDS])
    const sql = (rows[0] as { s: string }).s
    expect(sql).toContain('false')

    const { rows: evald } = await db.query(
      `select ${sql.replace(/t\.\w+/g, "ARRAY['a']::text[]")} as granted`)
    expect(evald[0].granted).toBe(false)
  })
})
