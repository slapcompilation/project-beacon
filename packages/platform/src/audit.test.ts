// The audits. These are not tests, and the difference is the point.
//
// Every other file here builds a fixture, proves the code works against it, and
// rolls back. An audit builds nothing — it asks the database we actually have
// what is wrong with it. A fixture cannot answer that: the failures it catches
// are the ones that arrive with real data, after the code that created them was
// already proven correct.
//
// The rules live in SQL (`ontology_violations`, `rls_violations`) so the product
// can render them too. Foundry shows `❗4 errors` on an object type because the
// platform knows, not because a script ran overnight. This file is CI reading
// the same function the UI would.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, DB_URL } from './harness'
import { SSL } from '../../../scripts/db-url.mjs'

describe.skipIf(noDb)('the live system', () => {
  let db: pg.Client

  // No transaction. There is nothing to roll back, and wrapping reality in one
  // would only invite a fixture to creep in.
  beforeAll(async () => {
    db = new pg.Client({ connectionString: DB_URL as string, ssl: SSL })
    await db.connect()
  })
  afterAll(async () => { await db.end() })

  it('has a well-formed ontology', async () => {
    const { rows } = await db.query('select * from public.ontology_violations()')
    const found = rows as { object_type: string; subject: string; problem: string }[]
    expect(found.map((v) => `${v.object_type}/${v.subject}: ${v.problem}`)).toEqual([])
  })

  it('lets the role the product connects as read every table it guards', async () => {
    const { rows } = await db.query('select * from public.rls_violations()')
    const found = rows as { relation: string; problem: string }[]
    expect(found.map((v) => `${v.relation}: ${v.problem}`)).toEqual([])
  })

  // TRUNCATE is not subject to row-level security, so a policy cannot restrain
  // it. Supabase's default ACL granted it on all 49 public tables until 423.
  it('grants the app role nothing a policy cannot restrain', async () => {
    const { rows } = await db.query('select * from public.grant_violations()')
    const found = rows as { relation: string; grantee: string; privilege: string }[]
    expect(found.map((v) => `${v.grantee} has ${v.privilege} on ${v.relation}`)).toEqual([])
  })

  it('is guarding enough tables for that answer to mean anything', async () => {
    // A probe that silently covered nothing would report clean forever.
    const { rows: [c] } = await db.query(
      `select count(*)::int as n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
        where ns.nspname='public' and c.relkind='r' and c.relrowsecurity`)
    expect((c as { n: number }).n).toBeGreaterThan(20)
  })
})
