// Access is a conjunction, re-asked on every CI run.
//
// `security/checking-permissions` publishes the formula, because the Check
// access panel has to state it to explain a verdict: access requires
// "Satisfying the Organization and Marking requirements" AND "Having one or
// more roles (directly, via a group, or a default role)".
//
// 558 put the second clause on the read path, 559 taught the predicate about
// guests, and 560 made it SECURITY DEFINER after discovering it answered
// differently depending on who asked. The durable questions are here.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('access is a conjunction', () => {
  let db: pg.Client
  let f: Fixture
  let holder = ''
  let stranger = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const claims = async (sub: string, org: string, role = 'limited_access', guests?: string[]) =>
    db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub, app_metadata: { role, org_id: org, ...(guests ? { guest_org_ids: guests } : {}) } })])

  /** Read as the role PostgREST connects as, then step back out. */
  const asAuthenticated = async <T>(fn: () => Promise<T>): Promise<T> => {
    await db.query('savepoint acc_probe')
    await db.query('set local role authenticated')
    try { return await fn() } finally {
      await db.query('reset role')
      await db.query('rollback to savepoint acc_probe')
    }
  }

  const visibleProjects = async () => Number(
    (await one('select count(*) as n from public.projects where id=$1', [f.projectId])).n)

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'access558')
    holder = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(),'00000000-0000-0000-0000-000000000000',
               'authenticated','authenticated','access558a@beacon.test') returning id`)).id
    stranger = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(),'00000000-0000-0000-0000-000000000000',
               'authenticated','authenticated','access558b@beacon.test') returning id`)).id
    await db.query(
      `insert into public.project_role_grants (project_id, user_id, role, organization_id)
       values ($1,$2,'viewer',$3)`, [f.projectId, holder, f.orgId])
  })
  afterAll(async () => { await rollback(db) })

  it('grants to the holder of a role', async () => {
    await claims(holder, f.orgId)
    expect(await asAuthenticated(visibleProjects)).toBe(1)
  })

  it('refuses an organization member holding no role', async () => {
    // The mandatory half passes — same organization, no markings — so the role
    // is the only variable. Before 558 this returned 1, because membership was
    // standing in for a grant.
    await claims(stranger, f.orgId)
    expect(await asAuthenticated(visibleProjects)).toBe(0)
  })

  it('answers the same to the owner and to the caller', async () => {
    // 560's bug: project_role is consulted BY a policy and reads an
    // RLS-guarded table, so as SECURITY INVOKER it answered `viewer` to the
    // owner and NULL to the caller. A predicate that disagrees with itself
    // depending on who asks cannot gate anything.
    await claims(holder, f.orgId)
    const asOwner = (await one('select public.project_role($1) as r', [f.projectId])).r
    const asCaller = await asAuthenticated(async () =>
      (await one('select public.project_role($1) as r', [f.projectId])).r)
    expect(asCaller).toBe(asOwner)
    expect(asCaller).toBe('viewer')
  })

  it('counts a grant made in a guest organization', async () => {
    // 559: the org test was restated as the caller's PRIMARY organization,
    // where the mandatory predicate beside it accepted guests too. Composed
    // now, so a grant made to a guest in the host organization is a grant.
    const away = (await one(
      `insert into public.organizations (name) values ('access558-away') returning id`)).id
    await claims(holder, away, 'limited_access', [f.orgId])
    expect(await asAuthenticated(visibleProjects)).toBe(1)
  })

  it('gives guest membership alone no role at all', async () => {
    // An organization is "an access requirement applied to Projects" — a gate,
    // never a grant. Roles are granted as a separate, explicit act.
    const away = (await one(
      `insert into public.organizations (name) values ('access558-away2') returning id`)).id
    await claims(stranger, away, 'limited_access', [f.orgId])
    expect(await asAuthenticated(visibleProjects)).toBe(0)
  })

  it('keeps the mandatory control a veto that no role overrides', async () => {
    // "mandatory controls, Organizations and Markings, will always prevent an
    // ineligible user from accessing a resource, regardless of the user's
    // role." The holder keeps their grant and loses the organization.
    const away = (await one(
      `insert into public.organizations (name) values ('access558-away3') returning id`)).id
    await claims(holder, away)
    expect(await asAuthenticated(visibleProjects)).toBe(0)
  })

  it('applies the same conjunction to datasets', async () => {
    await claims(stranger, f.orgId)
    const n = await asAuthenticated(async () => Number(
      (await one('select count(*) as n from public.datasets where id=$1', [f.datasetId])).n))
    expect(n).toBe(0)
  })
})
