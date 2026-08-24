// The five `…of interface` action rule kinds.
//
// `action-types/rules` lists twelve; we carried seven, and the five interface
// variants were unblocked by 450 and unbuilt until 569. The governing sentence
// is one clause of `actions-on-interfaces`:
//
//   "you can use interface action rules only to modify the interface shared
//    properties"
//
// which is Phase C's design sentence — the declared property set is the edit
// permission — one level up. An interface rule naming a property some
// implementing type lacks would be an edit that cannot apply to all of them.
//
// None of the five executes yet, and the durable question is that they are
// *expressible and constrained*: a kind that cannot be modelled cannot be
// reasoned about, and one that claims execution it does not have is worse.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused, fixture, type Fixture } from './harness'

const INTERFACE_KINDS = [
  'create_object_of_interface',
  'modify_object_of_interface',
  'delete_object_of_interface',
  'create_link_on_object_of_interface',
  'delete_link_on_object_of_interface',
]

describe.skipIf(noDb)('action rules on interfaces', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let iface = ''
  let action = ''
  let objType = ''
  let objProp = ''
  let ifaceProp = ''
  let author = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'ifacerule569')
    // `fixture` sets claims without a `sub`, so auth.uid() is null and the
    // author columns have to be filled explicitly.
    author = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(),'00000000-0000-0000-0000-000000000000',
               'authenticated','authenticated','ifr569@beacon.test') returning id`)).id
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'ifr569','IFR569',false) returning id`, [f.spaceId])).id
    iface = (await one(
      `insert into public.ontology_interfaces (ontology_id, api_name, label, created_by_user_id)
       values ($1,'Serviceable','Serviceable',$2) returning id`, [ont, author])).id
    ifaceProp = (await one(
      `insert into public.interface_properties
         (interface_id, property_id, api_name, display_name, base_type)
       values ($1,'status','status','Status','string') returning id`, [iface])).id
    action = (await one(
      `insert into public.action_types (ontology_id, api_name, label)
       values ($1,'mark-serviced','Mark serviced') returning id`, [ont])).id
    objType = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'Aircraft569','Aircraft') returning id`, [ont, f.projectId])).id
    objProp = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, backing_column)
       values ($1,'tail','tail','Tail','string','tail') returning id`, [objType])).id
  })
  afterAll(async () => { await rollback(db) })

  it('registers the published twelve plus the schedule kind, five targeting an interface', async () => {
    const { rows } = await db.query(`select kind, targets, executable, note from public.action_rule_kinds()`)
    expect(rows.length).toBe(13)
    const iface = rows.filter((r) => (r as { targets: string }).targets === 'interface')
    expect(iface.map((r) => (r as { kind: string }).kind).sort()).toEqual([...INTERFACE_KINDS].sort())
  })

  it('the three object kinds execute and the two link kinds still say why not', async () => {
    // This assertion used to be "none of them execute". 592 and 593 changed that
    // for the three OBJECT kinds — the blockers were the parameter kinds and the
    // value encoding, both published in `api/` and neither needing inference.
    // A kind that claimed execution it does not have would still be worse than
    // one that is absent, so every kind still states its own reason.
    const { rows } = await db.query(
      `select kind, executable, note from public.action_rule_kinds() where targets = 'interface'`)
    for (const r of rows as { kind: string; executable: boolean; note: string }[]) {
      expect(r.executable, `${r.kind} executes iff it is an object rule`)
        .toBe(!r.kind.includes('link'))
      expect(r.note.length, `${r.kind} states what it does or why it cannot`).toBeGreaterThan(20)
    }
    // The two link kinds wait on the same thing their non-interface siblings do.
    const link = rows.filter((r) => (r as { kind: string }).kind.includes('link'))
    expect(link).toHaveLength(2)
    for (const r of link) expect((r as { note: string }).note).toContain('link instance store')
  })

  it('requires an interface, and refuses another target alongside it', async () => {
    const missing = await refused(db, () => db.query(
      `insert into public.action_type_rules (action_type_id, kind, position)
       values ($1,'modify_object_of_interface',1)`, [action]))
    expect(missing).toContain('Ontology:ActionRuleNeedsInterface')

    const both = await refused(db, () => db.query(
      `insert into public.action_type_rules (action_type_id, kind, position, interface_id, object_type_id)
       values ($1,'modify_object_of_interface',1,$2,$3)`, [action, iface, objType]))
    expect(both).toContain('Ontology:ActionRuleTargetMismatch')

    const wrongWay = await refused(db, () => db.query(
      `insert into public.action_type_rules (action_type_id, kind, position, interface_id, object_type_id)
       values ($1,'modify_object',1,$2,$3)`, [action, iface, objType]))
    expect(wrongWay).toContain('Ontology:ActionRuleTargetMismatch')
  })

  it('accepts a rule that writes the interface\'s own property', async () => {
    const rule = (await one(
      `insert into public.action_type_rules (action_type_id, kind, position, interface_id)
       values ($1,'modify_object_of_interface',1,$2) returning id`, [action, iface])).id
    await db.query(
      `insert into public.action_type_rule_properties
         (rule_id, interface_property_id, value_source, static_value)
       values ($1,$2,'static','"serviced"')`, [rule, ifaceProp])
    const n = await one(
      `select count(*)::int as n from public.action_type_rule_properties where rule_id = $1`, [rule])
    expect(Number(n.n)).toBe(1)
  })

  it('refuses an object type\'s property on an interface rule', async () => {
    // "you can use interface action rules only to modify the interface shared
    // properties". A rule naming Aircraft.tail is a rule about Aircraft however
    // it is labelled — and 569 shipped a guard that could not say so, because
    // the two property columns are different types and the join never ran.
    const rule = (await one(
      `insert into public.action_type_rules (action_type_id, kind, position, interface_id)
       values ($1,'delete_object_of_interface',2,$2) returning id`, [action, iface])).id
    const err = await refused(db, () => db.query(
      `insert into public.action_type_rule_properties
         (rule_id, property_id, value_source, static_value)
       values ($1,$2,'static','"x"')`, [rule, objProp]))
    expect(err).toContain('Ontology:InterfaceRuleWritesObjectProperty')
  })

  it('refuses another interface\'s property, from either direction', async () => {
    const otherIface = (await one(
      `insert into public.ontology_interfaces (ontology_id, api_name, label, created_by_user_id)
       values ($1,'Trackable','Trackable',$2) returning id`, [ont, author])).id
    const otherProp = (await one(
      `insert into public.interface_properties
         (interface_id, property_id, api_name, display_name, base_type)
       values ($1,'last_seen','lastSeen','Last seen','string') returning id`, [otherIface])).id
    const rule = (await one(
      `insert into public.action_type_rules (action_type_id, kind, position, interface_id)
       values ($1,'create_object_of_interface',4,$2) returning id`, [action, iface])).id

    const err = await refused(db, () => db.query(
      `insert into public.action_type_rule_properties
         (rule_id, interface_property_id, value_source, static_value)
       values ($1,$2,'static','"x"')`, [rule, otherProp]))
    expect(err).toContain('Ontology:InterfaceRuleWritesUndeclaredProperty')

    // The same edit arrives the other way round when the rule is moved to an
    // interface that never declared the property it already writes, which is
    // why the rule row re-checks and not only the property row.
    await db.query(
      `insert into public.action_type_rule_properties
         (rule_id, interface_property_id, value_source, static_value)
       values ($1,$2,'static','"x"')`, [rule, ifaceProp])
    const moved = await refused(db, () => db.query(
      `update public.action_type_rules set interface_id = $2 where id = $1`, [rule, otherIface]))
    expect(moved).toContain('Ontology:InterfaceRuleWritesUndeclaredProperty')
  })

  it('names exactly one property, and leaves object rules alone', async () => {
    const rule = (await one(
      `insert into public.action_type_rules (action_type_id, kind, position, interface_id)
       values ($1,'modify_object_of_interface',5,$2) returning id`, [action, iface])).id
    const both = await refused(db, () => db.query(
      `insert into public.action_type_rule_properties
         (rule_id, property_id, interface_property_id, value_source, static_value)
       values ($1,$2,$3,'static','"x"')`, [rule, objProp, ifaceProp]))
    expect(both).toContain('action_type_rule_properties_one_property')

    // This widens the table; it does not loosen it.
    const objRule = (await one(
      `insert into public.action_type_rules (action_type_id, kind, position, object_type_id)
       values ($1,'modify_object',6,$2) returning id`, [action, objType])).id
    await db.query(
      `insert into public.action_type_rule_properties
         (rule_id, property_id, value_source, static_value)
       values ($1,$2,'static','"N1"')`, [objRule, objProp])
    const err = await refused(db, () => db.query(
      `insert into public.action_type_rule_properties
         (rule_id, interface_property_id, value_source, static_value)
       values ($1,$2,'static','"x"')`, [objRule, ifaceProp]))
    expect(err).toContain('Ontology:ObjectRuleWritesInterfaceProperty')
  })

  it('expands to the concrete property each implementer mapped it onto (571)', async () => {
    // "You can use interface action rules whenever the edits can apply to all
    // the object types that implement the interface." Made concrete: the answer
    // to "what can this action write" is one row per implementing type, naming
    // that type's own property — which in Foundry's own example is `Title` on
    // Bug and `Summary` on Feature request for one interface `Subject`.
    const impl = async (apiName: string, prop: string) => {
      const t = (await one(
        `insert into public.object_types (ontology_id, project_id, api_name, label)
         values ($1,$2,$3,$3) returning id`, [ont, f.projectId, apiName])).id
      const p = (await one(
        `insert into public.object_type_properties
           (object_type_id, property_id, api_name, display_name, base_type, backing_column)
         values ($1,$2,$2,$2,'string',$2) returning id`, [t, prop])).id
      await db.query(
        `insert into public.object_type_interfaces (object_type_id, interface_id) values ($1,$2)`,
        [t, iface])
      await db.query(
        `insert into public.interface_implementation_mappings
           (object_type_id, interface_id, interface_property_id, resolution, object_property_id)
         values ($1,$2,$3,'choose_existing',$4)`, [t, iface, ifaceProp, p])
      return t
    }
    const bug = await impl('Bug571', 'title')
    await impl('FeatureRequest571', 'summary')

    const act = (await one(
      `insert into public.action_types (ontology_id, api_name, label)
       values ($1,'edit-ticket-571','Edit ticket') returning id`, [ont])).id
    const rule = (await one(
      `insert into public.action_type_rules (action_type_id, kind, position, interface_id)
       values ($1,'modify_object_of_interface',1,$2) returning id`, [act, iface])).id
    await db.query(
      `insert into public.action_type_rule_properties
         (rule_id, interface_property_id, value_source, static_value)
       values ($1,$2,'static','"x"')`, [rule, ifaceProp])

    const { rows } = await db.query(
      `select object_type, property from public.action_editable_properties($1) order by object_type`, [act])
    expect(rows).toEqual([
      { object_type: 'Bug571', property: 'title' },
      { object_type: 'FeatureRequest571', property: 'summary' },
    ])

    // Interface action control: the one per-object-type lever Foundry offers,
    // because "submission criteria apply uniformly across all object types".
    // 450 built the column and nothing read it until 571.
    await db.query(
      `update public.object_type_interfaces set interface_actions_enabled = false
        where object_type_id = $1 and interface_id = $2`, [bug, iface])
    const { rows: after } = await db.query(
      `select object_type from public.action_editable_properties($1)`, [act])
    expect(after).toEqual([{ object_type: 'FeatureRequest571' }])
  })

  it('keeps an interface rule inside its own ontology', async () => {
    const otherSpace = (await one(
      `insert into public.spaces (name) values ('ifr569b') returning id`)).id
    await db.query(
      `insert into public.space_organizations (space_id, organization_id) values ($1,$2)`,
      [otherSpace, f.orgId])
    const otherOnt = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'ifr569b','IFR569B',false) returning id`, [otherSpace])).id
    const otherIface = (await one(
      `insert into public.ontology_interfaces (ontology_id, api_name, label, created_by_user_id)
       values ($1,'Foreign','Foreign',$2) returning id`, [otherOnt, author])).id
    const err = await refused(db, () => db.query(
      `insert into public.action_type_rules (action_type_id, kind, position, interface_id)
       values ($1,'create_object_of_interface',3,$2)`, [action, otherIface]))
    expect(err).toContain('Ontology:ActionCrossesOntologies')
  })
})
