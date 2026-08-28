// Interfaces, as regression tests rather than migration assertions.
//
// 450 and 451 assert all of this once, at the moment each landed, and never
// again — applied migrations are immutable and run once. These are the same
// invariants asked on every CI run: the contract's three clauses travelling
// whole through the session, natural-key identity across re-saves, the
// extension guards, commit-time conformance, and the searchable caps.
//
// Everything runs as `authenticated`; the fixture is one org, one ontology,
// one Ticket type whose properties the mappings point at.

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

describe.skipIf(noDb)('interfaces', () => {
  let db: pg.Client
  let ont: string
  let type: string
  let pid: string
  let iface: string

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)

  beforeAll(async () => {
    db = await connect()
    const org = (await one(`insert into public.organizations (name) values ('iface-regress') returning id`)).id
    await admin(db, org, `iface-${Date.now()}@beacon.test`)
    await db.query('set local role authenticated')

    const space = (await one(`select public.create_space('Iface regress') as id`)).id
    await db.query(`delete from public.ontologies where space_id = '${space}'`)
    ont = (await one(`insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
                      values ('${space}','ifaceregress','Iface regress',false) returning id`)).id
    const proj = (await one(`insert into public.projects (organization_id, space_id, api_name, name)
                             values ($1,$2,'ifacer','IfaceR') returning id`, [org, space])).id
    const ds = (await one(`insert into public.datasets (organization_id, project_id, api_name, name)
                           values ($1,$2,'ifaceds','ifaceds') returning id`, [org, proj])).id
    const br = (await one(`insert into public.dataset_branches (dataset_id, name)
                           values ($1,'master') returning id`, [ds])).id

    type = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
      JSON.stringify({
        api_name: 'Ticket', label: 'Ticket', ontology_id: ont,
        datasources: [{ dataset_id: ds, branch_id: br }],
      }),
      JSON.stringify([{
        property_id: 'ticket_id', display_name: 'Ticket Id', api_name: 'ticketId',
        base_type: 'string', source: 'column', backing_column: 'ticket_id',
        is_primary_key: true, is_title_key: true, required: true,
      }]),
    ])).id
    await db.query('select public.save_working_state()')
    pid = (await one(`select id from public.object_type_properties
                       where object_type_id = $1 and property_id = 'ticket_id'`, [type])).id
  })
  afterAll(async () => { await rollback(db) })

  // ── 451: the whole-interface session ───────────────────────────────────────
  it('stages an interface whole and lands its three clauses', async () => {
    iface = (await one(`select public.save_interface($1::jsonb) as id`, [JSON.stringify({
      api_name: 'Identifiable', label: 'Identifiable', ontology_id: ont,
      properties: [
        { property_id: 'ext_id', display_name: 'External Id', api_name: 'externalId',
          base_type: 'string', required: true, pk_constraint: 'must', position: 0 },
        { property_id: 'note', display_name: 'Note', api_name: 'note',
          base_type: 'string', required: false, position: 1 },
      ],
      link_constraints: [
        { api_name: 'ownedBy', display_name: 'Owned by', cardinality: 'ONE',
          target_kind: 'object_type', target_object_type_id: type },
      ],
      action_constraints: [
        // Optional, deliberately: 467 enforces satisfactions for REQUIRED
        // action constraints at commit, and this suite implements the
        // interface without mapping any action.
        { api_name: 'retire', display_name: 'Retire', description: 'Retire the thing.', required: false },
      ],
    })])).id
    expect(await count('select count(*) n from public.working_state_changes')).toBe(1)
    expect(await count('select count(*) n from public.ontology_interfaces where id = $1', [iface])).toBe(0)

    await db.query('select public.save_working_state()')
    expect(await count('select count(*) n from public.interface_properties where interface_id = $1', [iface])).toBe(2)
    expect(await count('select count(*) n from public.interface_link_constraints where interface_id = $1', [iface])).toBe(1)
    expect(await count('select count(*) n from public.interface_action_constraints where interface_id = $1', [iface])).toBe(1)
  })

  it('leaves every clause standing through a label-only edit', async () => {
    await db.query(`select public.save_interface($1::jsonb)`,
      [JSON.stringify({ id: iface, label: 'Identifiable thing' })])
    await db.query('select public.save_working_state()')
    expect((await one('select label from public.ontology_interfaces where id = $1', [iface])).label)
      .toBe('Identifiable thing')
    expect(await count('select count(*) n from public.interface_properties where interface_id = $1', [iface])).toBe(2)
    expect(await count('select count(*) n from public.interface_link_constraints where interface_id = $1', [iface])).toBe(1)
  })

  it('keeps a property row identity across a re-save, and deletes the unlisted', async () => {
    const before = (await one(`select id from public.interface_properties
                                where interface_id = $1 and property_id = 'ext_id'`, [iface])).id
    // Same natural key, new display name, `note` omitted from the list.
    await db.query(`select public.save_interface($1::jsonb)`, [JSON.stringify({
      id: iface,
      properties: [
        { property_id: 'ext_id', display_name: 'External Identifier', api_name: 'externalId',
          base_type: 'string', required: true, pk_constraint: 'must', position: 0 },
      ],
    })])
    await db.query('select public.save_working_state()')
    const after = await one(`select id, display_name from public.interface_properties
                              where interface_id = $1 and property_id = 'ext_id'`, [iface])
    expect(after.id).toBe(before)                     // mappings survive re-saves
    expect(after.display_name).toBe('External Identifier')
    expect(await count('select count(*) n from public.interface_properties where interface_id = $1', [iface])).toBe(1)
  })

  // ── 450: naming, extension guards ──────────────────────────────────────────
  it('holds interface API names to PascalCase', async () => {
    const err = await refused(db, () => db.query(
      `insert into public.ontology_interfaces (ontology_id, api_name, label)
       values ($1, 'bad_name', 'Bad')`, [ont]))
    expect(err).toMatch(/check/i)
  })

  it('refuses an extension cycle by name', async () => {
    const a = (await one(`insert into public.ontology_interfaces (ontology_id, api_name, label)
                          values ($1,'CycleA','A') returning id`, [ont])).id
    const b = (await one(`insert into public.ontology_interfaces (ontology_id, api_name, label)
                          values ($1,'CycleB','B') returning id`, [ont])).id
    await db.query(`insert into public.interface_extensions (interface_id, parent_interface_id)
                    values ($1,$2)`, [a, b])
    const err = await refused(db, () => db.query(
      `insert into public.interface_extensions (interface_id, parent_interface_id)
       values ($1,$2)`, [b, a]))
    expect(err).toContain('Ontology:InterfaceExtensionCycle')
  })

  it('refuses a child that redeclares an inherited property', async () => {
    const parent = (await one(`insert into public.ontology_interfaces (ontology_id, api_name, label)
                               values ($1,'HasName','Has name') returning id`, [ont])).id
    const child = (await one(`insert into public.ontology_interfaces (ontology_id, api_name, label)
                              values ($1,'NamedThing','Named thing') returning id`, [ont])).id
    for (const i of [parent, child]) {
      await db.query(
        `insert into public.interface_properties
           (interface_id, property_id, display_name, api_name, base_type)
         values ($1,'name','Name','name','string')`, [i])
    }
    const err = await refused(db, () => db.query(
      `insert into public.interface_extensions (interface_id, parent_interface_id)
       values ($1,$2)`, [child, parent]))
    expect(err).toContain('Ontology:InheritedPropertyCollision')
  })

  // ── 450: commit-time conformance ───────────────────────────────────────────
  // The trigger is DEFERRABLE INITIALLY DEFERRED; SET CONSTRAINTS ALL IMMEDIATE
  // stands in for the commit this transaction never makes.
  it('refuses an implementation whose required properties are unmapped', async () => {
    const err = await refused(db, async () => {
      await db.query(`insert into public.object_type_interfaces (object_type_id, interface_id)
                      values ($1,$2)`, [type, iface])
      await db.query('set constraints all immediate')
    })
    expect(err).toContain('OntologyMetadata:DoesNotConform')
  })

  it('refuses a mapping that disagrees on base type or the pk tri-state', async () => {
    // ext_id is pk_constraint 'must'; map it to a non-pk integer property.
    const otherPid = (await one(
      // Edit-only, so it names no column — but it is still permissioned to the
      // type's datasource.
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source, datasource_id)
       values ($1,'attempts','Attempts','attempts','integer','user_input',
               (select id from public.object_type_datasources where object_type_id = $1 limit 1))
       returning id`, [type])).id
    const err = await refused(db, async () => {
      const impl = (await one(`insert into public.object_type_interfaces (object_type_id, interface_id)
                               values ($1,$2) returning id`, [type, iface])).id
      void impl
      await db.query(
        `insert into public.interface_implementation_mappings
           (object_type_id, interface_id, interface_property_id, resolution, object_property_id)
         select $1, $2, p.id, 'choose_existing', $3
           from public.interface_properties p
          where p.interface_id = $2 and p.property_id = 'ext_id'`, [type, iface, otherPid])
      await db.query('set constraints all immediate')
    })
    expect(err).toContain('OntologyMetadata:MappingMismatch')
  })

  it('accepts an implementation whose mapping matches', async () => {
    await db.query(`insert into public.object_type_interfaces (object_type_id, interface_id)
                    values ($1,$2)`, [type, iface])
    await db.query(
      `insert into public.interface_implementation_mappings
         (object_type_id, interface_id, interface_property_id, resolution, object_property_id)
       select $1, $2, p.id, 'choose_existing', $3
         from public.interface_properties p
        where p.interface_id = $2 and p.property_id = 'ext_id'`, [type, iface, pid])
    await db.query('set constraints all immediate')
    await db.query('set constraints all deferred')
    expect(await count(
      `select count(*) n from public.object_type_interfaces
        where object_type_id = $1 and interface_id = $2`, [type, iface])).toBe(1)
  })

  // ── 455: the writer lands the claim whole ──────────────────────────────────
  it('implements through the writer, mappings and row in one call', async () => {
    const other = (await one(`insert into public.ontology_interfaces (ontology_id, api_name, label)
                              values ($1,'Written','Written') returning id`, [ont])).id
    await db.query(
      `insert into public.interface_properties
         (interface_id, property_id, display_name, api_name, base_type, required)
       values ($1,'w_id','W Id','wId','string',true)`, [other])
    // Unknown property refuses by name; the subtransaction takes the row with it.
    const err = await refused(db, () => db.query(
      `select public.implement_interface($1,$2,$3::jsonb)`,
      [type, other, JSON.stringify([{ property_id: 'nope', resolution: 'edit_only' }])]))
    expect(err).toContain('Ontology:NoSuchInterfaceProperty')
    // The real claim lands and conforms.
    await db.query(`select public.implement_interface($1,$2,$3::jsonb)`,
      [type, other, JSON.stringify([{ property_id: 'w_id', resolution: 'choose_existing', object_property_id: pid }])])
    await db.query('set constraints all immediate')
    await db.query('set constraints all deferred')
    expect(await count(
      `select count(*) n from public.interface_implementation_mappings
        where object_type_id = $1 and interface_id = $2`, [type, other])).toBe(1)
  })

  // ── 467: the session travels nested parameter constraints ─────────────────
  it('lands parameter constraints staged inside an action-constraint element', async () => {
    const i2 = (await one(`select public.save_interface($1::jsonb) as id`, [JSON.stringify({
      api_name: 'Paramful', label: 'Paramful', ontology_id: ont,
      properties: [{ property_id: 'p_id', display_name: 'P Id', api_name: 'pId',
        base_type: 'string', required: true, position: 0 }],
      action_constraints: [{
        api_name: 'createThing', display_name: 'Create thing', required: false,
        parameters: [
          { api_name: 'subject', display_name: 'Subject', base_type: 'string', required: true, position: 0 },
          { api_name: 'about', display_name: 'About', base_type: 'object_reference', required: false, position: 1 },
        ],
      }],
    })])).id
    await db.query('select public.save_working_state()')
    expect(await count(
      `select count(*) n from public.interface_action_parameter_constraints pc
        join public.interface_action_constraints ac on ac.id = pc.constraint_id
       where ac.interface_id = $1`, [i2])).toBe(2)
    // A re-save that omits `parameters` leaves them standing (absent = unchanged).
    await db.query(`select public.save_interface($1::jsonb)`, [JSON.stringify({
      id: i2,
      action_constraints: [{ api_name: 'createThing', display_name: 'Create thing renamed', required: false }],
    })])
    await db.query('select public.save_working_state()')
    expect(await count(
      `select count(*) n from public.interface_action_parameter_constraints pc
        join public.interface_action_constraints ac on ac.id = pc.constraint_id
       where ac.interface_id = $1`, [i2])).toBe(2)
  })

  // ── 467: action constraints declare their parameters ───────────────────────
  it('validates action-constraint mappings the way the page lists', async () => {
    const other = (await one(`insert into public.ontology_interfaces (ontology_id, api_name, label)
                              values ($1,'Actionable','Actionable') returning id`, [ont])).id
    const ac = (await one(`insert into public.interface_action_constraints
                             (interface_id, api_name, display_name, required)
                           values ($1,'doThing','Do thing',true) returning id`, [other])).id
    const pc = (await one(`insert into public.interface_action_parameter_constraints
                             (constraint_id, api_name, display_name, base_type, required)
                           values ($1,'title','Title','string',true) returning id`, [ac])).id
    const act = (await one(`insert into public.action_types (ontology_id, api_name, label)
                            values ($1,'do-thing-on-ticket','Do thing') returning id`, [ont])).id
    const ap = (await one(`insert into public.action_type_parameters
                             (action_type_id, api_name, display_name, base_type, required)
                           values ($1,'title','Title','string',true) returning id`, [act])).id

    // A required action constraint without a satisfaction refuses at commit.
    const err = await refused(db, async () => {
      await db.query(`select public.implement_interface($1,$2,'[]'::jsonb)`, [type, other])
      await db.query('set constraints all immediate')
    })
    expect(err).toContain('OntologyMetadata:ActionConstraintNotSatisfied')

    // Satisfied + required parameter mapped: the whole claim conforms.
    await db.query(`select public.implement_interface($1,$2,'[]'::jsonb)`, [type, other])
    await db.query(`insert into public.interface_action_satisfactions
                      (object_type_id, interface_id, constraint_id, action_type_id)
                    values ($1,$2,$3,$4)`, [type, other, ac, act])
    await db.query(`insert into public.interface_action_parameter_mappings
                      (object_type_id, interface_id, constraint_id, parameter_constraint_id, action_parameter_id)
                    values ($1,$2,$3,$4,$5)`, [type, other, ac, pc, ap])
    await db.query('set constraints all immediate')
    await db.query('set constraints all deferred')

    // An incompatible type refuses by name.
    const pc2 = (await one(`insert into public.interface_action_parameter_constraints
                              (constraint_id, api_name, display_name, base_type, required)
                            values ($1,'when','When','timestamp',false) returning id`, [ac])).id
    expect(await refused(db, () => db.query(
      `insert into public.interface_action_parameter_mappings
         (object_type_id, interface_id, constraint_id, parameter_constraint_id, action_parameter_id)
       values ($1,$2,$3,$4,$5)`, [type, other, ac, pc2, ap])))
      .toContain('OntologyMetadata:IncompatibleParameterType')
  })

  // ── 450: the searchable caps ───────────────────────────────────────────────
  it('refuses to flip searchable on past 50 implementers', async () => {
    // An interface with no required properties conforms trivially, so volume
    // is the only thing under test.
    // Explicitly non-searchable: 726 made searchable the DEFAULT (the page's
    // own sentence), so a fixture wanting the 1,000-cap side says so.
    const cap = (await one(`insert into public.ontology_interfaces (ontology_id, api_name, label, searchable)
                            values ($1,'Capped','Capped',false) returning id`, [ont])).id
    await db.query(
      `with types as (
         insert into public.object_types (ontology_id, api_name, label)
         select $1, 'Cap' || i, 'Cap ' || i from generate_series(1, 51) i
         returning id)
       insert into public.object_type_interfaces (object_type_id, interface_id)
       select id, $2 from types`, [ont, cap])
    const err = await refused(db, () => db.query(
      `update public.ontology_interfaces set searchable = true where id = $1`, [cap]))
    expect(err).toContain('Ontology:TooManyImplementations')
  })
})
