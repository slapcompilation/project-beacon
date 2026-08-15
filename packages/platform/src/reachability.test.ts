// A runner nobody runs.
//
// Twice now a migration has built a function and left nothing calling it. 442
// built `index_object_type` and 513 had to wire it in — a year of staleness
// marked and never acted on. Then 517 built `run_automations` and 518 had to
// wire *that* in, two days after the first repair, while the lesson was in
// hand.
//
// Both times the migration looked finished: the function existed, its
// assertions passed, the tests exercised it directly. Nothing asked the only
// question that mattered — can anything reach this in production?
//
// `check:surfaces` asks exactly that of apps/web by walking the import graph
// from main.tsx, and `check:edge` asks it of supabase/functions. This asks it
// of the database.
//
// A function is REACHABLE if any of these is true:
//   - `authenticated`, `anon` or a platform hook role may EXECUTE it (so a
//     client, an edge function or GoTrue can call it) — NOT `service_role`,
//     which retains EXECUTE on almost everything and is therefore evidence of
//     nothing,
//   - another function's body names it,
//   - a trigger fires it,
//   - pg_cron runs it.
//
// Everything else is a runner nobody runs. There is deliberately no allowlist:
// "Wanting an allowlist is the signal to index instead" (CLAUDE.md), and the
// grant *is* the index — the two functions that looked dead on the first run,
// `custom_access_token_hook` and `search_index_payload`, are both called from
// outside Postgres and both say so with a grant.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

describe.skipIf(noDb)('every function is reachable', () => {
  let db: pg.Client

  beforeAll(async () => { db = await connect() })
  afterAll(async () => { await rollback(db) })

  it('no function exists that nothing can call', async () => {
    const { rows } = await db.query(`
      with fns as (
        select p.oid, p.proname, pg_get_functiondef(p.oid) as def
          from pg_proc p
         where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      ),
      bodies as (select string_agg(def, chr(10)) as all_defs from fns),
      crons  as (select coalesce(string_agg(command, chr(10)), '') as all_cmds from cron.job),
      tg     as (select coalesce(string_agg(p.proname, chr(10)), '') as names
                   from pg_trigger t join pg_proc p on p.oid = t.tgfoid
                  where not t.tgisinternal)
      select f.proname
        from fns f, bodies b, crons c, tg g
       where not has_function_privilege('authenticated', f.oid, 'EXECUTE')
         and not has_function_privilege('anon', f.oid, 'EXECUTE')
         -- service_role is deliberately absent: it can execute nearly
         -- everything, so including it made the whole check vacuous. Proved by
         -- un-wiring run_automations and watching this pass anyway.
         and not has_function_privilege('supabase_auth_admin', f.oid, 'EXECUTE')
         -- Its own definition contains its name once; more means a caller.
         and (length(b.all_defs) - length(replace(b.all_defs, f.proname || '(', '')))
             / length(f.proname || '(') <= 1
         and c.all_cmds not like '%' || f.proname || '%'
         and g.names not like '%' || f.proname || '%'
       order by 1`)

    expect(rows.map((r) => (r as { proname: string }).proname)).toEqual([])
  })

  // The heartbeat is the one caller that cannot be reached any other way: it
  // is a string in pg_cron, so a rename or a dropped call is invisible to the
  // compiler and to every other guard here.
  it('the minute hand still calls everything it is supposed to', async () => {
    const { rows } = await db.query(
      `select pg_get_functiondef('public.run_schedules(timestamptz)'::regprocedure) as d`)
    const body = (rows[0] as { d: string }).d
    for (const call of ['run_stale_indexes', 'run_due_object_datasets', 'run_automations']) {
      expect(body).toContain(call)
    }
    const cron = await db.query(
      `select command from cron.job where jobname = 'beacon-run-schedules'`)
    expect((cron.rows[0] as { command: string }).command).toContain('drain_waiting_jobs')
  })
})
