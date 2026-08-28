// A link type declares its relationship, and the linter watches (717).
//
// Front door only: links stage through save_link_type and land through
// save_working_state, the way the surface drives them. The regression this
// pins: a link used to be born with backing_kind NULL and a silently
// defaulted cardinality, and ontology_violations() had no link arm to say so.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('a link type declares its relationship', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let a = ''
  let b = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'linkrel')
    const usr = (await one('select gen_random_uuid() as id')).id
    const email = `linkrel-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, email, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])

    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'linkrel','Link rel',false) returning id`, [f.spaceId])).id
    for (const [api, holder] of [['LinkRelA', 'a'], ['LinkRelB', 'b']] as const) {
      const t = (await one(
        `insert into public.object_types (ontology_id, project_id, api_name, label)
         values ($1,$2,$3,$3) returning id`, [ont, f.projectId, api])).id
      await db.query(
        `insert into public.object_type_properties
           (object_type_id, property_id, api_name, display_name, base_type, source,
            backing_column, is_primary_key, is_title_key, required)
         values ($1,'pk','id','Id','string','column','pk',true,true,true)`, [t])
      if (holder === 'a') a = t; else b = t
    }
  })
  afterAll(async () => { await rollback(db) })

  it('an undeclared relationship blocks the save, through the front door', async () => {
    await one(`select public.save_link_type($1::jsonb) as id`, [
      JSON.stringify({ source_object_type_id: a, target_object_type_id: b,
        api_name: 'bare_link', label: 'Bare link', ontology_id: ont,
        cardinality: 'many_to_many' })])
    const err = await refused(db, () => db.query('select public.save_working_state()'))
    expect(err).toContain('SaveBlockedByErrors')
    expect(err).toContain('must declare its relationship type')
    await db.query('select public.discard_working_state()')
  })

  it('a join table with a mismatched key type blocks the save; matched, it lands', async () => {
    const ds = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'linkrel_join','linkrel_join') returning id`, [f.orgId, f.projectId])).id
    const br = (await one(
      `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [ds])).id
    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [ds, br])).id
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      [ds, txn, JSON.stringify([
        { name: 'a_id', type: 'STRING' }, { name: 'b_num', type: 'INTEGER' },
        { name: 'b_id', type: 'STRING' }])])
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp()
        where id=$1`, [txn])

    // "If the type of the primary key property ... is not the same as the
    //  type of the column ... an error will prevent you from saving."
    await one(`select public.save_link_type($1::jsonb) as id`, [
      JSON.stringify({ source_object_type_id: a, target_object_type_id: b,
        api_name: 'joined_link', label: 'Joined link', ontology_id: ont,
        cardinality: 'many_to_many', backing_kind: 'join_table',
        dataset_id: ds, branch_id: br,
        source_key_column: 'a_id', target_key_column: 'b_num' })])
    const err = await refused(db, () => db.query('select public.save_working_state()'))
    expect(err).toContain('the types must be the same')
    await db.query('select public.discard_working_state()')

    await one(`select public.save_link_type($1::jsonb) as id`, [
      JSON.stringify({ source_object_type_id: a, target_object_type_id: b,
        api_name: 'joined_link', label: 'Joined link', ontology_id: ont,
        cardinality: 'many_to_many', backing_kind: 'join_table',
        dataset_id: ds, branch_id: br,
        source_key_column: 'a_id', target_key_column: 'b_id' })])
    await db.query('select public.save_working_state()')
    const row = await one(
      `select backing_kind, cardinality from public.link_types where api_name='joined_link'`)
    expect(row.backing_kind).toBe('join_table')
    expect(row.cardinality).toBe('many_to_many')
    const { rows } = await db.query(
      `select problem from public.link_type_problems() where subject='joined_link'`)
    expect(rows).toEqual([])
  })

  it('the pairing rule holds for the third kind too', async () => {
    // "Object-backed link types expand on many-to-one cardinality link types"
    const err = await refused(db, () => db.query(
      `insert into public.link_types (ontology_id, source_object_type_id, target_object_type_id,
         api_name, label, cardinality, backing_kind, backing_object_type_id)
       values ($1,$2,$3,'ob_bad','OB bad','many_to_many','object_backed',$3)`, [ont, a, b]))
    expect(err).toContain('link_types_object_backed_cardinality')
  })
})
