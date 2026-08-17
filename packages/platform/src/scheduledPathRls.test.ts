// RLS on the path that runs most builds.
//
// The weekly adversary found that `run_schedules` (the pg_cron heartbeat),
// `drain_waiting_jobs` and `run_automations` are SECURITY DEFINER and swap
// `request.jwt.claims` without ever elevating the ROLE. Nested SECURITY INVOKER
// logic therefore runs as the function's owner.
//
// That only matters if the owner is exempt from RLS, and it is: `public` has 92
// tables with RLS and ZERO with `relforcerowsecurity`, all owned by `postgres`,
// which is also these functions' owner. Postgres exempts a table's owner from
// RLS unless FORCE is set. So RLS is off for every guarded table on the
// scheduled path — the normal path, not an edge case.
//
// 493 and 508 claim the opposite: "RLS applies to every input read... no
// superuser surface is reachable", and "It is SECURITY INVOKER, so its reads and
// writes are bounded by RLS". True of a direct user call only.
//
// WHY THIS FILE EXISTS RATHER THAN A FIX. The suite already has an
// `authenticated` pass, and it did not catch this, because it exercises the
// DIRECT-CALL path where the role really is `authenticated`. Nothing exercises
// the cron path as a real caller. That absence is the defect; the bypass is what
// it let through. So the first move is the missing test.
//
// The fix is NOT a blanket `SET LOCAL ROLE` at the top of each function: they
// legitimately need owner rights for their ledger writes (automation_runs, job
// and schedule state, object_type_indexes — see 549). It has to elevate around
// the nested USER logic only, which is a per-function boundary decision on the
// path that runs most builds.
//
// The two structural facts are asserted normally, because they are true today.
// The invariant is written with `it.fails`, which PASSES while the invariant is
// broken and starts FAILING the moment someone fixes it — at which point the
// `.fails` comes off and it becomes an ordinary guard. A defect that is
// executable outlives a defect that is described.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

const SCHEDULED = ['run_schedules', 'drain_waiting_jobs', 'run_automations']

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
    // closes. It is recorded so the fix is not attempted this way.
    expect(Number(rows[0].forced)).toBe(0)
  })

  it('runs the scheduled entry points as an owner of the guarded tables', async () => {
    const { rows } = await db.query(`
      SELECT p.proname, pg_get_userbyid(p.proowner) AS fn_owner, p.prosecdef
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = ANY($1)`, [SCHEDULED])
    expect(rows.length).toBe(SCHEDULED.length)

    const { rows: owners } = await db.query(`
      SELECT DISTINCT pg_get_userbyid(c.relowner) AS t_owner
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity`)
    const tableOwners = owners.map((o) => o.t_owner as string)

    for (const r of rows) {
      expect(r.prosecdef, `${r.proname} is SECURITY DEFINER`).toBe(true)
      expect(tableOwners, `${r.proname} runs as an owner of the guarded tables`)
        .toContain(r.fn_owner as string)
    }
  })

  // KNOWN BROKEN. Remove `.fails` when the elevation lands; it will start
  // failing here first, which is the point.
  it.fails('elevates the role around the logic it runs on a caller\'s behalf', async () => {
    const { rows } = await db.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) AS src
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = ANY($1)`, [SCHEDULED])

    const naked = rows
      .filter((r) => !/set\s+local\s+role/i.test(r.src as string))
      .map((r) => r.proname as string)

    // Swapping request.jwt.claims changes who the ROW POLICIES think you are.
    // It does not change the ROLE, and the role is what decides whether the
    // policies are consulted at all.
    expect(naked, 'scheduled functions that never elevate the role').toEqual([])
  })
})
