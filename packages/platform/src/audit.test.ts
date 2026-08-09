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

  // Sign-in was broken for a day and every guard stayed green, because the
  // thing that broke it lived on `auth.users` — outside `public`, where no
  // audit of ours looked. The teardown dropped `profiles`; the trigger that
  // wrote to it survived, because a trigger is not a foreign key and nothing
  // cascades.
  //
  // This asks the question directly rather than through a proxy: the token
  // grant updates auth.users, so if that update raises, nobody can log in.
  it('lets a user sign in', async () => {
    await db.query('BEGIN')
    try {
      // What GoTrue does on grant. Rolled back — the assertion is that it runs.
      await db.query('update auth.users set last_sign_in_at = now()')
    } finally {
      await db.query('ROLLBACK')
    }
  })

  // The token hook runs on the sign-in path, so it is the same hazard as the
  // trigger that locked everyone out — a raise here is a lockout. These ask
  // whether it is safe to have switched on, for every account that exists.
  it('derives a token for every account without raising', async () => {
    // The assertion is that this completes. A raise here is a lockout, and it
    // must survive claims shaped in ways GoTrue does not usually send.
    const { rows } = await db.query(
      `select u.email,
              public.custom_access_token_hook(
                jsonb_build_object('user_id', u.id::text, 'claims', '{}'::jsonb))
                -> 'claims' -> 'app_metadata' ->> 'org_id' as derived
         from auth.users u`)
    expect((rows as unknown[]).length).toBeGreaterThan(0)
  })

  // An onboarded account must come out scoped. Not every account is onboarded —
  // one that never has been legitimately gets no organization, which is why
  // this asks about public.users rather than about auth.users.
  it('derives an organization for every onboarded account', async () => {
    const { rows } = await db.query(
      `select p.email from public.users p
        where public.custom_access_token_hook(
                jsonb_build_object('user_id', p.id::text, 'claims', '{}'::jsonb))
                -> 'claims' -> 'app_metadata' ->> 'org_id' is null`)
    expect((rows as { email: string }[]).map((r) => r.email)).toEqual([])
  })

  // Until the hook is switched on, the static claim is the only one there is.
  // While both exist they must agree, or flipping the switch silently re-scopes
  // somebody. When the static claim is finally stripped this becomes vacuous.
  it('derives the same organization the static claim already carries', async () => {
    const { rows } = await db.query(
      `select u.email from auth.users u
        where coalesce(u.raw_app_meta_data, '{}'::jsonb) ? 'org_id'
          and (u.raw_app_meta_data ->> 'org_id') is distinct from
              (public.custom_access_token_hook(
                 jsonb_build_object('user_id', u.id::text, 'claims', '{}'::jsonb))
                 -> 'claims' -> 'app_metadata' ->> 'org_id')`)
    expect((rows as { email: string }[]).map((r) => r.email)).toEqual([])
  })

  it('lets GoTrue call the token hook, and nobody else', async () => {
    const { rows } = await db.query(
      `select has_function_privilege('supabase_auth_admin',
                'public.custom_access_token_hook(jsonb)', 'EXECUTE') as gotrue,
              has_function_privilege('authenticated',
                'public.custom_access_token_hook(jsonb)', 'EXECUTE') as authed`)
    const r = (rows as { gotrue: boolean; authed: boolean }[])[0]
    // Without the grant, enabling the hook breaks sign-in for everyone.
    expect(r.gotrue).toBe(true)
    expect(r.authed).toBe(false)
  })

  // The invariant is a biconditional, not "everyone has an org". 430 asserted
  // the latter and that assertion is what handed two unonboarded accounts a
  // claim to an organization they have no record in.
  it('gives nobody a claim to an organization they have no record in', async () => {
    const { rows } = await db.query(
      `select a.email from auth.users a
        where (coalesce(a.raw_app_meta_data, '{}'::jsonb) ? 'hotel_id')
           or ((coalesce(a.raw_app_meta_data, '{}'::jsonb) ? 'org_id')
               and not exists (select 1 from public.users p
                                where p.id = a.id and p.organization_id is not null))`)
    expect((rows as { email: string }[]).map((r) => r.email)).toEqual([])
  })

  it('has an organization for every onboarded user', async () => {
    const { rows } = await db.query(
      'select email from public.users where organization_id is null')
    expect((rows as { email: string }[]).map((r) => r.email)).toEqual([])
  })

  it('has no trigger on auth.users', async () => {
    // Nothing of ours belongs there, and what did was invisible to every other
    // audit until it locked everyone out.
    const { rows } = await db.query(
      `select t.tgname from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace s on s.oid = c.relnamespace
        where s.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal`)
    expect((rows as { tgname: string }[]).map((r) => r.tgname)).toEqual([])
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
