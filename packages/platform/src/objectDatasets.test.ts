// An object dataset: the merged state, handed back to the dataset layer.
//
// "materializations of indexed data from the Ontology that contains the latest
// state of each object by combining data from both input datasources and user
// edits" (object-edits/materializations). The product calls the row an Object
// dataset and its setting a Build interval, with two named values.
//
// These are the questions that keep true: it builds through the same engine as
// everything else, the rows it writes are the index's, only the latest
// snapshot survives, and the two intervals mean what the dialog says.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('object datasets', () => {
  let db: pg.Client
  let f: Fixture
  let type = ''
  let out = ''
  let od = ''
  let usr = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'objds')
    usr = (await one('select gen_random_uuid() as id')).id
    const email = `objds-${Date.now()}@beacon.test`
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

    // A datasource with two rows.
    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [f.datasetId, f.branchId])).id
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      [f.datasetId, txn, JSON.stringify([{ name: 'pk', type: 'STRING' }])])
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'rows.parquet',2) returning id`, [f.datasetId, txn])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp()
        where id=$1`, [txn])
    const phys = (await one('select public.dataset_materialize($1,$2) as t', [f.datasetId, txn])).t
    await db.query(`insert into datasets.${phys} (_file, pk) values ($1,'A'),($1,'B')`, [file])

    const ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'objds','Obj ds',false) returning id`, [f.spaceId])).id
    type = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
      JSON.stringify({ api_name: 'ObjDsThing', label: 'Thing', ontology_id: ont,
        datasources: [{ dataset_id: f.datasetId, branch_id: f.branchId }] }),
      JSON.stringify([{ property_id: 'pk', display_name: 'Id', api_name: 'id', base_type: 'string',
        source: 'column', backing_column: 'pk', is_primary_key: true, is_title_key: true, required: true }]),
    ])).id
    await db.query('select public.save_working_state()')
    await db.query('select public.run_index_build(array[$1]::uuid[], true)', [type])

    // The output dataset the object dataset writes into.
    out = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'objds_out','objds_out') returning id`, [f.orgId, f.projectId])).id
    await db.query(`insert into public.dataset_branches (dataset_id, name) values ($1,'master')`, [out])
    od = (await one(
      `insert into public.object_datasets (object_type_id, dataset_id) values ($1,$2) returning id`,
      [type, out])).id
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('defaults to Periodic, the dialog\'s own value', async () => {
    expect((await one('select build_interval from public.object_datasets where id=$1', [od]))
      .build_interval).toBe('periodic')
    expect(await refused(db, () => db.query(
      `update public.object_datasets set build_interval='hourly' where id=$1`, [od])))
      .toContain('build_interval')
  })

  it('copies the merged state through a build job', async () => {
    const build = (await one('select public.run_object_dataset_build($1, true) as b', [od])).b
    expect(build).toBeTruthy()
    const job = await one(
      `select state, source_object_type_id, output_dataset_id, error
         from public.build_jobs where build_id=$1`, [build])
    expect(job.state, job.error ?? '').toBe('COMPLETED')
    // It reads a type and writes a dataset — both ends recorded on the job.
    expect(job.source_object_type_id).toBe(type)
    expect(job.output_dataset_id).toBe(out)
    expect((await one('select status from public.builds where id=$1', [build])).status).toBe('SUCCEEDED')

    // The rows are the index's, and the schema is the property API names.
    const p = (await one('select physical_table as t from public.datasets where id=$1', [out])).t
    expect(await count(`select count(*) n from datasets.${p}`)).toBe(2)
    const cols = (await db.query(
      `select column_name from information_schema.columns
        where table_schema='datasets' and table_name=$1 and column_name <> '_file'`, [p])).rows
    expect(cols.map((c) => (c as { column_name: string }).column_name)).toContain('id')
  })

  it('keeps only the latest snapshot', async () => {
    // "Historical transactions are constantly deleted and only the latest
    // snapshot is guaranteed to be available."
    await db.query('select public.run_object_dataset_build($1, true)', [od])
    await db.query('select public.run_object_dataset_build($1, true)', [od])
    expect(await count(
      'select count(*) n from public.dataset_transactions where dataset_id=$1', [out])).toBe(1)
  })

  it('is refused to someone who may not edit the type', async () => {
    const outsider = (await one('select gen_random_uuid() as id')).id
    const email = `objdsout-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [outsider, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [outsider, email, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: outsider, app_metadata: { role: 'member', org_id: f.orgId } })])
    const err = await refused(db, () =>
      db.query('select public.run_object_dataset_build($1, true)', [od]))
    expect(err).toBeTruthy()
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])
  })

  it('a job outputs a dataset from logic, or from a type, never both', async () => {
    // The three shapes are exclusive: authored SQL, an index, a materialization.
    const err = await refused(db, () => db.query(
      `insert into public.job_specs (output_dataset_id, source_object_type_id, logic_sql)
       values ($1,$2,'SELECT 1')`, [out, type]))
    expect(err).toContain('logic_matches_output')
  })

  it('the heartbeat builds due object datasets', async () => {
    const def = (await one(
      `select pg_get_functiondef('public.run_schedules(timestamptz)'::regprocedure) as d`)).d
    expect(def).toContain('run_due_object_datasets')
    // And it runs, rather than merely being mentioned — 514's lesson.
    expect(Number((await one('select public.run_due_object_datasets(now()) as n')).n))
      .toBeGreaterThanOrEqual(0)
  })
})
