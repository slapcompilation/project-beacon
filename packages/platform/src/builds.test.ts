// The build engine, re-asked on every CI run.
//
// Migration 493 asserts this once at landing. The durable questions, all
// from data-integration/builds.md: a build computes new versions of
// datasets; a fresh output is not recomputed and force overrides; new input
// transactions and new logic each break freshness; a failing job records
// FAILED, aborts its dependents, and completed jobs keep their data; cycles
// refuse; and logic cannot read outside its declared inputs.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, commit, refused, type Fixture } from './harness'

describe.skipIf(noDb)('the build engine', () => {
  let db: pg.Client
  let f: Fixture
  let usr = ''
  let clean = ''
  let cleanBranch = ''
  let spec = ''
  let rawPhys = ''
  let rawHead = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const build = async (targets: string[], force = false, type = 'single') =>
    (await one('select public.run_build($1::uuid[], $2, $3) as b', [targets, force, type])).b

  const jobState = async (buildId: string) =>
    (await one('select state, error from public.build_jobs where build_id=$1 limit 1', [buildId]))

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'builds493')
    usr = (await one('select gen_random_uuid() as id')).id
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, `builds493-${Date.now()}@beacon.test`])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, `builds493-${Date.now()}@beacon.test`, f.orgId])
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, usr, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])

    // The raw input, with rows.
    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [f.datasetId, f.branchId])).id
    rawHead = txn
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      [f.datasetId, txn, JSON.stringify([
        { name: 'city', type: 'STRING' }, { name: 'fare', type: 'INTEGER' }])])
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'rides.parquet',3) returning id`, [f.datasetId, txn])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [txn])
    rawPhys = (await one('select public.dataset_materialize($1,$2) as t', [f.datasetId, txn])).t
    await db.query(
      `insert into datasets.${rawPhys} (_file, city, fare) values
        ($1,'ATH',10),($1,'ATH',30),($1,'SKG',20)`, [file])

    // The derived output and its JobSpec.
    clean = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'builds493_clean','clean') returning id`, [f.orgId, f.projectId])).id
    cleanBranch = (await one(
      `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [clean])).id
    await db.query(`insert into public.dataset_inputs (dataset_id, input_dataset_id) values ($1,$2)`,
      [clean, f.datasetId])
    spec = (await one(
      `insert into public.job_specs (output_dataset_id, logic_sql)
       values ($1, 'SELECT city, sum(fare)::bigint AS total FROM builds493_ds GROUP BY city')
       returning id`, [clean])).id
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('a build computes the output, with a real transaction and a derived schema', async () => {
    const b = await build([clean])
    expect(b).toBeTruthy()
    const j = await jobState(b)
    expect(j.state, j.error ?? '').toBe('COMPLETED')
    const phys = (await one('select physical_table as t from public.datasets where id=$1', [clean])).t
    const n = Number((await one(`select count(*) as n from datasets.${phys}`)).n)
    expect(n).toBe(2)
  })

  it('a fresh output is not recomputed; force overrides', async () => {
    expect(await build([clean])).toBeNull()
    expect(await build([clean], true)).toBeTruthy()
  })

  it('a new input transaction breaks freshness', async () => {
    rawHead = await commit(db, f.datasetId, f.branchId, 'APPEND', ['more.parquet'], rawHead)
    expect(await build([clean])).toBeTruthy()
  })

  it('new logic breaks freshness and bumps the version', async () => {
    const before = Number((await one('select version as v from public.job_specs where id=$1', [spec])).v)
    await db.query(
      `update public.job_specs
          set logic_sql = 'SELECT city, sum(fare)::bigint AS total, count(*) AS rides FROM builds493_ds GROUP BY city'
        where id=$1`, [spec])
    const after = Number((await one('select version as v from public.job_specs where id=$1', [spec])).v)
    expect(after).toBe(before + 1)
    expect(await build([clean])).toBeTruthy()
  })

  it('logic cannot read outside its declared inputs', async () => {
    const err = await refused(db, () => db.query(
      `update public.job_specs set logic_sql = 'SELECT email FROM public.users' where id=$1`, [spec]))
    expect(err).toContain('Builds:LogicReadsOutsideItsInputs')
  })

  it('a failing job records FAILED and the completed upstream keeps its data', async () => {
    const onward = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'builds493_onward','onward') returning id`, [f.orgId, f.projectId])).id
    await db.query(`insert into public.dataset_branches (dataset_id, name) values ($1,'master')`, [onward])
    await db.query(`insert into public.dataset_inputs (dataset_id, input_dataset_id) values ($1,$2)`,
      [onward, clean])
    await db.query(
      `insert into public.job_specs (output_dataset_id, logic_sql)
       values ($1, 'SELECT city, total / 0 AS boom FROM builds493_clean')`, [onward])
    rawHead = await commit(db, f.datasetId, f.branchId, 'APPEND', ['again.parquet'], rawHead)

    const b = await build([onward], false, 'full')
    const states = (await db.query(
      `select state from public.build_jobs where build_id=$1 order by state`, [b]))
      .rows.map((r) => (r as { state: string }).state)
    expect(states).toEqual(['COMPLETED', 'FAILED'])
    const status = (await one('select status from public.builds where id=$1', [b])).status
    expect(status).toBe('FAILED')
    // "previously completed jobs may still have written data"
    const view = Number((await one('select count(*) as n from public.dataset_view($1)', [cleanBranch])).n)
    expect(view).toBe(1)
  })

  it('a cycle refuses', async () => {
    await db.query(
      `insert into public.dataset_inputs (dataset_id, input_dataset_id)
       select $1, d.id from public.datasets d where d.api_name = 'builds493_onward'`, [f.datasetId])
    const err = await refused(db, () =>
      db.query(`select public.run_build(array[$1]::uuid[], true, 'full')`, [clean]))
    expect(err).toContain('Builds:CycleDetected')
  })
})
