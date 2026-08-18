// Capabilities — an object type nominating its own properties against a
// platform contract.
//
// "In the Ontology Manager, object types now have a Capabilities page to
// configure features historically defined as type classes. The configuration
// of all supported type classes will move to the Capabilities page."
// (object-link-types/metadata-typeclasses)
//
// 415 built the table, the slot registry and guard_object_type_capability, and
// nothing has ever written a row: zero in production, no reader, no surface.
// So the guard's three refusals had never actually been fired. Each is
// executed here, and so is the nomination that must succeed — a guard never
// seen to refuse is not a guard, and one never seen to admit is worse.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('capabilities', () => {
  let db: pg.Client
  let f: Fixture
  let typeId = ''
  let otherTypeId = ''
  let numericProp = ''
  let stringProp = ''
  let foreignProp = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'caps415')
    const ont = await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'caps415','Caps415',false) returning id`, [f.spaceId])

    const mk = async (api: string) => (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,$3,$3) returning id`, [ont.id, f.projectId, api])).id

    typeId = await mk('CapsShip')
    otherTypeId = await mk('CapsOther')

    const prop = async (owner: string, api: string, base: string) => (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, backing_column)
       values ($1,$2,$3,$3,$4,$3) returning id`,
      [owner, api, api, base])).id

    numericProp = await prop(typeId, 'altitudeM', 'double')
    stringProp = await prop(typeId, 'cellId', 'string')
    foreignProp = await prop(otherTypeId, 'strayProp', 'double')
  })
  afterAll(async () => { await rollback(db) })

  it('publishes a fixed slot vocabulary with the types each slot accepts', async () => {
    const { rows } = await db.query(`select * from public.capability_slots()`)
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows as { capability: string; slot: string; accepts: string[]; note: string }[]) {
      expect(r.accepts.length, `${r.capability}/${r.slot} accepts something`).toBeGreaterThan(0)
      expect(r.note.length, `${r.capability}/${r.slot} carries its description`).toBeGreaterThan(0)
    }
    // The two panel shapes the reading found: slot-based here, list-based in
    // time_series_properties. Geospatial is the one the screenshot shows.
    expect(rows.map((r) => (r as { capability: string }).capability)).toContain('geospatial')
  })

  it('accepts a nomination whose property fits the slot', async () => {
    await db.query(
      `insert into public.object_type_capabilities (object_type_id, capability, slot, property_id)
       values ($1,'geospatial','altitude',$2)`, [typeId, numericProp])
    const got = await one(
      `select property_id from public.object_type_capabilities
        where object_type_id=$1 and capability='geospatial' and slot='altitude'`, [typeId])
    expect(got.property_id).toBe(numericProp)
  })

  it('refuses a slot that is not in the published vocabulary', async () => {
    const err = await refused(db, () => db.query(
      `insert into public.object_type_capabilities (object_type_id, capability, slot, property_id)
       values ($1,'geospatial','teleport',$2)`, [typeId, numericProp]))
    expect(err).toContain('Ontology:UnknownCapabilitySlot')
  })

  it('refuses a property belonging to another object type', async () => {
    const err = await refused(db, () => db.query(
      `insert into public.object_type_capabilities (object_type_id, capability, slot, property_id)
       values ($1,'geospatial','radius',$2)`, [typeId, foreignProp]))
    expect(err).toContain('Ontology:PropertyNotOnThisObjectType')
  })

  it('refuses a property whose base type the slot does not accept', async () => {
    // Radius takes numerics — "Numeric property specifying the radius in
    // meters" — so a string is the documented mismatch.
    const err = await refused(db, () => db.query(
      `insert into public.object_type_capabilities (object_type_id, capability, slot, property_id)
       values ($1,'geospatial','radius',$2)`, [typeId, stringProp]))
    expect(err).toContain('Ontology:CapabilitySlotTypeMismatch')
  })

  it('holds one nomination per slot, so re-nominating replaces', async () => {
    // The surface upserts on this constraint; without it a slot would collect
    // rows and the reader would have to pick one.
    const { rows } = await db.query(`
      SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid = 'public.object_type_capabilities'::regclass AND contype = 'u'`)
    expect(rows.map((r) => (r as { def: string }).def).join()).toContain('capability, slot')
  })
})
