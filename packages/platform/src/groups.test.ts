// Groups as the grant target, re-asked on every CI run.
//
// Migration 481 asserts this once, at the moment it landed. The durable
// questions: a role granted to a group reaches a member of a nested group
// (users-and-groups), membership expiration is honored at evaluation and the
// two group-level bounds constrain new memberships (manage-groups), a cycle
// refuses, and visibility stops at the group's organization.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, asAuthenticated, type Fixture } from './harness'

describe.skipIf(noDb)('groups hold roles', () => {
  let db: pg.Client
  let f: Fixture
  const u = { admin: '', member: '', third: '' }
  let flightOps = ''
  let opsLeads = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const claims = async (sub: string, role: string, org: string) =>
    db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub, app_metadata: { role, org_id: org } })])

  const myRole = async () =>
    (await one('select public.project_role($1) as r', [f.projectId])).r ?? null

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'groups481')
    for (const key of ['admin', 'member', 'third'] as const) {
      const id = (await one('select gen_random_uuid() as id')).id
      await db.query(
        `insert into auth.users (id, instance_id, aud, role, email)
         values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
        [id, `groups481-${key}-${Date.now()}@beacon.test`])
      u[key] = id
    }
    await claims(u.admin, 'admin', f.orgId)

    flightOps = (await one(
      `insert into public.groups (organization_id, name, created_by)
       values ($1,'Flight Ops',$2) returning id`, [f.orgId, u.admin])).id
    opsLeads = (await one(
      `insert into public.groups (organization_id, name, created_by)
       values ($1,'Ops Leads',$2) returning id`, [f.orgId, u.admin])).id
    // Ops Leads nests inside Flight Ops; the member sits two hops from the grant.
    await db.query(`insert into public.group_members (group_id, member_group_id) values ($1,$2)`,
      [flightOps, opsLeads])
    await db.query(`insert into public.group_members (group_id, member_user_id) values ($1,$2)`,
      [opsLeads, u.member])
    await db.query(
      `insert into public.project_role_grants (project_id, group_id, role, organization_id)
       values ($1,$2,'editor',$3)`, [f.projectId, flightOps, f.orgId])
  })
  afterAll(async () => { await rollback(db) })

  it('a role granted to a group reaches a member of a nested group', async () => {
    await claims(u.member, 'limited_access', f.orgId)
    expect(await myRole()).toBe('editor')
    await claims(u.admin, 'admin', f.orgId)
  })

  it('the creator is seeded with both administrative permissions', async () => {
    const r = await one(
      `select count(*) as n from public.group_permissions where group_id=$1 and user_id=$2`,
      [flightOps, u.admin])
    expect(Number(r.n)).toBe(2)
  })

  it('an expired membership grants nothing, without a sweeper', async () => {
    await db.query(
      `update public.group_members set expires_at = clock_timestamp() - interval '1 minute'
       where group_id=$1 and member_user_id=$2`, [opsLeads, u.member])
    await claims(u.member, 'limited_access', f.orgId)
    expect(await myRole()).toBeNull()
    await claims(u.admin, 'admin', f.orgId)
    await db.query(
      `update public.group_members set expires_at = null
       where group_id=$1 and member_user_id=$2`, [opsLeads, u.member])
  })

  it('a bounded group refuses permanent and over-long memberships', async () => {
    await db.query(
      `update public.groups set latest_expiration = clock_timestamp() + interval '1 day',
                                max_duration = interval '1 hour' where id=$1`, [opsLeads])
    const permanent = await refused(db, () => db.query(
      `insert into public.group_members (group_id, member_user_id) values ($1,$2)`,
      [opsLeads, u.third]))
    expect(permanent).toContain('Multipass:MembershipMustExpire')
    // Under Latest expiration (1 day) but past Maximum duration (1 hour):
    // "the most constraining property of the two".
    const overlong = await refused(db, () => db.query(
      `insert into public.group_members (group_id, member_user_id, expires_at)
       values ($1,$2, clock_timestamp() + interval '2 hours')`, [opsLeads, u.third]))
    expect(overlong).toContain('Multipass:MembershipOutlivesBound')
    await db.query(
      `insert into public.group_members (group_id, member_user_id, expires_at)
       values ($1,$2, clock_timestamp() + interval '30 minutes')`, [opsLeads, u.third])
    await db.query(`update public.groups set latest_expiration=null, max_duration=null where id=$1`,
      [opsLeads])
  })

  it('a membership cycle refuses', async () => {
    const err = await refused(db, () => db.query(
      `insert into public.group_members (group_id, member_group_id) values ($1,$2)`,
      [opsLeads, flightOps]))
    expect(err).toContain('Multipass:GroupCycle')
  })

  it('a grant names exactly one principal', async () => {
    const err = await refused(db, () => db.query(
      `insert into public.project_role_grants (project_id, user_id, group_id, role, organization_id)
       values ($1,$2,$3,'viewer',$4)`, [f.projectId, u.third, flightOps, f.orgId]))
    expect(err).toContain('one_principal')
  })

  it('a group ID is permanent', async () => {
    const err = await refused(db, () => db.query(
      `update public.groups set id = gen_random_uuid() where id=$1`, [opsLeads]))
    expect(err).toContain('Multipass:GroupIdPermanent')
  })

  it('visibility stops at the organization', async () => {
    const foreignOrg = (await one(
      `insert into public.organizations (name) values ('groups481-other') returning id`)).id
    await claims(u.third, 'admin', foreignOrg)
    const visible = await asAuthenticated(db, async () =>
      Number((await one('select count(*) as n from public.groups where id=$1', [flightOps])).n))
    expect(visible).toBe(0)
    await claims(u.admin, 'admin', f.orgId)
  })

  it('membership writes take a group permission the caller must hold', async () => {
    await claims(u.member, 'limited_access', f.orgId)
    const err = await asAuthenticated(db, async () => refused(db, () => db.query(
      `insert into public.group_members (group_id, member_user_id) values ($1,$2)`,
      [flightOps, u.member])))
    expect(err).toContain('row-level security')
    await claims(u.admin, 'admin', f.orgId)
  })
})
