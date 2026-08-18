// The organization as a marking, re-asked on every CI run.
//
// Migration 490 asserts this once at landing. The durable questions: a new
// organization is provisioned its backing marking; primary membership
// satisfies it and only it; guests — users or groups — cross; and the policy
// compiler binds organization_marking_ids to the derived membership instead
// of failing closed.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('an organization is a marking', () => {
  let db: pg.Client
  let f: Fixture
  let homeMarking = ''
  let awayOrg = ''
  let awayMarking = ''
  let visitor = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const claims = async (sub: string, org: string) =>
    db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub, app_metadata: { role: 'admin', org_id: org } })])

  const satisfies = async (marking: string) =>
    (await one('select public.satisfies_markings(array[$1]::uuid[]) as ok', [marking])).ok

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'enroll490')
    homeMarking = (await one(
      'select marking_id from public.organizations where id=$1', [f.orgId])).marking_id
    awayOrg = (await one(
      `insert into public.organizations (name) values ('enroll490-away') returning id`)).id
    awayMarking = (await one(
      'select marking_id from public.organizations where id=$1', [awayOrg])).marking_id
    visitor = (await one('select gen_random_uuid() as id')).id
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [visitor, `enroll490-${Date.now()}@beacon.test`])
    await db.query(
      `insert into public.users (id, email, role, organization_id) values ($1,$2,'admin',$3)`,
      [visitor, `enroll490-${Date.now()}@beacon.test`, awayOrg])
  })
  afterAll(async () => { await rollback(db) })

  it('every organization carries a backing marking from birth', async () => {
    expect(homeMarking).toBeTruthy()
    expect(awayMarking).toBeTruthy()
    const r = await one(
      `select count(*) as n from public.organizations where marking_id is null`)
    expect(Number(r.n)).toBe(0)
  })

  it('primary membership satisfies its own marking and no other', async () => {
    await claims(visitor, awayOrg)
    expect(await satisfies(awayMarking)).toBe(true)
    expect(await satisfies(homeMarking)).toBe(false)
  })

  it('a guest user crosses — primary and guest', async () => {
    await db.query(
      `insert into public.organization_guests (organization_id, user_id) values ($1,$2)`,
      [f.orgId, visitor])
    await claims(visitor, awayOrg)
    expect(await satisfies(homeMarking)).toBe(true)
    const ids = (await one('select public.auth_org_marking_ids() as m')).m
    expect(ids).toContain(homeMarking)
    expect(ids).toContain(awayMarking)
    await db.query(
      `delete from public.organization_guests where organization_id=$1 and user_id=$2`,
      [f.orgId, visitor])
  })

  it('a guest group carries its members across', async () => {
    const grp = (await one(
      `insert into public.groups (organization_id, name, created_by)
       values ($1,'Enroll Visitors 490',$2) returning id`, [awayOrg, visitor])).id
    await db.query(`insert into public.group_members (group_id, member_user_id) values ($1,$2)`,
      [grp, visitor])
    await db.query(
      `insert into public.organization_guests (organization_id, group_id) values ($1,$2)`,
      [f.orgId, grp])
    await claims(visitor, awayOrg)
    expect(await satisfies(homeMarking)).toBe(true)
  })

  // CORRECTED with 558/559. This asserted that guest membership ALONE let the
  // visitor read the host's project, which is the mandatory half standing in
  // for the whole formula. `security/checking-permissions` requires both
  // clauses — organization and markings, AND "one or more roles" — and
  // `cross-organization-collaboration` grants a guest their roles as a
  // separate, explicit act ("We need to grant both Sunrise Airlines and Sky
  // Industries administrators roles on the shared space"). An organization is
  // an access *requirement*: it gates, it never grants.
  //
  // So the guest now needs a role, and the read-only half — which was always
  // the point of the case — is unchanged.
  const asGuest = async <T>(fn: () => Promise<T>): Promise<T> => {
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: visitor, app_metadata: {
        role: 'admin', org_id: awayOrg, guest_org_ids: [f.orgId] } })])
    await db.query('savepoint guest_probe')
    await db.query('set local role authenticated')
    try {
      return await fn()
    } finally {
      await db.query('reset role')
      await db.query('rollback to savepoint guest_probe')
    }
  }

  it('a guest with no role reads nothing of the host org (558)', async () => {
    const seen = await asGuest(async () => Number(
      (await one('select count(*) as n from public.projects where id=$1', [f.projectId])).n))
    expect(seen).toBe(0)
  })

  it('a guest views the host org read-only — projects, files, users, groups (492)', async () => {
    // The grant is made in the HOST organization, which is the shape 559 had
    // to fix: project_role restated the org test as the caller's PRIMARY
    // organization, so a guest could not hold a grant made to them.
    await db.query(
      `insert into public.project_role_grants (project_id, user_id, role, organization_id)
       values ($1,$2,'viewer',$3)`, [f.projectId, visitor, f.orgId])

    const seen = await asGuest(async () => {
      const p = Number((await one('select count(*) as n from public.projects where id=$1', [f.projectId])).n)
      const d = Number((await one('select count(*) as n from public.datasets where id=$1', [f.datasetId])).n)
      const wrote = await db.query(`update public.projects set name='stolen' where id=$1`, [f.projectId])
      return { p, d, wrote: wrote.rowCount ?? 0 }
    })
    expect(seen.p).toBe(1)
    expect(seen.d).toBe(1)
    expect(seen.wrote).toBe(0)
  })

  it('the token hook mints group-guest orgs into the claims (492)', async () => {
    const hooked = (await one(
      `select public.custom_access_token_hook(jsonb_build_object('user_id', $1::text, 'claims', '{}'::jsonb)) as h`,
      [visitor])).h as unknown as { claims: { app_metadata: { guest_org_ids: string[] } } }
    // The visitor rides the guest group from the previous test.
    expect(hooked.claims.app_metadata.guest_org_ids).toContain(f.orgId)
  })

  it('the compiler binds organization_marking_ids instead of failing closed', async () => {
    const r = await one(
      `select public.granular_policy_sql('{"match":"all","rules":[
         {"left":{"user_attribute":"organization_marking_ids"},"comparison":"intersects","right":{"value":["x"]}}]}'::jsonb,
         '[]'::jsonb, 'd') as sql`)
    expect(r.sql).toContain('auth_org_marking_ids()')
  })
})
