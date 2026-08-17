// The tokenless caller can reach nothing, and stays that way.
//
// Foundry's API has no anonymous surface — "you must include an API token ...
// in each API call" (api/v1/general-overview-authentication) — and `anon` is
// precisely the caller with no token. 550 closed the SECURITY DEFINER stock,
// 551 closed the invoker stock and the two minting mechanisms (CREATE
// FUNCTION's PUBLIC grant, Supabase's default-ACL anon stamp).
//
// Applied migrations run once, so their assertions prove the moment they
// landed. This proves it still holds: a signature change re-mints a function's
// ACL (the 528 regression), and a future ALTER DEFAULT PRIVILEGES could put
// the stamp back. Extension-owned functions are out of scope — pgvector's
// operators are type machinery, not endpoints.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused } from './harness'

describe.skipIf(noDb)('the anon surface', () => {
  let db: pg.Client
  beforeAll(async () => { db = await connect() })
  afterAll(async () => { await rollback(db) })

  it('has no function we own in public executable by anon', async () => {
    const { rows } = await db.query(`
      SELECT p.oid::regprocedure::text AS sig
        FROM pg_proc p
        JOIN pg_namespace ns ON ns.oid = p.pronamespace
       WHERE ns.nspname = 'public'
         AND has_function_privilege('anon', p.oid, 'EXECUTE')
         AND pg_has_role(current_user, p.proowner, 'USAGE')
         AND NOT EXISTS (SELECT 1 FROM pg_depend d
                          WHERE d.classid = 'pg_proc'::regclass
                            AND d.objid = p.oid AND d.deptype = 'e')`)
    expect(rows.map((r) => r.sig)).toEqual([])
  })

  it('refuses an anonymous call at the door', async () => {
    await db.query('SAVEPOINT anon_probe')
    await db.query('SET LOCAL ROLE anon')
    const err = await refused(db, () => db.query('SELECT public.default_ontology()'))
    await db.query('RESET ROLE')
    await db.query('ROLLBACK TO SAVEPOINT anon_probe')
    expect(err).toMatch(/permission denied/)
  })

  it('no longer stamps anon onto a function born today', async () => {
    // Executes the defaults path inside the suite's rolled-back transaction:
    // the per-schema/global split in 551 is exactly what a catalog read of
    // pg_default_acl gets wrong.
    await db.query(`CREATE FUNCTION public.probe_anon_surface() RETURNS int LANGUAGE sql AS 'SELECT 1'`)
    const { rows } = await db.query(`
      SELECT has_function_privilege('anon', 'public.probe_anon_surface()', 'EXECUTE') AS anon_can,
             has_function_privilege('authenticated', 'public.probe_anon_surface()', 'EXECUTE') AS auth_can`)
    expect(rows[0].anon_can).toBe(false)
    expect(rows[0].auth_can).toBe(true)
  })
})
