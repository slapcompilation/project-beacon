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
//   - `authenticated` or a platform hook role may EXECUTE it (so a client or
//     GoTrue can call it) — NOT `service_role`, which retains EXECUTE on
//     almost everything and is therefore evidence of nothing: the cron entry
//     points and search_index_payload carry the identical {postgres,
//     service_role} ACL, so the grant cannot tell a deliberate edge-function
//     endpoint from an un-wired runner,
//   - an edge function's source names it (the caller for service_role-only
//     endpoints — search_index_payload's evidence used to be a leftover anon
//     grant from the default-ACL stamp, which was the bug 550/551 removed,
//     not a caller),
//   - another function's body names it,
//   - a trigger fires it,
//   - pg_cron runs it.
//
// `anon` is deliberately absent since 551: nothing we own may be executable by
// anon at all — anonSurface.test.ts owns that invariant — so an anon grant is
// evidence of a bug, never of a caller.
//
// Everything else is a runner nobody runs. There is deliberately no allowlist:
// "Wanting an allowlist is the signal to index instead" (CLAUDE.md), and the
// caller *is* the index — custom_access_token_hook says GoTrue with its
// supabase_auth_admin grant, and search-index/index.ts says so in source.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

/** Every edge function's source, one haystack: a `.rpc('name')` or any other
 *  mention there is a caller outside Postgres that no catalog row records. */
function edgeSources(): string {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/functions')
  const parts: string[] = []
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.ts')) parts.push(fs.readFileSync(p, 'utf8'))
    }
  }
  walk(root)
  return parts.join('\n')
}

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
         -- service_role is deliberately absent: it can execute nearly
         -- everything, so including it made the whole check vacuous. Proved by
         -- un-wiring run_automations and watching this pass anyway.
         and not has_function_privilege('supabase_auth_admin', f.oid, 'EXECUTE')
         -- Its own definition contains its name once; more means a caller.
         and (length(b.all_defs) - length(replace(b.all_defs, f.proname || '(', '')))
             / length(f.proname || '(') <= 1
         and c.all_cmds not like '%' || f.proname || '%'
         and g.names not like '%' || f.proname || '%'
         and $1 not like '%' || f.proname || '%'
       order by 1`, [edgeSources()])

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
