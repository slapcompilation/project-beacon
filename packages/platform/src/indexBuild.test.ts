// An object type's index is built by the build engine, and something runs it.
//
// "A Funnel batch pipeline is comprised of a series of Foundry build jobs"
// (object-indexing/funnel-batch-pipelines), triggered by a published pair:
// "Live pipelines run whenever their respective datasources are updated.
// Additionally, if user edits on objects are detected, live pipelines will run
// every six hours".
//
// 442 built the indexer and nothing called it — the platform marked an index
// stale and left it stale. These are the questions that keep the wire attached:
// an index job is a real build job, it waits for the build rewriting its
// datasource, staleness is re-asked, and the heartbeat picks it up.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, commit, refused, type Fixture } from './harness'

describe.skipIf(noDb)('the index is a build', () => {
  let db: pg.Client
  let f: Fixture
  let type = ''
  let usr = ''
  let head = ''
  let ont = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'idxbuild')
    usr = (await one('select gen_random_uuid() as id')).id
    const email = `idxbuild-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, email, f.orgId])
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, usr, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])

    // A datasource with rows, and a type over it.
    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [f.datasetId, f.branchId])).id
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      [f.datasetId, txn, JSON.stringify([{ name: 'pk', type: 'STRING' }, { name: 'city', type: 'STRING' }])])
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'rows.parquet',2) returning id`, [f.datasetId, txn])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp()
        where id=$1`, [txn])
    head = txn
    const phys = (await one('select public.dataset_materialize($1,$2) as t', [f.datasetId, txn])).t
    await db.query(`insert into datasets.${phys} (_file, pk, city) values ($1,'A','ATH'),($1,'B','SKG')`, [file])

    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'idxbuild','Idx build',false) returning id`, [f.spaceId])).id
    type = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
      JSON.stringify({ api_name: 'IdxThing', label: 'Idx thing', ontology_id: ont,
        datasources: [{ dataset_id: f.datasetId, branch_id: f.branchId }] }),
      // Key properties only: a non-key property must name its datasource, and
      // the count is what this suite asserts.
      JSON.stringify([{ property_id: 'pk', display_name: 'Id', api_name: 'id', base_type: 'string',
        source: 'column', backing_column: 'pk', is_primary_key: true, is_title_key: true, required: true }]),
    ])).id
    await db.query('select public.save_working_state()')
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('indexes through a real build job, not a bare function call', async () => {
    const build = (await one('select public.run_index_build(array[$1]::uuid[], true) as b', [type])).b
    expect(build).toBeTruthy()

    const job = await one(
      `select state, output_object_type_id, output_dataset_id, spec_version, error
         from public.build_jobs where build_id = $1`, [build])
    expect(job.state, job.error ?? '').toBe('COMPLETED')
    // The output is the object type; a dataset job's column stays empty.
    expect(job.output_object_type_id).toBe(type)
    expect(job.output_dataset_id).toBeNull()
    // And the build settled through the same path as any other.
    expect((await one('select status from public.builds where id=$1', [build])).status).toBe('SUCCEEDED')
    expect(Number((await one(
      'select object_count as n from public.object_type_indexes where object_type_id=$1', [type])).n)).toBe(2)
  })

  it('does not rebuild a fresh index, and force overrides', async () => {
    // "If an output dataset is fresh, it will not be recomputed" — asked of an index.
    expect((await one('select public.run_index_build(array[$1]::uuid[], false) as b', [type])).b).toBeNull()
    expect((await one('select public.run_index_build(array[$1]::uuid[], true) as b', [type])).b).toBeTruthy()
  })

  it('goes stale when the datasource moves, and rebuilds', async () => {
    head = await commit(db, f.datasetId, f.branchId, 'APPEND', ['more.parquet'], head)
    // A new committed transaction changes the spec's input state, so the same
    // freshness rule that governs dataset jobs now says rebuild.
    const build = (await one('select public.run_index_build(array[$1]::uuid[], false) as b', [type])).b
    expect(build).toBeTruthy()
    expect((await one(
      `select state from public.build_jobs where build_id = $1`, [build])).state).toBe('COMPLETED')
  })

  it('waits for the build that rewrites its datasource', async () => {
    // An in-flight job writing the type's datasource.
    const blocker = (await one(
      `insert into public.builds (organization_id, requested_by) values ($1,$2) returning id`,
      [f.orgId, usr])).id
    const other = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'idx_other','idx_other') returning id`, [f.orgId, f.projectId])).id
    await db.query(`insert into public.dataset_branches (dataset_id, name) values ($1,'master')`, [other])
    await db.query(`insert into public.dataset_inputs (dataset_id, input_dataset_id) values ($1,$2)`,
      [other, f.datasetId])
    // The blocker's job OUTPUTS the datasource our index reads.
    const spec = (await one(
      `insert into public.job_specs (output_dataset_id, logic_sql)
       values ($1,'SELECT 1 AS n') returning id`, [other])).id
    await db.query(
      `insert into public.build_jobs (build_id, job_spec_id, output_dataset_id, state)
       values ($1,$2,$3,'RUNNING')`, [blocker, spec, f.datasetId])

    const build = (await one('select public.run_index_build(array[$1]::uuid[], true) as b', [type])).b
    expect((await one(
      'select state from public.build_jobs where build_id=$1', [build])).state).toBe('WAITING')
    expect((await one('select status from public.builds where id=$1', [build])).status).toBe('RUNNING')

    // The blocker finishes; the heartbeat's drain picks the index job up.
    await db.query(`update public.build_jobs set state='COMPLETED' where build_id=$1`, [blocker])
    await db.query(`update public.builds set status='SUCCEEDED' where id=$1`, [blocker])
    expect(Number((await one('select public.drain_waiting_jobs() as n')).n)).toBeGreaterThan(0)
    expect((await one(
      'select state, error from public.build_jobs where build_id=$1', [build])).state).toBe('COMPLETED')
  })

  it('refuses a reindex to someone who may not edit the type', async () => {
    const outsider = (await one('select gen_random_uuid() as id')).id
    const email = `idxout-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [outsider, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [outsider, email, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: outsider, app_metadata: { role: 'member', org_id: f.orgId } })])

    const err = await refused(db, () =>
      db.query('select public.run_index_build(array[$1]::uuid[], true)', [type]))
    expect(err).toContain('Builds:NotAuthorized')

    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])
  })

  it('the minute hand reindexes, and the engine kept its dataset path', async () => {
    // run_stale_indexes is the Funnel live pipeline; the heartbeat calls it.
    const cron = await one(
      `select command from cron.job where jobname = 'beacon-run-schedules'`)
    expect(cron.command).toContain('run_schedules')
    const def = (await one(
      `select pg_get_functiondef('public.run_schedules(timestamptz)'::regprocedure) as d`)).d
    expect(def).toContain('run_stale_indexes')

    // A job that outputs neither, or both, is impossible.
    expect(await count(
      `select count(*) n from pg_constraint where conrelid='public.job_specs'::regclass
         and conname = 'job_specs_one_output'`)).toBe(1)
  })
})
