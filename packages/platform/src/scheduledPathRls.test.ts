// RLS on the path that runs most builds.
//
// The weekly adversary found that the cron entries were SECURITY DEFINER
// owned by postgres — which owns every guarded table, none FORCE RLS — so
// swapping `request.jwt.claims` changed who the policies would think you are
// while the role guaranteed they were never consulted.
//
// The recorded fix ("elevate around the nested user logic" inside those
// functions) turned out to be impossible, learned by probe: Postgres refuses
// `cannot set parameter "role" within security-definer function`, and the
// refusal propagates down the whole SECDEF stack — set_config('role', …) and
// SET-clause wrappers included. 553 inverted instead: the entries are
// SECURITY INVOKER run as `beacon_runner` (a NOLOGIN member of authenticated
// — inherits its grants AND its policies), pg_cron drops role at the top
// level where SET ROLE is legal, and the cross-org scans and ledger writes
// elevate through SECURITY DEFINER helpers locked to the runner.
//
// The engine beneath (run_build, run_build_job, settle_build, apply_action)
// was already SECURITY INVOKER and web-proven as authenticated; only the
// wrappers ever put it into owner mode.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture } from './harness'

const ENTRIES = ['run_schedules', 'drain_waiting_jobs', 'run_automations', 'run_automation_retries']
const HELPERS = ['schedule_candidates', 'record_schedule_state', 'record_schedule_run',
  'waiting_job_candidates', 'fail_build_job', 'automation_candidates',
  'automation_effect_rows', 'record_automation_run', 'settle_automation_run',
  'record_automation_state', 'retry_candidates',
  // 622's new ledger writer. It shipped reachable by `authenticated` and
  // nothing failed, because it was not on this list — the more dangerous of
  // the two holes 623 closed. A ledger writer belongs here the day it exists.
  'record_automation_event',
  // The two retention deleters (641/642). Ledger-helper shape: DEFINER, the
  // runner holds EXECUTE, no table grant anywhere else — so each function is
  // the only door to its deletion.
  'expire_project_activity', 'expire_automation_history', 'run_audit_exports',
  'run_health_checks']

describe.skipIf(noDb)('the scheduled path and RLS', () => {
  let db: pg.Client
  beforeAll(async () => { db = await connect() })
  afterAll(async () => { await rollback(db) })

  it('leaves every RLS table owner-exempt, which is what makes the role matter', async () => {
    const { rows } = await db.query(`
      SELECT count(*) FILTER (WHERE relrowsecurity)      AS guarded,
             count(*) FILTER (WHERE relforcerowsecurity) AS forced
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'`)
    expect(Number(rows[0].guarded)).toBeGreaterThan(50)
    // Not an aspiration — FORCE would subject every SECURITY DEFINER helper to
    // RLS at once (provisioning, seeding, the indexer) and break more than it
    // closes. The fix ran the other way: the ENTRIES stopped being owner.
    expect(Number(rows[0].forced)).toBe(0)
  })

  it('keeps the entries invoker and the ledger helpers definer', async () => {
    const { rows } = await db.query(`
      SELECT p.proname, p.prosecdef,
             has_function_privilege('beacon_runner', p.oid, 'EXECUTE') AS runner_can,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = ANY($1)`, [[...ENTRIES, ...HELPERS]])
    expect(rows.length).toBe(ENTRIES.length + HELPERS.length)

    for (const r of rows) {
      if (ENTRIES.includes(r.proname as string)) {
        // An entry that elevates re-opens the bypass, and also re-poisons the
        // stack: no role change is possible beneath a SECURITY DEFINER frame.
        expect(r.prosecdef, `${r.proname} must be SECURITY INVOKER`).toBe(false)
        expect(r.runner_can, `${r.proname} runs as the runner`).toBe(true)
      } else {
        expect(r.prosecdef, `${r.proname} must be SECURITY DEFINER`).toBe(true)
        expect(r.runner_can, `${r.proname} is the runner's`).toBe(true)
        // A ledger writer reachable by authenticated is the forge 549 closed.
        expect(r.auth_can, `${r.proname} is not an api`).toBe(false)
      }
    }
  })

  it('points the minute hand through the runner', async () => {
    const { rows } = await db.query(
      `SELECT command FROM cron.job WHERE jobname = 'beacon-run-schedules'`)
    const command = (rows[0] as { command: string }).command
    expect(command).toMatch(/^\s*SET ROLE beacon_runner;/)
    for (const call of ['run_schedules', 'drain_waiting_jobs']) {
      expect(command).toContain(call)
    }
  })

  it('subjects the scheduled path to the policies a caller gets', async () => {
    // Two organizations exist; a runner impersonating org A sees only A. This
    // is the executed form of the invariant that used to be `it.fails` — RLS
    // engages on the scheduled path because the role is no longer the owner.
    const a = await fixture(db, 'sched_rls_a')
    await fixture(db, 'sched_rls_b')

    await db.query('SAVEPOINT runner_probe')
    await db.query('SET LOCAL ROLE beacon_runner')
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: '00000000-0000-0000-0000-000000000553',
        app_metadata: { role: 'admin', org_id: a.orgId } })])
    const { rows } = await db.query(
      `SELECT count(*) AS n FROM public.datasets WHERE api_name LIKE 'sched_rls_%'`)
    await db.query('RESET ROLE')
    await db.query('ROLLBACK TO SAVEPOINT runner_probe')
    expect(Number(rows[0].n)).toBe(1)

    // And the heartbeat itself runs end to end as the runner — the entries,
    // the helpers, the grants — rather than being proven reachable by grep.
    await db.query('SAVEPOINT heartbeat')
    await db.query('SET LOCAL ROLE beacon_runner')
    const ran = await db.query(`SELECT public.run_schedules(clock_timestamp()) AS n`)
    const drained = await db.query(`SELECT public.drain_waiting_jobs() AS n`)
    await db.query('RESET ROLE')
    await db.query('ROLLBACK TO SAVEPOINT heartbeat')
    expect(Number(ran.rows[0].n)).toBeGreaterThanOrEqual(0)
    expect(Number(drained.rows[0].n)).toBeGreaterThanOrEqual(0)
  })
})
