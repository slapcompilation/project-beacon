// Organization permissions: a role bundles workflows, granted to users or groups.
//
// The question this slice exists to answer is §4's: how does anyone see a
// principal in an organization they are not a member of? The page is explicit —
// "You will only be able to view groups for which you have `View group
// membership` permission on the group's Organization" — so the test is a caller
// in org A seeing a group in org B, and only through a grant.
//
// Run as `authenticated`. Connecting as the owner bypasses RLS, which is how two
// infinite recursions once sat in production while every guard stayed green.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

describe.skipIf(noDb)('organization permissions', () => {
  let db: pg.Client
  let orgA = ''
  let orgB = ''
  let usr = ''
  let groupInB = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const asUser = async (id: string, org: string) =>
    db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: id, app_metadata: { role: 'member', org_id: org } })])

  beforeAll(async () => {
    db = await connect()
    orgA = (await one(`insert into public.organizations (name) values ('perm-A') returning id`)).id
    orgB = (await one(`insert into public.organizations (name) values ('perm-B') returning id`)).id
    usr = (await one('select gen_random_uuid() as id')).id
    const email = `perm-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`, [usr, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, email, orgA])
    groupInB = (await one(
      `insert into public.groups (organization_id, name) values ($1,'Analysts in B') returning id`, [orgB])).id
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  const visibleGroups = async () => {
    await db.query('set local role authenticated')
    const n = Number((await one(
      'select count(*) as n from public.groups where id = $1', [groupInB])).n)
    await db.query('reset role')
    return n
  }

  it('a member of one organization cannot see another organization\'s group', async () => {
    await asUser(usr, orgA)
    expect(await visibleGroups()).toBe(0)
  })

  it('the view-group-membership workflow reaches across, and only through a grant', async () => {
    // A custom role in org B carrying the one workflow the page names. It is in
    // no default role on purpose: no page says which role grants it.
    const role = (await one(
      `insert into public.organization_roles (organization_id, api_name, display_name)
       values ($1,'group_viewer','Group viewer') returning id`, [orgB])).id
    await db.query(
      `insert into public.organization_role_workflows (role_id, workflow)
       values ($1,'view_group_membership')`, [role])

    // Still nothing: the role exists but nobody holds it.
    await asUser(usr, orgA)
    expect(await visibleGroups()).toBe(0)

    await db.query(
      `insert into public.organization_role_grants (organization_id, role_id, user_id)
       values ($1,$2,$3)`, [orgB, role, usr])
    await asUser(usr, orgA)
    expect(await visibleGroups()).toBe(1)
  })

  it('an administrator incorporates workflows it was never granted directly', async () => {
    // Fixtures are built with no claims: the previous case left this session
    // as a member of org A, and creating a user under those claims trips the
    // project-grant guard, which is nothing to do with what is being tested.
    await db.query(`select set_config('request.jwt.claims', '', true)`)
    const admin = (await one(
      `select id from public.organization_roles where api_name='organization_administrator'`)).id
    const other = (await one('select gen_random_uuid() as id')).id
    const email = `perm-admin-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`, [other, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [other, email, orgA])
    await db.query(
      `insert into public.organization_role_grants (organization_id, role_id, user_id)
       values ($1,$2,$3)`, [orgB, admin, other])

    // "Incorporate all workflows from other roles of that level" — held through
    // subsumption, not through a grant of the user-experience role.
    await asUser(other, orgA)
    const held = (await one(
      'select public.org_workflows($1) as w', [orgB])).w as unknown as string[]
    expect(held).toContain('manage_application_access')
    expect(held).toContain('view_group_membership')
  })
})
