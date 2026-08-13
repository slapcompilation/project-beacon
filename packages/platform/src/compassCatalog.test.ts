// The catalog layer, re-asked on every CI run.
//
// Migration 499 asserts this once at landing. The durable questions: every
// user carries a personal project visible only to them (even against the
// admin write policy's read half — the restrictive-policy lesson), tags
// categorize without gating, collections curate admin-only, and Promoted
// takes the curator stand-in.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, asAuthenticated, type Fixture } from './harness'

describe.skipIf(noDb)('the catalog layer', () => {
  let db: pg.Client
  let f: Fixture
  let admin = ''
  let member = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const claims = async (sub: string, role: string) =>
    db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub, app_metadata: { role, org_id: f.orgId } })])

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'catalog499')
    for (const key of ['admin', 'member'] as const) {
      const id = (await one('select gen_random_uuid() as id')).id
      await db.query(
        `insert into auth.users (id, instance_id, aud, role, email)
         values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
        [id, `catalog499-${key}-${Date.now()}@beacon.test`])
      await db.query(`insert into public.users (id, email, role, organization_id)
                      values ($1,$2,'admin',$3)`,
        [id, `catalog499-${key}-${Date.now()}@beacon.test`, f.orgId])
      if (key === 'admin') admin = id; else member = id
    }
    await claims(admin, 'admin')
  })
  afterAll(async () => { await rollback(db) })

  it('every user carries a personal project, visible only to them', async () => {
    const mine = (await one(
      'select id from public.projects where personal_of=$1', [member])).id
    expect(mine).toBeTruthy()
    // The admin write policy grants read too — the restrictive policy must
    // still hide it. Checked as the real role, since owner bypasses RLS.
    await claims(admin, 'admin')
    const visible = await asAuthenticated(db, async () =>
      Number((await one('select count(*) as n from public.projects where id=$1', [mine])).n))
    expect(visible).toBe(0)
    await claims(member, 'limited_access')
    const own = await asAuthenticated(db, async () =>
      Number((await one('select count(*) as n from public.projects where id=$1', [mine])).n))
    expect(own).toBe(1)
    await claims(admin, 'admin')
  })

  it('tags categorize without gating', async () => {
    const cat = (await one(
      `insert into public.tag_categories (name) values ('Refresh 499') returning id`)).id
    const tg = (await one(
      `insert into public.tags (category_id, name) values ($1,'daily') returning id`, [cat])).id
    await db.query(
      `insert into public.resource_tags (tag_id, resource_kind, resource_id)
       values ($1,'dataset',$2)`, [tg, f.datasetId])
    const n = Number((await one(
      `select count(*) as n from public.resource_tags where resource_id=$1`, [f.datasetId])).n)
    expect(n).toBe(1)
    // Tagging changed nothing about who reads the dataset.
    const readable = Number((await one(
      `select count(*) as n from public.datasets where id=$1`, [f.datasetId])).n)
    expect(readable).toBe(1)
  })

  it('collections curate admin-only, read org-wide', async () => {
    const col = (await one(
      `insert into public.collections (name) values ('Curated 499') returning id`)).id
    await db.query(
      `insert into public.collection_resources (collection_id, resource_kind, resource_id)
       values ($1,'dataset',$2)`, [col, f.datasetId])
    await claims(member, 'limited_access')
    const seen = await asAuthenticated(db, async () =>
      Number((await one('select count(*) as n from public.collections where id=$1', [col])).n))
    expect(seen).toBe(1)
    const err = await asAuthenticated(db, async () => refused(db, () =>
      db.query(`insert into public.collections (name) values ('Rogue 499')`)))
    expect(err).toContain('row-level security')
    await claims(admin, 'admin')
  })

  it('Promoted takes the curator stand-in', async () => {
    await claims(member, 'limited_access')
    const err = await refused(db, () =>
      db.query(`update public.datasets set promoted=true where id=$1`, [f.datasetId]))
    expect(err).toContain('Compass:PromotionTakesACurator')
    await claims(admin, 'admin')
    await db.query(`update public.datasets set promoted=true where id=$1`, [f.datasetId])
    const p = (await one('select promoted from public.datasets where id=$1', [f.datasetId])).promoted
    expect(p).toBe(true)
  })
})
