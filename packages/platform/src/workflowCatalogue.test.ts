// A workflow exists before a role carries it.
//
// 563 built the catalogue after §4's reading found two live policies testing
// workflows that no role carried — so the policies could never grant. The
// durable question is the class, not the two instances: **every workflow a
// policy tests must be catalogued**, or that policy is dead on arrival.
//
// That is the test nobody had, and it is why the defect survived two
// migrations that each reasoned about it correctly.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused } from './harness'

describe.skipIf(noDb)('the workflow catalogue', () => {
  let db: pg.Client
  beforeAll(async () => { db = await connect() })
  afterAll(async () => { await rollback(db) })

  it('catalogues every workflow any role carries', async () => {
    const { rows } = await db.query(`
      SELECT w.workflow FROM public.organization_role_workflows w
       WHERE NOT EXISTS (SELECT 1 FROM public.workflows c WHERE c.api_name = w.workflow)
      UNION
      SELECT w.workflow FROM public.space_role_workflows w
       WHERE NOT EXISTS (SELECT 1 FROM public.workflows c WHERE c.api_name = w.workflow)`)
    expect(rows.map((r) => r.workflow)).toEqual([])
  })

  it('catalogues every workflow a policy tests', async () => {
    // THE ONE THAT MATTERS. A policy testing an uncatalogued workflow can
    // never grant, and nothing else would notice: the policy is syntactically
    // fine, the token matches the format CHECK, and every migration assertion
    // about it passes.
    const { rows } = await db.query(`
      SELECT DISTINCT m[1] AS token
        FROM pg_policy pol
        CROSS JOIN LATERAL regexp_matches(
          coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' ||
          coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), ''),
          '_workflow\\([^,]+,\\s*''([a-z_]+)''', 'g') AS m`)
    const tested = rows.map((r) => r.token as string)
    expect(tested.length, 'the sweep found no workflow tests at all — check the pattern')
      .toBeGreaterThan(0)

    const { rows: known } = await db.query(`SELECT api_name FROM public.workflows`)
    const catalogue = new Set(known.map((r) => r.api_name as string))
    expect(tested.filter((t) => !catalogue.has(t))).toEqual([])
  })

  it('refuses a workflow that is not catalogued', async () => {
    const role = (await db.query(
      `select id from public.organization_roles
        where organization_id is null and api_name = 'organization_administrator'`)).rows[0] as { id: string }
    const err = await refused(db, () => db.query(
      `insert into public.organization_role_workflows (role_id, workflow)
       values ($1,'manage_platfrom_version')`, [role.id]))
    expect(err).toContain('Permissions:UnknownWorkflow')
  })

  it('keeps each level to its own workflows', async () => {
    const role = (await db.query(
      `select id from public.organization_roles
        where organization_id is null and api_name = 'organization_administrator'`)).rows[0] as { id: string }
    const err = await refused(db, () => db.query(
      `insert into public.organization_role_workflows (role_id, workflow)
       values ($1,'create_project')`, [role.id]))
    expect(err).toContain('Permissions:WorkflowWrongScope')
  })

  it('leaves the two orphans selectable but ungranted', async () => {
    // Catalogued so a custom role can be composed from them; carried by no
    // default role, because no page says which role grants either. 540 refused
    // to invent that assignment and 563 did not overturn it.
    for (const [token, table] of [
      ['view_group_membership', 'organization_role_workflows'],
      ['manage_space_permissions', 'space_role_workflows'],
    ]) {
      const { rows: cat } = await db.query(
        `select 1 from public.workflows where api_name = $1`, [token])
      expect(cat.length, `${token} is catalogued`).toBe(1)
      const { rows: held } = await db.query(
        `select 1 from public.${table} where workflow = $1`, [token])
      expect(held.length, `${token} is carried by no role`).toBe(0)
    }
  })

  it('lets a custom role be composed from the catalogue', async () => {
    // The mechanism the page describes — "define custom roles… by selecting
    // individual workflows" — and the reason the catalogue is the fix rather
    // than seeding an orphan into some default role.
    const org = (await db.query(
      `insert into public.organizations (name) values ('wfcat') returning id`)).rows[0] as { id: string }
    const role = (await db.query(
      `insert into public.organization_roles (organization_id, api_name, display_name)
       values ($1,'group_watcher','Group Watcher') returning id`, [org.id])).rows[0] as { id: string }
    await db.query(
      `insert into public.organization_role_workflows (role_id, workflow)
       values ($1,'view_group_membership')`, [role.id])

    const { rows } = await db.query(
      `select count(*)::int as n from public.organization_role_workflows
        where role_id = $1 and workflow = 'view_group_membership'`, [role.id])
    expect((rows[0] as { n: number }).n).toBe(1)
  })
})
