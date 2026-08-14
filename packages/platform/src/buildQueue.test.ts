// A job waits for the build that rewrites its inputs.
//
// The sentence, from data-integration/builds.md's Build resolution:
//   "Detects if other builds are in progress that would change the inputs
//    into the build. If so, the build may be *queued* and wait for the other
//    build to complete."
//
// And where the waiting lives, from the API reference — Build.status is
// `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED` with no QUEUED, while
// Job.jobStatus carries `WAITING` and Job.startedTime is "The time this job
// started waiting for the dependencies to be resolved". So a queued build is
// a RUNNING build whose jobs are WAITING.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('a contended job waits', () => {
  let db: pg.Client
  let f: Fixture
  let mid = ''
  let leaf = ''
  let usr = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'buildq507')
    usr = (await one('select gen_random_uuid() as id')).id
    const email = `buildq507-${Date.now()}@beacon.test`
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

    // raw → mid → leaf, all materialized: a JobSpec refuses to publish over
    // an input that has no schema and no physical table.
    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [f.datasetId, f.branchId])).id
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      [f.datasetId, txn, JSON.stringify([
        { name: 'city', type: 'STRING' }, { name: 'fare', type: 'INTEGER' }])])
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'rides.parquet',3) returning id`, [f.datasetId, txn])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp()
        where id=$1`, [txn])
    const phys = (await one('select public.dataset_materialize($1,$2) as t', [f.datasetId, txn])).t
    await db.query(
      `insert into datasets.${phys} (_file, city, fare) values
        ($1,'ATH',10),($1,'ATH',30),($1,'SKG',20)`, [file])

    const mk = async (api: string, input: string) => {
      const id = (await one(
        `insert into public.datasets (organization_id, project_id, api_name, name)
         values ($1,$2,$3,$3) returning id`, [f.orgId, f.projectId, api])).id
      await db.query(`insert into public.dataset_branches (dataset_id, name) values ($1,'master')`, [id])
      await db.query(`insert into public.dataset_inputs (dataset_id, input_dataset_id) values ($1,$2)`,
        [id, input])
      return id
    }
    mid = await mk('buildq507_mid', f.datasetId)
    await db.query(
      `insert into public.job_specs (output_dataset_id, logic_sql)
       values ($1, 'SELECT city, sum(fare)::bigint AS total FROM buildq507_ds GROUP BY city')`, [mid])
    // Build it for real, so mid has a schema and a table for leaf to read.
    await db.query('select public.run_build(array[$1]::uuid[], false, $2)', [mid, 'manual'])

    leaf = await mk('buildq507_leaf', mid)
    await db.query(
      `insert into public.job_specs (output_dataset_id, logic_sql)
       values ($1, 'SELECT city FROM buildq507_mid')`, [leaf])
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('names the unfinished build whose output is an input of the job', async () => {
    const b = (await one(
      `insert into public.builds (organization_id, requested_by) values ($1,$2) returning id`,
      [f.orgId, usr])).id
    const upstream = (await one(
      'select id from public.job_specs where output_dataset_id=$1', [mid])).id
    await db.query(
      `insert into public.build_jobs (build_id, job_spec_id, output_dataset_id, state)
       values ($1,$2,$3,'RUNNING')`, [b, upstream, mid])

    const b2 = (await one(
      `insert into public.builds (organization_id, requested_by) values ($1,$2) returning id`,
      [f.orgId, usr])).id
    const downstream = (await one(
      'select id from public.job_specs where output_dataset_id=$1', [leaf])).id
    const mine = (await one(
      `insert into public.build_jobs (build_id, job_spec_id, output_dataset_id)
       values ($1,$2,$3) returning id`, [b2, downstream, leaf])).id

    expect((await one('select public.job_blocked_by($1) as b', [mine])).b).toBe(b)

    // The build's own job is never its own blocker.
    const sibling = (await one(
      'select id from public.build_jobs where build_id=$1 limit 1', [b])).id
    expect((await one('select public.job_blocked_by($1) as b', [sibling])).b).toBeNull()

    // When the other build finishes, the block lifts — no sweeper involved,
    // the predicate simply stops matching.
    await db.query(`update public.build_jobs set state='COMPLETED' where build_id=$1`, [b])
    await db.query(`update public.builds set status='SUCCEEDED' where id=$1`, [b])
    expect((await one('select public.job_blocked_by($1) as b', [mine])).b).toBeNull()
  })

  it('leaves the job WAITING and the build RUNNING, then the heartbeat advances it', async () => {
    // An in-flight build of mid, so a build of leaf is contended.
    const blocker = (await one(
      `insert into public.builds (organization_id, requested_by) values ($1,$2) returning id`,
      [f.orgId, usr])).id
    const upstream = (await one(
      'select id from public.job_specs where output_dataset_id=$1', [mid])).id
    await db.query(
      `insert into public.build_jobs (build_id, job_spec_id, output_dataset_id, state)
       values ($1,$2,$3,'RUNNING')`, [blocker, upstream, mid])

    const b = (await one(
      'select public.run_build(array[$1]::uuid[], false, $2) as b', [leaf, 'manual'])).b

    // "the build may be queued and wait for the other build to complete"
    expect((await one(
      'select state from public.build_jobs where build_id=$1', [b])).state).toBe('WAITING')
    // No QUEUED status exists: a queued build is a RUNNING one.
    expect((await one('select status from public.builds where id=$1', [b])).status).toBe('RUNNING')

    // Nothing advances while the blocker is in flight.
    expect(Number((await one('select public.drain_waiting_jobs() as n')).n)).toBe(0)
    expect((await one(
      'select state from public.build_jobs where build_id=$1', [b])).state).toBe('WAITING')

    // The blocker finishes; the heartbeat picks the job up and settles the build.
    await db.query(`update public.build_jobs set state='COMPLETED' where build_id=$1`, [blocker])
    await db.query(`update public.builds set status='SUCCEEDED' where id=$1`, [blocker])
    expect(Number((await one('select public.drain_waiting_jobs() as n')).n)).toBeGreaterThan(0)

    expect((await one(
      'select state, error from public.build_jobs where build_id=$1', [b])).state).toBe('COMPLETED')
    expect((await one('select status from public.builds where id=$1', [b])).status).toBe('SUCCEEDED')
  })

  it('speaks the published vocabulary and refuses the invented one', async () => {
    const values = (await one(
      `select pg_get_constraintdef(oid) as d from pg_constraint
        where conname = 'builds_status_check'`)).d
    for (const token of ['RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED']) {
      expect(values).toContain(token)
    }
    // COMPLETED and ABORTED are the JOB tokens; a build never carries them.
    expect(values).not.toContain('COMPLETED')
    expect(values).not.toContain('ABORTED')

    // Through `refused`, which savepoints: a raw catch leaves the transaction
    // aborted and poisons every test after it.
    const err = await refused(db, () =>
      db.query(`select public.run_build(array[$1]::uuid[], false, 'single')`, [leaf]))
    expect(err).toContain('Builds:UnknownBuildType')
  })

  // 507 split resolution from execution so a waiting job could be advanced
  // later, and left the permission check with resolution — so the job function
  // ran a JobSpec for a caller who never passed it. 508 moved the check onto
  // the job, where it holds whichever door is used.
  it('refuses a job the caller may not build, even called directly', async () => {
    const outsider = (await one('select gen_random_uuid() as id')).id
    const email = `buildq507-out-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [outsider, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [outsider, email, f.orgId])

    const b = (await one(
      `insert into public.builds (organization_id, requested_by) values ($1,$2) returning id`,
      [f.orgId, usr])).id
    const spec = (await one(
      'select id from public.job_specs where output_dataset_id=$1', [leaf])).id
    const job = (await one(
      `insert into public.build_jobs (build_id, job_spec_id, output_dataset_id)
       values ($1,$2,$3) returning id`, [b, spec, leaf])).id

    // A plain member with no grant on the project. Not an admin: an org admin
    // can write any dataset in its organization, which is can_write_dataset's
    // own rule and not something this test should route around.
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: outsider, app_metadata: { role: 'member', org_id: f.orgId } })])
    const err = await refused(db, () => db.query('select public.run_build_job($1)', [job]))
    expect(err).toContain('Builds:NotAuthorized')

    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])
    expect((await one('select state from public.build_jobs where id=$1', [job])).state).toBe('WAITING')
  })
})
