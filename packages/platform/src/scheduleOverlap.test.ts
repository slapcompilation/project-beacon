// Two defaults the drift sweep found we had silently inverted or lacked.
//
// `create-schedule` states one: "By default, a schedule does not start a new run
// while another run of the same schedule is in progress." `advanced-settings.png`
// confirms it from the other side — six unchecked checkboxes under Advanced
// options, one of them **Allow overlapping runs**. Ours built unconditionally.
//
// `condition-time` grew the other: "You can add multiple cron expressions to a
// single time condition." Ours took exactly one.
//
// Both live here rather than in their migrations because applied migrations run
// once — an assertion inside 572 proves the change landed, and this proves it
// still holds.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('a schedule does not overlap itself unless told to', () => {
  let db: pg.Client
  let f: Fixture
  let owner = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'overlap572')
    owner = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(),'00000000-0000-0000-0000-000000000000',
               'authenticated','authenticated','overlap572@beacon.test') returning id`)).id
    await db.query(
      `insert into public.users (id, organization_id, email, role)
       values ($1,$2,'overlap572@beacon.test','owner')`, [owner, f.orgId])
  })
  afterAll(async () => { await rollback(db) })

  const schedule = async (name: string, allowOverlap = false) => (await one(
    `insert into public.schedules
       (organization_id, name, target_dataset_ids, trigger, updated_by, allow_overlapping_runs)
     values ($1,$2,array[]::uuid[],
             '{"type":"time","cron":"* * * * *","timezone":"UTC"}'::jsonb,$3,$4)
     returning id`, [f.orgId, name, owner, allowOverlap])).id

  it('defaults the setting off, which is the page\'s default', async () => {
    const s = await schedule('overlap-default')
    const row = await one(
      `select allow_overlapping_runs from public.schedules where id = $1`, [s])
    expect(row.allow_overlapping_runs).toBe(false)
  })

  it('counts a RUNNING build as in flight, and every terminal one as not', async () => {
    const s = await schedule('overlap-inflight')
    const inFlight = async () => (await one(
      `select public.schedule_run_in_flight($1) as x`, [s])).x

    expect(await inFlight(), 'a schedule with no runs').toBe(false)

    const build = (await one(
      `insert into public.builds (organization_id, status, requested_by)
       values ($1,'RUNNING',$2) returning id`, [f.orgId, owner])).id
    await db.query(
      `insert into public.schedule_runs (schedule_id, outcome, build_id)
       values ($1,'Succeeded',$2)`, [s, build])
    expect(await inFlight(), 'a RUNNING build').toBe(true)

    // The terminal three by name. Getting this list wrong is how a schedule
    // wedges forever — and `builds.status` speaks the API vocabulary (506),
    // not the job one.
    for (const status of ['SUCCEEDED', 'FAILED', 'CANCELED']) {
      await db.query(`update public.builds set status = $2 where id = $1`, [build, status])
      expect(await inFlight(), `a ${status} build`).toBe(false)
    }
  })

  it('records the skip as Ignored and keeps what the trigger observed', async () => {
    // The subtlety worth a test: `record_schedule_run` clears trigger_state,
    // because "an event trigger remains satisfied … until the entire trigger is
    // satisfied and the schedule is run". A suppressed attempt never ran, so
    // its events are still owed a build.
    const s = await schedule('overlap-skip')
    await db.query(
      `update public.schedules set trigger_state = '{"observed":["d1"]}'::jsonb,
              last_run_at = null where id = $1`, [s])

    await db.query(`select public.record_schedule_skip($1)`, [s])

    const run = await one(
      `select outcome, build_id, error from public.schedule_runs where schedule_id = $1`, [s])
    expect(run.outcome).toBe('Ignored')
    expect(run.build_id).toBeNull()
    expect(run.error).toContain('already in progress')

    const after = await one(
      `select trigger_state::text as st, last_run_at from public.schedules where id = $1`, [s])
    expect(after.st, 'the skip did not eat the observed events').toBe('{"observed": ["d1"]}')
    expect(after.last_run_at, 'a suppressed attempt is not a run').toBeNull()
  })

  it('lets a real run consume them, which is the opposite and on purpose', async () => {
    const s = await schedule('overlap-consume')
    await db.query(
      `update public.schedules set trigger_state = '{"observed":["d1"]}'::jsonb where id = $1`, [s])
    await db.query(`select public.record_schedule_run($1,'Succeeded',null,null,now())`, [s])
    const after = await one(
      `select trigger_state::text as st, last_run_at from public.schedules where id = $1`, [s])
    expect(after.st).toBe('{}')
    expect(after.last_run_at).not.toBeNull()
  })

  it('carries the flag through to the runner\'s candidate row', async () => {
    // The runner reads this column; if schedule_candidates() stopped returning
    // it the suppression would silently switch off.
    const s = await schedule('overlap-candidate', true)
    const row = await one(
      `select allow_overlapping_runs from public.schedule_candidates() where id = $1`, [s])
    expect(row.allow_overlapping_runs).toBe(true)
  })
})

describe.skipIf(noDb)('a time condition may carry several cron expressions', () => {
  let db: pg.Client
  let f: Fixture
  let owner = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const valid = async (condition: object) => (await one(
    `select public.automation_condition_valid($1::jsonb) as v`,
    [JSON.stringify(condition)])).v

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'crons573')
    owner = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(),'00000000-0000-0000-0000-000000000000',
               'authenticated','authenticated','crons573@beacon.test') returning id`)).id
  })
  afterAll(async () => { await rollback(db) })

  const automation = async (name: string, condition: object) => (await one(
    `insert into public.automations (project_id, display_name, owner_id, condition)
     values ($1,$2,$3,$4::jsonb) returning id`,
    [f.projectId, name, owner, JSON.stringify(condition)])).id

  it('takes one cron or a list, never both and never neither', async () => {
    expect(await valid({ type: 'time', cron: '0 9 * * *', timezone: 'UTC' })).toBe(true)
    expect(await valid({ type: 'time', crons: ['0 9 1,15 * *', '0 10 * * 5'], timezone: 'UTC' })).toBe(true)
    expect(await valid({ type: 'time', cron: '0 9 * * *', crons: ['0 10 * * 5'] })).toBe(false)
    expect(await valid({ type: 'time', timezone: 'UTC' })).toBe(false)
    expect(await valid({ type: 'time', crons: [] })).toBe(false)
    expect(await valid({ type: 'time', crons: [42] })).toBe(false)
    expect(await valid({ type: 'time', crons: ['  '] })).toBe(false)
  })

  it('fires on either arm of the page\'s own worked example', async () => {
    // "use `0 9 1,15 * *` to execute at 9:00 AM on the first and fifteenth of
    // every month. Add `0 10 * * 5` to execute at 10:00 AM every Friday."
    const a = await automation('worked-example', {
      type: 'time', timezone: 'UTC', crons: ['0 9 1,15 * *', '0 10 * * 5'],
    })
    const fires = async (at: string) => (await one(
      `select public.automation_fires($1,$2::timestamptz) as f`, [a, at])).f

    expect(await fires('2026-01-15 09:00:00+00'), 'the fifteenth at 9').not.toBeNull()
    expect(await fires('2026-01-09 10:00:00+00'), 'a Friday at 10').not.toBeNull()
    expect(await fires('2026-01-09 11:00:00+00'), 'an instant neither names').toBeNull()

    // The collision the page warns about — the first falling on a Friday —
    // reaches both expressions, each at its own time.
    expect(await fires('2026-05-01 09:00:00+00'), 'Friday the first at 9').not.toBeNull()
    expect(await fires('2026-05-01 10:00:00+00'), 'Friday the first at 10').not.toBeNull()
  })

  it('accepts an overlapping pair and fires it exactly once', async () => {
    // Foundry asks authors for non-overlapping expressions; we do not refuse an
    // overlap, because firing is once per tick on ANY match. This is the case
    // that makes a CHECK the wrong call rather than merely a hard one.
    const a = await automation('overlapping-pair', {
      type: 'time', timezone: 'UTC', crons: ['0 9 * * *', '0 9 1 * *'],
    })
    const fired = (await one(
      `select public.automation_fires($1,'2026-01-01 09:00:00+00'::timestamptz) as f`, [a])).f
    expect(fired).toEqual([])
  })

  it('still fires the single-cron shape existing rows carry', async () => {
    const a = await automation('single-cron', { type: 'time', timezone: 'UTC', cron: '0 9 * * *' })
    const fired = (await one(
      `select public.automation_fires($1,'2026-01-01 09:00:00+00'::timestamptz) as f`, [a])).f
    expect(fired).toEqual([])
  })

  it('leaves the schedule trigger grammar alone', async () => {
    // `triggers-reference` still says a time trigger is "defined using a cron
    // expression and a time zone" — singular. Two grammars, one page moved.
    const { rows } = await db.query(
      `select public.schedule_trigger_valid('{"type":"time","crons":["0 9 * * *"],"timezone":"UTC"}'::jsonb) as v`)
    expect((rows[0] as { v: boolean }).v).toBe(false)
  })
})
