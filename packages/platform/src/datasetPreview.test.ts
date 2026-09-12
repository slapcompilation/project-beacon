// The preview table's readers, re-asked on every CI run.
//
// Migration 804 proves these once at landing. The durable questions, from
// dataset-preview/overview: the sample is a limited number of rows and the
// header states the exact count; sort and filter apply to the whole dataset
// before the sample; a cell can be included only or excluded; the Columns
// section carries data stats. And the two gates every row reader applies.
//
// Reading: docs/foundry-reference/readings/dataset-preview.md.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

const NL = '\n'

describe.skipIf(noDb)('the preview table', () => {
  let db: pg.Client
  let f: Fixture
  let usr = ''

  const rows = async (args: string, params: unknown[] = []): Promise<Record<string, unknown>[]> =>
    (await db.query(`select p from public.dataset_preview(${args}) p`, params))
      .rows.map((r) => r.p as Record<string, unknown>)

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'platform_preview')
    // The readers compose can_read_dataset_data, which wants a real caller.
    usr = ((await db.query('select gen_random_uuid() as id')).rows[0] as { id: string }).id
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, `preview-${usr}@beacon.test`])
    await db.query(`insert into public.users (id, email, role, organization_id) values ($1,$2,'admin',$3)`,
      [usr, `preview-${usr}@beacon.test`, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])
    // The options object is whole or refused (789), so the null token is laid
    // over the defaults rather than sent alone.
    await db.query(
      `select public.upload_file_to_dataset($1::uuid, 'crew.csv', $2::text, 'master',
         public.csv_parser_defaults() || $3::jsonb)`,
      [f.datasetId, `name,seats${NL}Ada,2${NL}Grace,3${NL}Kay,NA${NL}Ada,5${NL}`,
        JSON.stringify({ nullValues: ['NA'] })])
  })
  afterAll(async () => { await rollback(db) })

  it('shows the view keyed by column, without the system columns', async () => {
    const r = await rows('$1', [f.branchId])
    expect(r).toHaveLength(4)
    expect(r[0]).toEqual({ name: 'Ada', seats: 2 })
    expect(r[2]).toEqual({ name: 'Kay', seats: null })
  })

  it('states the exact count, under the same filters as the sample', async () => {
    const count = async (filters: unknown[]) =>
      Number((await db.query('select public.dataset_preview_count($1, $2::jsonb) as n',
        [f.branchId, JSON.stringify(filters)])).rows[0].n)
    expect(await count([])).toBe(4)
    expect(await count([{ column: 'name', op: 'include', value: 'Ada' }])).toBe(2)
  })

  it('sorts and filters the whole dataset before sampling', async () => {
    // "any action taken on the data, such as filtering or sorting, will apply
    //  to the full dataset" — sampled to one, the top of the sort is 5.
    expect((await rows('$1, 1, $2, true', [f.branchId, 'seats']))[0].seats).toBe(5)
    expect(await rows('$1, 300, null, false, $2::jsonb',
      [f.branchId, JSON.stringify([{ column: 'name', op: 'exclude', value: 'Ada' }])]))
      .toEqual([{ name: 'Grace', seats: 3 }, { name: 'Kay', seats: null }])
    // A JSON null filters on the SQL null, and an exclude keeps the null row.
    expect(await rows('$1, 300, null, false, $2::jsonb',
      [f.branchId, JSON.stringify([{ column: 'seats', op: 'include', value: null }])]))
      .toEqual([{ name: 'Kay', seats: null }])
    expect(await rows('$1, 300, null, false, $2::jsonb',
      [f.branchId, JSON.stringify([{ column: 'seats', op: 'exclude', value: 2 }])])).toHaveLength(3)
  })

  it('carries the stats panel counts for a column', async () => {
    const stats = async (col: string) =>
      (await db.query('select public.dataset_column_stats($1, $2) as s', [f.branchId, col])).rows[0].s as {
        rows: number; normal: number; null: number; distinct: number; values: { value: unknown; count: number }[]
      }
    const name = await stats('name')
    expect(name).toMatchObject({ rows: 4, null: 0, normal: 4, distinct: 3 })
    expect(name.values[0]).toEqual({ value: 'Ada', count: 2 })
    expect(await stats('seats')).toMatchObject({ rows: 4, null: 1, normal: 3 })
  })

  it('refuses a name that is not a column, by name', async () => {
    expect(await refused(db, () => db.query("select count(*) from public.dataset_preview($1, 300, 'rank')", [f.branchId])))
      .toContain('Datasets:UnknownColumn')
    expect(await refused(db, () => db.query("select public.dataset_column_stats($1, 'rank')", [f.branchId])))
      .toContain('Datasets:UnknownColumn')
    expect(await refused(db, () => db.query(`select count(*) from public.dataset_preview($1, 300, null, false,
      '[{"column":"name","op":"like","value":"A"}]')`, [f.branchId]))).toContain('Datasets:UnknownFilterOp')
  })

  it('is refused from another organization, as if the branch did not exist', async () => {
    const other = ((await db.query(
      `insert into public.organizations (name) values ('preview other') returning id`)).rows[0] as { id: string }).id
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: other } })])
    try {
      expect(await refused(db, () => db.query('select count(*) from public.dataset_preview($1)', [f.branchId])))
        .toContain('Datasets:BranchNotFound')
    } finally {
      await db.query(`select set_config('request.jwt.claims', $1, true)`,
        [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])
    }
  })
})
