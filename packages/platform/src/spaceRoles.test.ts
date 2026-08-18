// Space permissions — a role is a bundle of workflows, granted to users or
// groups. The same mechanism 540 built at the Organization, one level up.
//
// 554 asserts this once at land time. The durable questions: the three
// published defaults exist and only the one whose card is expanded carries
// workflows; the predicate answers for a grant reached through a group as well
// as directly; a custom role of one space cannot be granted on another; and a
// Space Administrator subsumes.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused } from './harness'

const PUBLISHED = ['contributor', 'project_templates_administrator', 'space_administrator']

describe.skipIf(noDb)('space roles', () => {
  let db: pg.Client
  let space = ''
  let org = ''
  let user = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const claimsFor = async (u: string) => {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: u, app_metadata: { role: 'admin', org_id: org } })])
  }

  beforeAll(async () => {
    db = await connect()
    org = (await one(`insert into public.organizations (name) values ('sr554') returning id`)).id
    space = (await one(`insert into public.spaces (name) values ('sr554') returning id`)).id
    await db.query(
      `insert into public.space_organizations (space_id, organization_id) values ($1,$2)`,
      [space, org])
    user = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
               'authenticated', 'authenticated', 'sr554@beacon.test') returning id`)).id
    await claimsFor(user)
  })
  afterAll(async () => { await rollback(db) })

  it('carries the three published defaults, available to every space', async () => {
    const { rows } = await db.query(
      `select api_name, display_name, description from public.space_roles
        where space_id is null order by api_name`)
    expect(rows.map((r) => (r as { api_name: string }).api_name).sort()).toEqual([...PUBLISHED].sort())
    for (const r of rows as { display_name: string; description: string }[]) {
      expect(r.display_name.length).toBeGreaterThan(0)
      expect(r.description, 'each default role carries its published line').toBeTruthy()
    }
  })

  it('seeds workflows only for the role whose card is expanded', async () => {
    // Contributor's five are published in space-permissions.png; the other two
    // cards are collapsed ("Grants 1 workflow", "Grants 61 workflows") and
    // their contents are a listAvailableRoles response, not documentation.
    const { rows } = await db.query(`
      select r.api_name, count(w.workflow)::int as n
        from public.space_roles r
        left join public.space_role_workflows w on w.role_id = r.id
       where r.space_id is null
       group by r.api_name order by r.api_name`)
    const byName = Object.fromEntries(
      (rows as { api_name: string; n: number }[]).map((r) => [r.api_name, r.n]))
    expect(byName.contributor).toBe(5)
    expect(byName.project_templates_administrator).toBe(0)
    expect(byName.space_administrator).toBe(0)
  })

  it('answers the predicate for a role granted directly', async () => {
    const role = (await one(
      `select id from public.space_roles where space_id is null and api_name = 'contributor'`)).id
    await db.query(
      `insert into public.space_role_grants (space_id, role_id, user_id) values ($1,$2,$3)`,
      [space, role, user])

    const got = (await one(`select public.space_workflows($1) as w`, [space]))
      .w as unknown as string[]
    expect(got).toContain('curate_portfolios_within_the_space')
    expect(got).toContain('manage_portfolios_within_the_space')
    expect(got).toContain('create_project')
    // Nothing it was not granted, including our own grant-management token.
    expect(got).not.toContain('manage_space_permissions')
  })

  it('reaches a role granted to a group the caller is in', async () => {
    // The Manage privileges rail invites "Add a user or group…", so a grant
    // that only works for a bare user id is half the mechanism.
    const other = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
               'authenticated', 'authenticated', 'sr554b@beacon.test') returning id`)).id
    const grp = (await one(
      `insert into public.groups (organization_id, name) values ($1,'sr554grp') returning id`,
      [org])).id
    await db.query(
      `insert into public.group_members (group_id, member_user_id) values ($1,$2)`, [grp, other])
    const role = (await one(
      `select id from public.space_roles where space_id is null and api_name = 'contributor'`)).id
    await db.query(
      `insert into public.space_role_grants (space_id, role_id, group_id) values ($1,$2,$3)`,
      [space, role, grp])

    await claimsFor(other)
    const got = (await one(`select public.space_workflows($1) as w`, [space]))
      .w as unknown as string[]
    await claimsFor(user)
    expect(got).toContain('create_project')
  })

  it('gives a Space Administrator everything, because it has full control', async () => {
    const admin = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
               'authenticated', 'authenticated', 'sr554admin@beacon.test') returning id`)).id
    const role = (await one(
      `select id from public.space_roles where space_id is null and api_name = 'space_administrator'`)).id
    await db.query(
      `insert into public.space_role_grants (space_id, role_id, user_id) values ($1,$2,$3)`,
      [space, role, admin])

    await claimsFor(admin)
    const got = (await one(`select public.space_workflows($1) as w`, [space]))
      .w as unknown as string[]
    await claimsFor(user)
    // It holds Contributor's workflows without being granted Contributor.
    expect(got).toContain('curate_portfolios_within_the_space')
  })

  it('refuses a custom role of another space', async () => {
    const otherSpace = (await one(
      `insert into public.spaces (name) values ('sr554other') returning id`)).id
    const role = (await one(
      `insert into public.space_roles (space_id, api_name, display_name)
       values ($1,'custom_thing','Custom Thing') returning id`, [otherSpace])).id
    const err = await refused(db, () => db.query(
      `insert into public.space_role_grants (space_id, role_id, user_id) values ($1,$2,$3)`,
      [space, role, user]))
    expect(err).toContain('Permissions:RoleNotOnThisSpace')
  })

  it('keeps a default role unfrozen and lets a custom one freeze', async () => {
    // "Custom roles are frozen, meaning that new workflows added to default
    // roles will not automatically apply to custom roles."
    const err = await refused(db, () => db.query(
      `insert into public.space_roles (space_id, api_name, display_name, frozen)
       values (null,'bad_default','Bad Default',true)`))
    expect(err).toBeTruthy()
  })
})
