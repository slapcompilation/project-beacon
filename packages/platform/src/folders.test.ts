// The folder tree, re-asked on every CI run.
//
// Migration 497 asserts this once at landing. The durable questions: a
// folder organizes and never gates (roles unchanged, only markings flow the
// chain), placement stays inside the project, move-out takes Owner, and
// trash works by the chain with restore-in-place.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('the folder tree', () => {
  let db: pg.Client
  let f: Fixture
  let owner = ''
  let editor = ''
  let fa = ''
  let fb = ''
  let otherProject = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const claims = async (sub: string, role: string) =>
    db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub, app_metadata: { role, org_id: f.orgId } })])

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'folders497')
    for (const key of ['owner', 'editor'] as const) {
      const id = (await one('select gen_random_uuid() as id')).id
      await db.query(
        `insert into auth.users (id, instance_id, aud, role, email)
         values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
        [id, `folders497-${key}-${Date.now()}@beacon.test`])
      if (key === 'owner') owner = id; else editor = id
    }
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [owner, `f497o-${Date.now()}@beacon.test`, f.orgId])
    await claims(owner, 'admin')
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3), ($1,$4,'editor',$3)`,
      [f.projectId, owner, f.orgId, editor])
    otherProject = (await one(
      `insert into public.projects (organization_id, api_name, name)
       values ($1,'folders497b','Elsewhere') returning id`, [f.orgId])).id
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [otherProject, owner, f.orgId])

    fa = (await one(`insert into public.folders (project_id, name)
                     values ($1,'Ops') returning id`, [f.projectId])).id
    fb = (await one(`insert into public.folders (project_id, parent_folder_id, name)
                     values ($1,$2,'Reports') returning id`, [f.projectId, fa])).id
    await db.query(`update public.datasets set folder_id = $1 where id = $2`, [fb, f.datasetId])
  })
  afterAll(async () => { await rollback(db) })

  it('a marking on the ancestor folder reaches the file through the chain', async () => {
    const cat = (await one(
      `insert into public.marking_categories (name, category_type, organization_id)
       values ('F497T','conjunctive',$1) returning id`, [f.orgId])).id
    const mk = (await one(
      `insert into public.markings (category_id, name) values ($1,'F497T Restricted') returning id`, [cat])).id
    await db.query(`insert into public.marking_permissions (marking_id, user_id, permission)
                    values ($1,$2,'apply')`, [mk, owner])
    await db.query(`insert into public.marking_members (marking_id, user_id) values ($1,$2)`, [mk, owner])
    await db.query(`insert into public.resource_markings (marking_id, resource_kind, resource_id)
                    values ($1,'folder',$2)`, [mk, fa])
    const efm = (await one(`select public.effective_file_markings('dataset',$1) as m`, [f.datasetId])).m
    expect(efm).toContain(mk)
  })

  it('cycles and cross-project nesting refuse', async () => {
    expect(await refused(db, () =>
      db.query(`update public.folders set parent_folder_id=$1 where id=$2`, [fb, fa])))
      .toContain('Compass:FolderCycle')
    expect(await refused(db, () =>
      db.query(`insert into public.folders (project_id, parent_folder_id, name)
                values ($1,$2,'Stray')`, [otherProject, fa])))
      .toContain('Compass:FolderCrossesProjects')
    // A same-project mismatch refuses; a cross-project move instead lands
    // at the new root (the guard clears the stale placement).
    const strayFolder = (await one(
      `insert into public.folders (project_id, name) values ($1,'Their Ops') returning id`,
      [otherProject])).id
    expect(await refused(db, () =>
      db.query(`update public.datasets set folder_id=$1 where id=$2`,
        [strayFolder, f.datasetId])))
      .toContain('Compass:FolderInAnotherProject')
    await db.query('savepoint landing')
    await db.query(`update public.datasets set folder_id=$1, project_id=$2 where id=$3`,
      [fb, otherProject, f.datasetId])
    const landed = (await one('select folder_id from public.datasets where id=$1', [f.datasetId])).folder_id
    expect(landed).toBeNull()
    await db.query('rollback to savepoint landing')
  })

  it('moving out of a project takes Owner', async () => {
    await claims(editor, 'limited_access')
    const err = await refused(db, () =>
      db.query(`update public.datasets set project_id=$1 where id=$2`,
        [otherProject, f.datasetId]))
    expect(err).toContain('Compass:OnlyOwnersMoveOut')
    await claims(owner, 'admin')
  })

  it('trash works by the chain and restore is in place', async () => {
    await db.query(`update public.folders set trashed_at=clock_timestamp() where id=$1`, [fa])
    const inTrash = (await one('select public.folder_in_trash($1) as t', [fb])).t
    expect(inTrash).toBe(true)
    await db.query(`update public.folders set trashed_at=null where id=$1`, [fa])
    expect((await one('select public.folder_in_trash($1) as t', [fb])).t).toBe(false)
    const still = (await one('select folder_id from public.datasets where id=$1', [f.datasetId])).folder_id
    expect(still).toBe(fb)
  })
})
