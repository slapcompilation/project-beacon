// The working state, as regression tests rather than migration assertions.
//
// 426 and 427 assert all of this once, at the moment they land, and then never
// again — applied migrations are immutable and run once. These are the same
// invariants asked on every CI run, plus the one a migration cannot ask at all:
// whether a SECOND user can see my unsaved work.
//
// Everything runs as `authenticated`. Connecting as the owner bypasses RLS, and
// "unsaved work is mine alone" is entirely an RLS claim.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused } from './harness'

/** A user with a JWT, so `auth.uid()` resolves to somebody. */
async function member(db: pg.Client, org: string, email: string): Promise<string> {
  const id = (await db.query('select gen_random_uuid() as id')).rows[0].id as string
  await db.query(
    `insert into auth.users (id, instance_id, aud, role, email)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`,
    [id, email])
  await db.query(`select set_config('request.jwt.claims', $1, true)`,
    [JSON.stringify({ sub: id, app_metadata: { role: 'admin', org_id: org } })])
  return id
}

describe.skipIf(noDb)('the working state', () => {
  let db: pg.Client
  let ont: string
  let type: string

  beforeAll(async () => {
    db = await connect()
    const one = async (sql: string, p: unknown[] = []) =>
      (await db.query(sql, p)).rows[0] as Record<string, string>

    const org = (await one(`insert into public.organizations (name) values ('ws-test') returning id`)).id
    await member(db, org, `ws-${Date.now()}@beacon.test`)
    await db.query(`set local role authenticated`)

    const space = (await one(`select public.create_space('WS test') as id`)).id
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label)
       values ($1,'wstest','WS test') returning id`, [space])).id
    const proj = (await one(
      `insert into public.projects (organization_id, space_id, api_name, name)
       values ($1,$2,'wstest','WS test') returning id`, [org, space])).id
    const ds = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'flights','flights') returning id`, [org, proj])).id
    const br = (await one(
      `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [ds])).id

    type = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
      JSON.stringify({
        api_name: 'Flight', label: 'Flight', ontology_id: ont,
        datasources: [{ dataset_id: ds, branch_id: br }],
      }),
      JSON.stringify([{
        property_id: 'flight_id', display_name: 'Flight Id', api_name: 'flightId',
        base_type: 'string', source: 'column', backing_column: 'flight_id',
        is_primary_key: true, is_title_key: true, required: true,
      }]),
    ])).id
    await db.query('select public.save_working_state()')
  })
  afterAll(async () => { await rollback(db) })

  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)

  it('holds an edit instead of writing it through', async () => {
    await db.query(`select public.stage_change('object_type', $1, '{"label":"Flight Leg"}'::jsonb)`, [type])
    const live = await db.query('select label from public.object_types where id = $1', [type])
    expect(live.rows[0].label).toBe('Flight')
    expect(await count('select count(*) n from public.working_state_changes')).toBe(1)
  })

  it('keeps one entry per resource, and the base of the first touch', async () => {
    await db.query(`select public.stage_change('object_type', $1, '{"description":"a leg"}'::jsonb)`, [type])
    expect(await count('select count(*) n from public.working_state_changes')).toBe(1)
    const { rows } = await db.query(
      `select base->>'label' as label from public.working_state_changes where resource_id = $1`, [type])
    // Re-reading the base would adopt someone else's save as my starting point.
    expect(rows[0].label).toBe('Flight')
  })

  // The Workshop rule: "auto-merges changes that do not overlap".
  it('does not call a field I never touched a conflict', async () => {
    await db.query(`update public.object_types set icon = 'airplane' where id = $1`, [type])
    expect(await count('select count(*) n from public.working_state_conflicts()')).toBe(0)
  })

  it('does call a field we both moved a conflict, and refuses the save', async () => {
    await db.query(`update public.object_types set label = 'Sector' where id = $1`, [type])
    expect(await count('select count(*) n from public.working_state_conflicts()')).toBe(1)
    // A savepoint, or the failed save poisons the suite's transaction.
    const why = await refused(db, () => db.query('select public.save_working_state()'))
    expect(why).toMatch(/StaleWorkingState/)
    await db.query(`update public.object_types set label = 'Flight' where id = $1`, [type])
  })

  it('applies the save, bumps the version and clears the state', async () => {
    const before = await count('select version n from public.ontologies where id = $1', [ont])
    expect(await count('select public.save_working_state() n')).toBe(1)
    const live = await db.query('select label, icon from public.object_types where id = $1', [type])
    expect(live.rows[0].label).toBe('Flight Leg')
    // The save must not touch a field it was never given.
    expect(live.rows[0].icon).toBe('airplane')
    expect(await count('select version n from public.ontologies where id = $1', [ont])).toBe(before + 1)
    expect(await count('select count(*) n from public.working_state_changes')).toBe(0)
  })

  it('discards an entry without touching the ontology', async () => {
    await db.query(`select public.stage_change('object_type', $1, '{"label":"Gone"}'::jsonb)`, [type])
    expect(await count(`select public.discard_working_state('object_type', $1) n`, [type])).toBe(1)
    const live = await db.query('select label from public.object_types where id = $1', [type])
    expect(live.rows[0].label).toBe('Flight Leg')
  })

  it('keeps the datasource bound through a save that never mentions one', async () => {
    // The stager was stamping an empty datasources section into every entry,
    // and the save read empty as unbind-them-all. 428 fixed the save half;
    // 440 fixed the stager half after a struct-property fixture hit the FK.
    const before = await count(
      'select count(*) n from public.object_type_datasources where object_type_id = $1', [type])
    expect(before).toBe(1)
    await db.query(`select public.save_object_type($1::jsonb, null)`,
      [JSON.stringify({ id: type, api_name: 'Flight', label: 'Flight Leg' })])
    await db.query('select public.save_working_state()')
    expect(await count(
      'select count(*) n from public.object_type_datasources where object_type_id = $1', [type])).toBe(1)
  })

  // ── Update: the way out of a stale save ───────────────────────────────────
  // "You can choose between keeping the changes in the latest version of the
  //  Ontology or overriding them with the changes in your working state."

  const resolve = (choice: 'latest' | 'mine') =>
    db.query('select public.update_working_state($1::jsonb) n',
      [JSON.stringify([{ resource_kind: 'object_type', resource_id: type, choice }])])

  it('needs no decision for a field only they moved', async () => {
    await db.query(`select public.stage_change('object_type', $1, '{"label":"Mine"}'::jsonb)`, [type])
    await db.query(`update public.object_types set description = 'theirs' where id = $1`, [type])
    // The auto-merge, and the whole reason a base is stored.
    expect(await count('select public.update_working_state() n')).toBe(0)
  })

  it('refuses to merge a field we both moved without one', async () => {
    await db.query(`update public.object_types set label = 'Theirs' where id = $1`, [type])
    const why = await refused(db, () => db.query('select public.update_working_state()'))
    expect(why).toMatch(/UnresolvedConflicts/)
  })

  it('keeps my changes as an override, without clobbering their other fields', async () => {
    expect(Number((await resolve('mine')).rows[0].n)).toBe(1)
    expect(await count('select count(*) n from public.working_state_conflicts()')).toBe(0)
    await db.query('select public.save_working_state()')
    const live = await db.query('select label, description from public.object_types where id = $1', [type])
    expect(live.rows[0].label).toBe('Mine')
    expect(live.rows[0].description).toBe('theirs')
  })

  it('drops my value on latest, and removes an entry with nothing left', async () => {
    await db.query(`select public.stage_change('object_type', $1, '{"label":"Doomed"}'::jsonb)`, [type])
    await db.query(`update public.object_types set label = 'Won' where id = $1`, [type])
    await resolve('latest')
    expect(await count('select count(*) n from public.working_state_changes')).toBe(0)
    // Taking latest changes my working state, never the ontology.
    const live = await db.query('select label from public.object_types where id = $1', [type])
    expect(live.rows[0].label).toBe('Won')
  })

  // ── the other resource kinds ───────────────────────────────────────────────
  // The generic arm of save_working_state was dead until a flat resource used
  // it: it fed `jsonb ->> key`, which is text, into columns of every type.
  // Object types never reached it because they route through apply_object_type.

  it('stages and saves a flat resource through the generic arm', async () => {
    const id = (await db.query(
      `select public.save_shared_property($1::jsonb) as id`,
      [JSON.stringify({ api_name: 'cost', label: 'Cost', base_type: 'double' })])).rows[0].id as string
    expect(await count('select count(*) n from public.shared_properties where id = $1', [id])).toBe(0)
    await db.query('select public.save_working_state()')
    const live = await db.query('select base_type from public.shared_properties where id = $1', [id])
    // A uuid ontology_id and a text base_type through the same code path.
    expect(live.rows[0].base_type).toBe('double')
  })

  it('changes only the fields an edit named', async () => {
    const id = (await db.query(
      `select id from public.shared_properties where api_name = 'cost'`)).rows[0].id as string
    await db.query(`select public.save_shared_property($1::jsonb)`,
      [JSON.stringify({ id, label: 'Unit cost' })])
    await db.query('select public.save_working_state()')
    const live = await db.query(
      'select api_name, label, base_type from public.shared_properties where id = $1', [id])
    expect(live.rows[0]).toMatchObject({ api_name: 'cost', label: 'Unit cost', base_type: 'double' })
  })

  it('holds a deletion until save, and gives it back on discard', async () => {
    const id = (await db.query(
      `select id from public.shared_properties where api_name = 'cost'`)).rows[0].id as string

    await db.query(`select public.delete_ontology_resource('shared_property', $1)`, [id])
    expect(await count('select count(*) n from public.shared_properties where id = $1', [id])).toBe(1)

    await db.query(`select public.discard_working_state('shared_property', $1)`, [id])
    expect(await count('select count(*) n from public.shared_properties where id = $1', [id])).toBe(1)

    await db.query(`select public.delete_ontology_resource('shared_property', $1)`, [id])
    await db.query('select public.save_working_state()')
    expect(await count('select count(*) n from public.shared_properties where id = $1', [id])).toBe(0)
  })

  it('refuses to stage a deletion for something never saved', async () => {
    const id = (await db.query(
      `select public.save_shared_property($1::jsonb) as id`,
      [JSON.stringify({ api_name: 'unsaved', label: 'Unsaved', base_type: 'string' })])).rows[0].id as string
    // Deleting an unsaved creation is a discard; calling it a deletion would
    // stage a delete for a row that will never exist.
    const why = await refused(db, () =>
      db.query(`select public.delete_ontology_resource('shared_property', $1)`, [id]))
    expect(why).toMatch(/NotSavedYet/)
    await db.query(`select public.discard_working_state('shared_property', $1)`, [id])
  })

  // The claim a migration assertion cannot make, because it only ever has one
  // user: unsaved work is not "available for others" until it is saved.
  it('is invisible to anybody else', async () => {
    await db.query(`select public.stage_change('object_type', $1, '{"label":"Mine"}'::jsonb)`, [type])
    expect(await count('select count(*) n from public.working_state_changes')).toBe(1)

    await db.query('reset role')
    const org = (await db.query(
      'select organization_id from public.ontologies where id = $1', [ont])).rows[0].organization_id
    await member(db, org as string, `ws-other-${Date.now()}@beacon.test`)
    await db.query('set local role authenticated')

    // Same organization, same ontology, admin — and still nothing.
    expect(await count('select count(*) n from public.working_state_changes')).toBe(0)
    expect(await count('select count(*) n from public.object_types where id = $1', [type])).toBe(1)
  })
})
