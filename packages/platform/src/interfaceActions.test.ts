// An action rule on an interface, executed.
//
// The three interface object rules were registered by 569 and unexecutable, and
// `action_rule_kinds()` said why in its own notes: Foundry generates a parameter
// for each and we generated none. The blockers were two published shapes nobody
// had read — what kinds of parameter exist, and how their values are encoded.
//
// The failure this file exists to catch is SILENCE. `apply_action` dispatched on
// `r.object_type_id`, which is null on every interface rule, so its edits gate
// read `NOT (SELECT … WHERE id = NULL)` — NULL, not true — the IF did not fire,
// and the rule fell through all three branches writing nothing. An action that
// reports success and writes zero edits is worse than one that raises.
//
// The worked example is the page's own: a `Ticket` interface with a `Subject`
// property, implemented by `Bug` and `FeatureRequest`, which spell that property
// differently — `Title` and `Summary`. That difference is the entire point: a
// rule naming the interface property must reach a different column per type.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('an interface action rule resolves and runs', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let iface = ''
  let subject = ''          // the interface property
  let bug = ''
  let feature = ''
  let bugTitle = ''
  let featureSummary = ''
  let action = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  /** An implementing type whose own property is named differently. */
  const implementer = async (name: string, keyCol: string, ownProp: string, ownCamel: string) => {
    const ds = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,$3,$3) returning id`, [f.orgId, f.projectId, name.toLowerCase()])).id
    const br = (await one(
      `insert into public.dataset_branches (dataset_id, name)
       values ($1,'master') returning id`, [ds])).id
    const id = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
       values ($1,$2,$3,$3,true) returning id`, [ont, f.projectId, name])).id
    const dsid = (await one(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3) returning id`, [id, ds, br])).id
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source,
          backing_column, is_primary_key, is_title_key, required)
       values ($1,$2,$3,$3,'string','column',$2,true,true,true)`,
      [id, keyCol, `${name.charAt(0).toLowerCase()}${name.slice(1)}Id`])
    const prop = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source,
          backing_column, datasource_id)
       values ($1,$2,$3,$3,'string','column',$2,$4) returning id`,
      [id, ownProp, ownCamel, dsid])).id
    // Implements the interface, and resolves Subject onto its own property.
    await db.query(
      `insert into public.object_type_interfaces (object_type_id, interface_id)
       values ($1,$2)`, [id, iface])
    await db.query(
      `insert into public.interface_implementation_mappings
         (object_type_id, interface_id, interface_property_id, resolution, object_property_id)
       values ($1,$2,$3,'choose_existing',$4)`, [id, iface, subject, prop])
    return { id, prop }
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'iface592')
    // `ontology_interfaces.created_by_user_id` is NOT NULL, so this suite needs
    // a real author rather than the fixture's claims-only session.
    const user = (await one('select gen_random_uuid() as id')).id
    const email = `iface592-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [user, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [user, email, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: user, app_metadata: { role: 'admin', org_id: f.orgId } })])
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'iface592','Iface592',false) returning id`, [f.spaceId])).id
    iface = (await one(
      `insert into public.ontology_interfaces (ontology_id, api_name, label, created_by_user_id)
       values ($1,'Ticket','Ticket',$2) returning id`, [ont, user])).id
    subject = (await one(
      `insert into public.interface_properties
         (interface_id, property_id, api_name, display_name, base_type)
       values ($1,'subject','subject','Subject','string') returning id`, [iface])).id

    const b = await implementer('Bug', 'bug_id', 'title', 'title')
    bug = b.id; bugTitle = b.prop
    const fr = await implementer('FeatureRequest', 'fr_id', 'summary', 'summary')
    feature = fr.id; featureSummary = fr.prop

    action = (await one(
      `insert into public.action_types (ontology_id, api_name, label)
       values ($1,'edit-ticket','Edit ticket') returning id`, [ont])).id
  })

  afterAll(async () => { await rollback(db) })

  /** A modify-on-interface rule writing Subject from a parameter. */
  const modifyRule = async () => {
    const rule = (await one(
      `insert into public.action_type_rules (action_type_id, kind, position, interface_id)
       values ($1,'modify_object_of_interface',0,$2) returning id`, [action, iface])).id
    const param = (await one(
      `insert into public.action_type_parameters
         (action_type_id, api_name, display_name, base_type, data_kind, required, position)
       values ($1,'newSubject','New subject','string','base_type',true,0) returning id`,
      [action])).id
    await db.query(
      `insert into public.action_type_rule_properties
         (rule_id, interface_property_id, value_source, parameter_id)
       values ($1,$2,'parameter',$3)`, [rule, subject, param])
    return rule
  }

  const edits = async (typeId: string) => {
    const { rows } = await db.query(
      `select primary_key, instruction, properties from public.object_edits
        where object_type_id = $1 order by seq`, [typeId])
    return rows as { primary_key: string; instruction: string; properties: Record<string, string> }[]
  }

  it('generates the interface reference parameter the rule requires', async () => {
    await modifyRule()
    const n = (await one(`select public.generate_interface_parameters($1) as n`, [action])).n
    expect(Number(n)).toBe(1)

    const p = await one(
      `select api_name, display_name, data_kind, interface_id, required
         from public.action_type_parameters
        where action_type_id = $1 and data_kind = 'interfaceObject'`, [action])
    expect(p.api_name).toBe('ticket')
    expect(p.display_name).toBe('Ticket')
    expect(p.interface_id).toBe(iface)
    // Generating it twice does not make two.
    expect(Number((await one(`select public.generate_interface_parameters($1) as n`, [action])).n)).toBe(0)
  })

  it('writes the edit onto the type the reference names, not the interface', async () => {
    await db.query(`select public.apply_action($1, $2::jsonb)`, [action, JSON.stringify({
      newSubject: 'Crash on save',
      ticket: { objectTypeApiName: 'Bug', primaryKeyValue: 'BUG-1' },
    })])

    const rows = await edits(bug)
    expect(rows).toHaveLength(1)
    expect(rows[0].primary_key).toBe('BUG-1')
    expect(rows[0].instruction).toBe('modify')
    // The interface property reached Bug's own column name.
    expect(rows[0].properties).toEqual({ title: 'Crash on save' })
    expect(await edits(feature)).toHaveLength(0)
  })

  it('and the SAME rule reaches a differently-named property on the other type', async () => {
    await db.query(`select public.apply_action($1, $2::jsonb)`, [action, JSON.stringify({
      newSubject: 'Dark mode please',
      ticket: { objectTypeApiName: 'FeatureRequest', primaryKeyValue: 'FR-9' },
    })])
    const rows = await edits(feature)
    expect(rows).toHaveLength(1)
    expect(rows[0].properties).toEqual({ summary: 'Dark mode please' })
  })

  it('refuses a reference naming a type that does not implement the interface', async () => {
    const other = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
       values ($1,$2,'Invoice','Invoice',true) returning id`, [ont, f.projectId])).id
    expect(other).toBeTruthy()
    const err = await refused(db, () => db.query(
      `select public.apply_action($1, $2::jsonb)`, [action, JSON.stringify({
        newSubject: 'x', ticket: { objectTypeApiName: 'Invoice', primaryKeyValue: 'INV-1' },
      })]))
    expect(err).toMatch(/TypeDoesNotImplement/)
  })

  it('honours the per-type interface actions gate', async () => {
    await db.query(
      `update public.object_type_interfaces set interface_actions_enabled = false
        where object_type_id = $1 and interface_id = $2`, [bug, iface])
    const err = await refused(db, () => db.query(
      `select public.apply_action($1, $2::jsonb)`, [action, JSON.stringify({
        newSubject: 'x', ticket: { objectTypeApiName: 'Bug', primaryKeyValue: 'BUG-2' },
      })]))
    expect(err).toMatch(/InterfaceActionsDisabled/)
    await db.query(
      `update public.object_type_interfaces set interface_actions_enabled = true
        where object_type_id = $1 and interface_id = $2`, [bug, iface])
  })

  it('refuses to modify a primary key, which no action type may do', async () => {
    // Point the interface property at Bug's KEY, the mistake the page draws:
    // "the Title property is incorrectly used as the primary key for the Bug
    // object type", and the action fails on submission.
    const key = (await one(
      `select id from public.object_type_properties
        where object_type_id = $1 and is_primary_key`, [bug])).id
    await db.query(
      `update public.interface_implementation_mappings set object_property_id = $1
        where object_type_id = $2 and interface_property_id = $3`, [key, bug, subject])

    const err = await refused(db, () => db.query(
      `select public.apply_action($1, $2::jsonb)`, [action, JSON.stringify({
        newSubject: 'x', ticket: { objectTypeApiName: 'Bug', primaryKeyValue: 'BUG-3' },
      })]))
    expect(err).toMatch(/CannotModifyPrimaryKey/)

    await db.query(
      `update public.interface_implementation_mappings set object_property_id = $1
        where object_type_id = $2 and interface_property_id = $3`, [bugTitle, bug, subject])
  })

  it('an ordinary object rule still behaves exactly as before', async () => {
    const plain = (await one(
      `insert into public.action_types (ontology_id, api_name, label)
       values ($1,'rename-bug','Rename bug') returning id`, [ont])).id
    const rule = (await one(
      `insert into public.action_type_rules (action_type_id, kind, position, object_type_id)
       values ($1,'modify_object',0,$2) returning id`, [plain, bug])).id
    const param = (await one(
      `insert into public.action_type_parameters
         (action_type_id, api_name, display_name, base_type, data_kind, required, position)
       values ($1,'t','Title','string','base_type',true,0) returning id`, [plain])).id
    await db.query(
      `insert into public.action_type_rule_properties
         (rule_id, property_id, value_source, parameter_id)
       values ($1,$2,'parameter',$3)`, [rule, bugTitle, param])

    await db.query(`select public.apply_action($1, $2::jsonb, $3)`,
      [plain, JSON.stringify({ t: 'Renamed' }), 'BUG-7'])
    const rows = await edits(bug)
    expect(rows[rows.length - 1].primary_key).toBe('BUG-7')
    expect(rows[rows.length - 1].properties).toEqual({ title: 'Renamed' })
    expect(featureSummary).toBeTruthy()
  })

  it('the SAVE path creates the rule and generates the parameter with it', async () => {
    // Everything above built the rule by hand. This is the path the product
    // uses, and until 595 it dropped `interface_id` on the floor — an interface
    // rule saved through it became an object rule pointing at nothing.
    const saved = (await one(
      `select public.apply_action_type($1::jsonb, $2::jsonb, $3::jsonb, '[]'::jsonb) as id`,
      [JSON.stringify({ api_name: 'close-ticket', label: 'Close ticket', ontology_id: ont }),
       JSON.stringify([]),
       JSON.stringify([{ kind: 'delete_object_of_interface', position: 0, interface_id: iface }])],
    )).id

    const r = await one(
      `select kind, interface_id, object_type_id from public.action_type_rules
        where action_type_id = $1`, [saved])
    expect(r.kind).toBe('delete_object_of_interface')
    expect(r.interface_id).toBe(iface)
    expect(r.object_type_id).toBeNull()

    // And the parameter arrived with it, unasked.
    const p = await one(
      `select api_name, data_kind, required from public.action_type_parameters
        where action_type_id = $1`, [saved])
    expect(p.data_kind).toBe('interfaceObject')
    expect(p.api_name).toBe('ticket')

    await db.query(`select public.apply_action($1, $2::jsonb)`, [saved, JSON.stringify({
      ticket: { objectTypeApiName: 'FeatureRequest', primaryKeyValue: 'FR-2' },
    })])
    const rows = await edits(feature)
    expect(rows[rows.length - 1].instruction).toBe('delete')
    expect(rows[rows.length - 1].primary_key).toBe('FR-2')
  })

  it('a create rule names the type to create through its generated parameter', async () => {
    const saved = (await one(
      `select public.apply_action_type($1::jsonb, $2::jsonb, $3::jsonb, '[]'::jsonb) as id`,
      [JSON.stringify({ api_name: 'open-ticket', label: 'Open ticket', ontology_id: ont }),
       JSON.stringify([{ api_name: 'key', display_name: 'Key', base_type: 'string', required: true, position: 0 }]),
       JSON.stringify([{ kind: 'create_object_of_interface', position: 0, interface_id: iface }])],
    )).id

    const p = await one(
      `select api_name, display_name, data_kind from public.action_type_parameters
        where action_type_id = $1 and data_kind = 'objectType'`, [saved])
    // The screenshot's label: the interface's name plus "type", not "Object type".
    expect(p.display_name).toBe('Ticket type')
    expect(p.api_name).toBe('ticketType')

    // No primary key among the rule's properties: the documented submission
    // failure, raised here rather than refused when the rule was configured.
    const err = await refused(db, () => db.query(
      `select public.apply_action($1, $2::jsonb)`,
      [saved, JSON.stringify({ key: 'BUG-42', ticketType: 'Bug' })]))
    expect(err).toMatch(/CreateNeedsPrimaryKey/)
  })

  it('refuses an object type the ontology does not have', async () => {
    const err = await refused(db, () => db.query(
      `select public.apply_action($1, $2::jsonb)`, [action, JSON.stringify({
        newSubject: 'x', ticket: { objectTypeApiName: 'Nope', primaryKeyValue: 'N-1' },
      })]))
    expect(err).toMatch(/InterfaceReferenceUnknownType/)
  })
})
