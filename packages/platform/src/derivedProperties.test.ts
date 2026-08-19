// A property whose value comes from objects it links to.
//
// `configure-derived-property-source-tab.png` draws Source type as one radio
// group of three — Datasource, User edits, Linked objects ("Use a property from
// another object type") — which is why this is a third `source` and not a new
// table. `configure-derived-property-aggregation.png` gives the rest of the
// shape in one frame: hop rows, then Aggregation, Property, Limit.
//
// The rules split across three rungs of the placement ladder, and the split is
// the thing worth guarding:
//   CHECK    — what a property row can say about itself
//   trigger  — whether a hop reaches where the chain stands
//   linter   — what only a COMPLETE chain can answer, because Foundry authors
//              it incrementally and a trigger demanding completeness would make
//              the documented order impossible

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('a property may be derived from linked objects', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  const ot: Record<string, string> = {}
  const link: Record<string, string> = {}
  let title = ''
  let derived = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'derived576')
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'derived576','Derived576',false) returning id`, [f.spaceId])).id

    for (const name of ['Actor', 'Role', 'Movie', 'Studio', 'Unrelated']) {
      ot[name] = (await one(
        `insert into public.object_types (ontology_id, project_id, api_name, label)
         values ($1,$2,$3,$3) returning id`, [ont, f.projectId, name])).id
    }
    const mkLink = async (api: string, src: string, tgt: string, card: string) => {
      link[api] = (await one(
        `insert into public.link_types (ontology_id, project_id, api_name, label,
           source_object_type_id, target_object_type_id, cardinality,
           source_api_name, target_api_name, source_label, target_label)
         values ($1,$2,$3,$3,$4,$5,$6,'a','b','A','B') returning id`,
        [ont, f.projectId, api, ot[src], ot[tgt], card])).id
    }
    // Actor —one_to_many→ Role —many_to_one→ Movie —many_to_one→ Studio
    await mkLink('roles', 'Actor', 'Role', 'one_to_many')
    await mkLink('movie', 'Role', 'Movie', 'many_to_one')
    await mkLink('studio', 'Movie', 'Studio', 'many_to_one')
    await mkLink('far', 'Unrelated', 'Role', 'one_to_one')

    title = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, backing_column)
       values ($1,'title','title','Title','string','title') returning id`, [ot.Movie])).id
  })
  afterAll(async () => { await rollback(db) })

  it('carries the nine aggregations the page lists, with count taking no property', async () => {
    const { rows } = await db.query(`select name, needs_property, takes_limit
                                       from public.derived_aggregations() order by name`)
    expect(rows.length).toBe(9)
    const byName = Object.fromEntries(
      (rows as { name: string; needs_property: boolean; takes_limit: boolean }[])
        .map((r) => [r.name, r]))
    // "For Count aggregation, you do not need to select a property."
    expect(byName.count.needs_property).toBe(false)
    // "If you selected Collect list or Collect set … you can optionally set a limit"
    expect(byName.collect_list.takes_limit).toBe(true)
    expect(byName.collect_set.takes_limit).toBe(true)
    expect(byName.sum.takes_limit).toBe(false)
  })

  it('names neither a column nor a datasource, unlike the other two sources', async () => {
    derived = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type,
          source, derived_aggregation, derived_from_property_id, derived_limit)
       values ($1,'movieTitles','movieTitles','Movie titles','string',
               'linked_objects','collect_set',$2,10) returning id`, [ot.Actor, title])).id

    const row = await one(
      `select backing_column, datasource_id from public.object_type_properties where id = $1`,
      [derived])
    expect(row.backing_column).toBeNull()
    expect(row.datasource_id).toBeNull()

    // And the arm refuses one that claims a column anyway.
    const err = await refused(db, () => db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source, backing_column)
       values ($1,'bad','bad','Bad','string','linked_objects','c')`, [ot.Actor]))
    expect(err).toContain('source_names_its_data')
  })

  it('walks the chain and reports where it lands and whether it crossed a many', async () => {
    await db.query(
      `insert into public.derived_property_hops (property_id, position, link_type_id)
       values ($1,1,$2), ($1,2,$3)`, [derived, link.roles, link.movie])

    const c = await one(
      `select reached, any_many, hops from public.derived_chain($1)`, [derived])
    expect(c.reached).toBe(ot.Movie)
    expect(c.hops).toBe(2)
    // one_to_many traversed forwards is a many; many_to_one forwards is not.
    expect(c.any_many).toBe(true)

    // A complete, legal chain draws no complaint.
    const { rows } = await db.query(
      `select * from public.derived_property_problems() where subject = 'movieTitles'`)
    expect(rows).toEqual([])
  })

  it('refuses a hop that does not touch where the chain stands', async () => {
    // A link is traversable from EITHER end, so this is only unreachable
    // because `far` touches neither Movie nor anything the chain reached.
    const err = await refused(db, () => db.query(
      `insert into public.derived_property_hops (property_id, position, link_type_id)
       values ($1,3,$2)`, [derived, link.far]))
    expect(err).toContain('Ontology:HopLinkDoesNotReach')
  })

  it('traverses a link backwards, because a link type has two ends', async () => {
    // From Movie, the Role→Movie link runs in reverse and reaches Role — and
    // many_to_one entered from the target side IS a many.
    const back = await one(
      `select public.link_other_end($1,$2) as reached,
              public.link_hop_is_many($1,$2) as many`, [link.movie, ot.Movie])
    expect(back.reached).toBe(ot.Role)
    expect(back.many).toBe(true)
    // And forwards it is not.
    const fwd = await one(
      `select public.link_hop_is_many($1,$2) as many`, [link.movie, ot.Role])
    expect(fwd.many).toBe(false)
  })

  it('caps the chain at three hops, the page\'s "3 levels"', async () => {
    await db.query('savepoint cap')
    await db.query(
      `insert into public.derived_property_hops (property_id, position, link_type_id)
       values ($1,3,$2)`, [derived, link.studio])
    const err = await refused(db, () => db.query(
      `insert into public.derived_property_hops (property_id, position, link_type_id)
       values ($1,4,$2)`, [derived, link.studio]))
    expect(err).toContain('derived_property_hops_position_check')
    await db.query('rollback to savepoint cap')
  })

  it('enforces the three limitations that are about a property\'s own definition', async () => {
    // "Derived properties cannot be marked as required (non-nullable)."
    expect(await refused(db, () => db.query(
      `update public.object_type_properties set required = true where id = $1`, [derived])))
      .toContain('derived_is_not_required')
    // "Primary key properties cannot be derived properties." Stated separately
    // even though `check3` (a key must be required) already implies it.
    expect(await refused(db, () => db.query(
      `update public.object_type_properties set is_primary_key = true where id = $1`, [derived])))
      .toContain('derived_is_not_a_primary_key')
    // "Properties with value types cannot be converted to derived properties."
    const vt = (await one(
      `insert into public.value_types (space_id, api_name, display_name, base_type)
       values ($1,'vt576','VT576','string') returning id`, [f.spaceId])).id
    expect(await refused(db, () => db.query(
      `update public.object_type_properties set value_type_id = $2 where id = $1`, [derived, vt])))
      .toContain('derived_takes_no_value_type')
  })

  it('keeps the derived fields off a property that is not derived', async () => {
    const plain = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, backing_column)
       values ($1,'plain','plain','Plain','string','plain') returning id`, [ot.Actor])).id
    expect(await refused(db, () => db.query(
      `update public.object_type_properties set derived_aggregation = 'sum' where id = $1`, [plain])))
      .toContain('derived_fields_only_when_derived')
  })

  it('reports what only a complete chain can answer, and does not refuse it', async () => {
    // Foundry authors this incrementally — the panel sits with "Select linked
    // object" empty — so a half-built chain must be storable. The linter is
    // where the completeness rules live.
    const empty = await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source)
       values ($1,'halfBuilt','halfBuilt','Half built','string','linked_objects')
       returning id`, [ot.Actor])
    expect(empty.id, 'a half-configured derived property is storable').toBeTruthy()

    const { rows } = await db.query(
      `select problem from public.derived_property_problems() where subject = 'halfBuilt'`)
    expect(rows.length).toBe(1)
    expect((rows[0] as { problem: string }).problem).toContain('at least one hop')
  })

  it('wants an aggregation exactly when the chain crosses a many', async () => {
    await db.query('savepoint agg')
    await db.query(
      `update public.object_type_properties
          set derived_aggregation = null, derived_from_property_id = null, derived_limit = null
        where id = $1`, [derived])
    const { rows } = await db.query(
      `select problem from public.derived_property_problems() where subject = 'movieTitles'`)
    expect(rows.length).toBe(1)
    expect((rows[0] as { problem: string }).problem).toContain('names no aggregation')
    await db.query('rollback to savepoint agg')
  })

  it('catches a derived-from property on the wrong object type', async () => {
    await db.query('savepoint wrong')
    const actorName = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, backing_column)
       values ($1,'aName','aName','A name','string','a_name') returning id`, [ot.Actor])).id
    await db.query(
      `update public.object_type_properties set derived_from_property_id = $2 where id = $1`,
      [derived, actorName])
    const { rows } = await db.query(
      `select problem from public.derived_property_problems() where subject = 'movieTitles'`)
    expect(rows.length).toBe(1)
    expect((rows[0] as { problem: string }).problem).toContain('not a property of the object type')
    await db.query('rollback to savepoint wrong')
  })

  it('reaches ontology_violations(), and did not eat what was already there', async () => {
    // The wrapper keeps the previous body under `ontology_violations_core()`
    // rather than retyping it, which is how a linter quietly loses a check.
    const core = await one(`select count(*)::int as n from public.ontology_violations_core()`)
    const all = await one(`select count(*)::int as n from public.ontology_violations()`)
    expect(Number(all.n)).toBeGreaterThanOrEqual(Number(core.n))

    const { rows } = await db.query(
      `select 1 from public.ontology_violations() where subject = 'halfBuilt'`)
    expect(rows.length).toBe(1)
  })
})
