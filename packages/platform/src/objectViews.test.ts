// The Object View (718): standard-first resolution, the detach moment, the
// fixed tab id, and access composed from the type — asked on every run, and
// the read asked as the authenticated role.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, asAuthenticated, type Fixture } from './harness'

describe.skipIf(noDb)('an object view is a logical child of its type', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let type = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'objview')
    // A real session has a real user; a project-homed type's visibility
    // composes through it.
    const usr = (await one('select gen_random_uuid() as id')).id
    const email = `objview-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, email, f.orgId])
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, usr, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'objview','Obj view',false) returning id`, [f.spaceId])).id
    type = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'ViewThing','View thing') returning id`, [ont, f.projectId])).id
  })
  afterAll(async () => { await rollback(db) })

  it('a new type resolves to NO configured view — the standard view is the landing', async () => {
    expect((await one('select public.object_view_for($1) as v', [type])).v).toBeNull()
  })

  it('authoring is the detach: the first row makes the configured view the default', async () => {
    const mod = (await one(
      `insert into public.workshop_modules (organization_id, project_id, name)
       values ($1,$2,'View module') returning id`, [f.orgId, f.projectId])).id
    const v = (await one(
      `insert into public.object_views (object_type_id) values ($1) returning id`, [type])).id
    await db.query(
      `insert into public.object_view_tabs (view_id, tab_id, title, position, kind, module_id)
       values ($1,'overview','Overview',0,'managed_workshop',$2)`, [v, mod])
    expect((await one('select public.object_view_for($1) as v', [type])).v).toBe(v)
    // The tab insert bumped the version the header chip shows.
    expect(Number((await one('select version from public.object_views where id=$1', [v])).version)).toBe(2)
  })

  it('the tab id is generated on creation and cannot be edited', async () => {
    const err = await refused(db, () => db.query(
      `update public.object_view_tabs set tab_id='renamed'
        where view_id = public.object_view_for($1)`, [type]))
    expect(err).toContain('TabIdIsFixed')
  })

  it('reads compose the ontology, as the authenticated role', async () => {
    // The claims carry the fixture's org, which is in the ontology's space —
    // so the composed auth_in_ontology read admits the view.
    const n = await asAuthenticated(db, async () =>
      Number((await one(
        `select count(*) as n from public.object_views where object_type_id=$1`, [type])).n))
    expect(n).toBe(1)
  })

  it('one configured view per type; the second is refused', async () => {
    const err = await refused(db, () => db.query(
      `insert into public.object_views (object_type_id) values ($1)`, [type]))
    expect(err).toContain('duplicate key')
  })
})
