// Someone has to grant the first space role.
//
// 566 fixed a deadlock that made 555's portfolios unusable: creating one needs
// `manage_portfolios_within_the_space`, granting the role that confers it needs
// `manage_space_permissions`, and production held zero grants — so no principal
// held any workflow and neither door could be opened from inside.
//
// The durable question is the chain, not the policy: an administrator can grant
// the first role, and holding it is enough to use the feature. A permission
// model that cannot be entered is indistinguishable from one that refuses
// everything.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused } from './harness'

describe.skipIf(noDb)('bootstrapping a space', () => {
  let db: pg.Client
  let org = ''
  let space = ''
  let admin = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const claims = async (sub: string, o: string, role = 'admin') =>
    db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub, app_metadata: { role, org_id: o } })])

  const asAuthenticated = async <T>(fn: () => Promise<T>): Promise<T> => {
    await db.query('set local role authenticated')
    try { return await fn() } finally { await db.query('reset role') }
  }

  beforeAll(async () => {
    db = await connect()
    org = (await one(`insert into public.organizations (name) values ('boot566') returning id`)).id
    space = (await one(`insert into public.spaces (name) values ('boot566') returning id`)).id
    await db.query(
      `insert into public.space_organizations (space_id, organization_id) values ($1,$2)`,
      [space, org])
    admin = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(),'00000000-0000-0000-0000-000000000000',
               'authenticated','authenticated','boot566@beacon.test') returning id`)).id
    await claims(admin, org)
  })
  afterAll(async () => { await rollback(db) })

  const spaceAdminRole = async () => (await one(
    `select id from public.space_roles where space_id is null and api_name='space_administrator'`)).id

  it('lets an administrator grant the first role, holding none themselves', async () => {
    // The deadlock: before 566 this was refused, because granting needed a
    // workflow that only granting could confer.
    const held = (await one(`select public.space_workflows($1) as w`, [space])).w as unknown as string[]
    expect(held, 'the administrator starts with nothing').toEqual([])

    await asAuthenticated(async () => db.query(
      `insert into public.space_role_grants (space_id, role_id, user_id) values ($1,$2,$3)`,
      [space, await spaceAdminRole(), admin]))

    const after = (await one(`select public.space_workflows($1) as w`, [space])).w as unknown as string[]
    expect(after).toContain('manage_portfolios_within_the_space')
  })

  it('makes the feature that grant unlocks actually usable', async () => {
    // 555 shipped portfolios and nobody could create one. The chain has to end
    // somewhere real, or the bootstrap is theatre.
    await asAuthenticated(async () => db.query(
      `insert into public.portfolios (space_id, name) values ($1,'Bootstrapped')`, [space]))
    const n = await one(
      `select count(*)::int as n from public.portfolios where space_id = $1`, [space])
    expect(Number(n.n)).toBe(1)
  })

  it('does not let an administrator of another organization in', async () => {
    // The arm is scoped to organizations the space actually serves, so the
    // bootstrap is not a skeleton key.
    const stranger = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(),'00000000-0000-0000-0000-000000000000',
               'authenticated','authenticated','boot566b@beacon.test') returning id`)).id
    const otherOrg = (await one(
      `insert into public.organizations (name) values ('boot566-other') returning id`)).id
    await claims(stranger, otherOrg)

    await db.query('set local role authenticated')
    const err = await refused(db, () => db.query(
      `insert into public.space_role_grants (space_id, role_id, user_id) values ($1,$2,$3)`,
      [space, spaceAdminRole(), stranger]))
    await db.query('reset role')
    expect(err).toBeTruthy()

    await claims(admin, org)
  })

  it('still refuses a plain member holding no role', async () => {
    const member = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(),'00000000-0000-0000-0000-000000000000',
               'authenticated','authenticated','boot566c@beacon.test') returning id`)).id
    await claims(member, org, 'limited_access')

    await db.query('set local role authenticated')
    const err = await refused(db, () => db.query(
      `insert into public.space_role_grants (space_id, role_id, user_id) values ($1,$2,$3)`,
      [space, spaceAdminRole(), member]))
    await db.query('reset role')
    expect(err).toBeTruthy()

    await claims(admin, org)
  })
})
