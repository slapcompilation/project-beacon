// Schedules, re-asked on every CI run.
//
// Migration 495 asserts this once at landing. The durable questions: the
// cron matcher against the page's own examples (including the documented
// dom/dow OR rule), an event trigger observing a baseline and firing only on
// change, the run consuming what was observed, Ignored meaning "a build was
// not created", and pause forgetting everything observed.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, commit, type Fixture } from './harness'

describe.skipIf(noDb)('schedules', () => {
  let db: pg.Client
  let f: Fixture
  let usr = ''
  let clean = ''
  let sched = ''
  let rawHead = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const tick = async (at: string) =>
    db.query('select public.run_schedules($1)', [at])

  const runs = async () =>
    (await db.query(
      `select outcome from public.schedule_runs where schedule_id=$1 order by ran_at`, [sched]))
      .rows.map((r) => (r as { outcome: string }).outcome)

  const matches = async (cron: string, at: string) =>
    (await one(`select public.cron_matches($1, 'UTC', $2::timestamptz) as m`, [cron, at])).m

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'sched495')
    usr = (await one('select gen_random_uuid() as id')).id
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, `sched495-${Date.now()}@beacon.test`])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, `sched495-${Date.now()}@beacon.test`, f.orgId])
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, usr, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])

    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [f.datasetId, f.branchId])).id
    rawHead = txn
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      [f.datasetId, txn, JSON.stringify([{ name: 'city', type: 'STRING' }])])
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'r.parquet',1) returning id`, [f.datasetId, txn])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [txn])
    const tbl = (await one('select public.dataset_materialize($1,$2) as t', [f.datasetId, txn])).t
    await db.query(`insert into datasets.${tbl} (_file, city) values ($1,'ATH')`, [file])

    clean = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'sched495_clean','clean') returning id`, [f.orgId, f.projectId])).id
    await db.query(`insert into public.dataset_branches (dataset_id, name) values ($1,'master')`, [clean])
    await db.query(`insert into public.dataset_inputs (dataset_id, input_dataset_id) values ($1,$2)`,
      [clean, f.datasetId])
    await db.query(
      `insert into public.job_specs (output_dataset_id, logic_sql)
       values ($1, 'SELECT city FROM sched495_ds')`, [clean])
    await db.query('select public.run_build($1::uuid[], false, $2)', [[clean], 'manual'])

    sched = (await one(
      `insert into public.schedules (name, target_dataset_ids, trigger)
       values ('sched495', array[$1]::uuid[], jsonb_build_object(
         'type','event','event','data_updated','dataset_id',$2::text))
       returning id`, [clean, f.datasetId])).id
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('the cron matcher speaks the page: instants, steps, and the dom/dow OR rule', async () => {
    expect(await matches('30 9 * * 1', '2026-08-10 09:30+00')).toBe(true)
    expect(await matches('30 9 * * 1', '2026-08-11 09:30+00')).toBe(false)
    expect(await matches('0 9-17/2 10 * *', '2026-08-10 11:00+00')).toBe(true)
    expect(await matches('0 9-17/2 10 * *', '2026-08-10 10:00+00')).toBe(false)
    // "the trigger will be satisfied if either matches"
    expect(await matches('0 9 20 * 4', '2026-08-13 09:00+00')).toBe(true)
  })

  it('an event observes a baseline, fires on change, and the run consumes it', async () => {
    await tick('2026-08-13 10:00+00')
    expect(await runs()).toEqual([])
    rawHead = await commit(db, f.datasetId, f.branchId, 'APPEND', ['s2.parquet'], rawHead)
    await tick('2026-08-13 10:01+00')
    expect(await runs()).toEqual(['Succeeded'])
    await tick('2026-08-13 10:02+00')
    expect(await runs()).toEqual(['Succeeded'])
  })

  it('a fresh target at the instant records Ignored — a build was not created', async () => {
    await db.query(
      `update public.schedules set trigger = '{"type":"time","cron":"15 6 * * *","timezone":"UTC"}'
        where id=$1`, [sched])
    await tick('2026-08-13 06:15+00')
    const all = await runs()
    expect(all[all.length - 1]).toBe('Ignored')
  })

  it('pause forgets what was observed', async () => {
    await db.query(
      `update public.schedules
          set trigger = jsonb_build_object('type','event','event','data_updated','dataset_id',$2::text)
        where id=$1`, [sched, f.datasetId])
    await tick('2026-08-13 07:00+00')
    rawHead = await commit(db, f.datasetId, f.branchId, 'APPEND', ['s3.parquet'], rawHead)
    await tick('2026-08-13 07:01+00') // observes AND runs
    await db.query(`update public.schedules set paused = true where id=$1`, [sched])
    const st = (await one(`select trigger_state as s from public.schedules where id=$1`, [sched])).s
    expect(st).toEqual({})
    const before = (await runs()).length
    await tick('2026-08-13 07:02+00')
    expect((await runs()).length).toBe(before)
  })
})
