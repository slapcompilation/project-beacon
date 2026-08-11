// Status coupling, as regression tests rather than migration assertions.
//
// 456 and 457 assert this once, at the moment each landed — applied migrations
// are immutable and run once. Re-asked on every CI run: a deprecation
// documents itself, and a link type follows its object types.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused } from './harness'

async function admin(db: pg.Client, org: string, email: string): Promise<string> {
  const id = (await db.query('select gen_random_uuid() as id')).rows[0].id as string
  await db.query(
    `insert into auth.users (id, instance_id, aud, role, email)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`,
    [id, email])
  await db.query(`insert into public.users (id, email, role, organization_id)
                  values ($1, $2, 'admin', $3)`, [id, email, org])
  await db.query(`select set_config('request.jwt.claims', $1, true)`,
    [JSON.stringify({ sub: id, app_metadata: { role: 'admin', org_id: org } })])
  return id
}

describe.skipIf(noDb)('status coupling', () => {
  let db: pg.Client
  let ta: string
  let tb: string
  let lt: string

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    const org = (await one(`insert into public.organizations (name) values ('status-regress') returning id`)).id
    await admin(db, org, `status-${Date.now()}@beacon.test`)
    await db.query('set local role authenticated')

    const space = (await one(`select public.create_space('Status regress') as id`)).id
    const ont = (await one(`insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
                            values ($1,'statusregress','Status regress',false) returning id`, [space])).id
    ta = (await one(`insert into public.object_types (ontology_id, api_name, label, status)
                     values ($1,'StatusA','A','active') returning id`, [ont])).id
    tb = (await one(`insert into public.object_types (ontology_id, api_name, label, status)
                     values ($1,'StatusB','B','active') returning id`, [ont])).id
    lt = (await one(`insert into public.link_types
                       (ontology_id, api_name, label, source_object_type_id, target_object_type_id, status)
                     values ($1,'status_ab','A to B',$2,$3,'active') returning id`, [ont, ta, tb])).id
  })
  afterAll(async () => { await rollback(db) })

  it('pulls the link along when an endpoint turns experimental', async () => {
    await db.query(`update public.object_types set status='experimental' where id = $1`, [ta])
    expect((await one('select status from public.link_types where id = $1', [lt])).status)
      .toBe('experimental')
  })

  it('refuses a link status the matrix forbids, by the printed name', async () => {
    expect(await refused(db, () =>
      db.query(`update public.link_types set status='active' where id = $1`, [lt])))
      .toContain('OntologyMetadata:ConflictBetweenLinkTypeStatusAndObjectTypeStatus')
  })

  it('carries the documentation down when an endpoint deprecates', async () => {
    await db.query(
      `update public.object_types set status='deprecated',
         deprecation_reason='Retired', deprecation_deadline=current_date + 30 where id = $1`, [ta])
    const row = await one(
      'select status, deprecation_reason from public.link_types where id = $1', [lt])
    expect(row.status).toBe('deprecated')
    expect(row.deprecation_reason).toBeTruthy()
  })

  // ── 458: properties have statuses, and pull their links ────────────────────
  it('pulls properties along when the type turns example, and starts new ones experimental', async () => {
    const pid = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source, backing_column)
       values ($1,'name','Name','name','string','column','name') returning id`, [tb])).id
    expect((await one('select status from public.object_type_properties where id = $1', [pid])).status)
      .toBe('experimental')
    await db.query(`update public.object_types set status='example' where id = $1`, [tb])
    expect((await one('select status from public.object_type_properties where id = $1', [pid])).status)
      .toBe('example')
    await db.query(`update public.object_types set status='active' where id = $1`, [tb])
  })

  // ── 460: promotion sets prominence ─────────────────────────────────────────
  it('sets visibility to prominent when an ontology owner promotes', async () => {
    const ont = (await one(`select ontology_id from public.object_types where id = $1`, [tb])).ontology_id
    const uid = (await one(`select auth.uid() as id`)).id
    await db.query(`insert into public.ontology_role_grants (ontology_id, user_id, role)
                    values ($1,$2,'owner')`, [ont, uid])
    const t = (await one(`insert into public.object_types (ontology_id, api_name, label, status, visibility)
                          values ($1,'StatusPromo','Promo','active','normal') returning id`, [ont])).id
    await db.query(`update public.object_types set status='promoted' where id = $1`, [t])
    expect((await one('select visibility from public.object_types where id = $1', [t])).visibility)
      .toBe('prominent')
  })

  it('lets a foreign-key property pull its link, and never cascades active', async () => {
    const t1 = (await one(`select ontology_id from public.object_types where id = $1`, [ta]))
    const c = (await one(`insert into public.object_types (ontology_id, api_name, label, status)
                          values ($1,'StatusC','C','active') returning id`, [t1.ontology_id])).id
    const d = (await one(`insert into public.object_types (ontology_id, api_name, label, status)
                          values ($1,'StatusD','D','active') returning id`, [t1.ontology_id])).id
    const fk = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, status)
       values ($1,'d_id','D Id','dId','string','column','d_id','active') returning id`, [c])).id
    const link = (await one(
      `insert into public.link_types
         (ontology_id, api_name, label, source_object_type_id, target_object_type_id,
          cardinality, backing_kind, backing_object_type_id, backing_column, status)
       values ($1,'status_cd','C to D',$2,$3,'many_to_one','foreign_key',$2,'d_id','active')
       returning id`, [t1.ontology_id, c, d])).id
    await db.query(`update public.object_type_properties set status='experimental' where id = $1`, [fk])
    expect((await one('select status from public.link_types where id = $1', [link])).status)
      .toBe('experimental')
    await db.query(`update public.object_type_properties set status='active' where id = $1`, [fk])
    expect((await one('select status from public.link_types where id = $1', [link])).status)
      .toBe('experimental')
  })
})
