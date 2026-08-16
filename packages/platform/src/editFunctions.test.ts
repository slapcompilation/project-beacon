// Ontology edit functions, and the action that applies what they return.
//
// The rule the whole slice hangs on, from functions/edits-overview:
//   "The only way to update objects using a function is by configuring an
//    action to use the function"
//   "running an edit function outside of an Action will not actually modify
//    any object data"
//
// So the function returns a batch and the action writes it. These are the
// questions that keep true: the batch a version may produce is bounded by its
// declared provenance, the published ObjectEdit variants become the
// instructions the how-edits-applied flowchart names, link edits refuse, the
// SQL path refuses to run code it cannot run, and a function-backed action can
// be authored through the session the surface actually uses.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused } from './harness'

/** The exact shape `createEditBatch` emits in the isolate — asserted here so
 *  the guest harness and the SQL that consumes it cannot drift apart. */
const BATCH = {
  create: (objectType: string, primaryKey: string, properties: Record<string, unknown>) =>
    ({ addObject: { objectType, primaryKey, properties } }),
  update: (objectType: string, primaryKey: string, properties: Record<string, unknown>) =>
    ({ modifyObject: { objectType, primaryKey, properties } }),
  remove: (objectType: string, primaryKey: string) =>
    ({ deleteObject: { objectType, primaryKey } }),
  link: (linkTypeApiNameAtoB: string, a: unknown, b: unknown) =>
    ({ addLink: { linkTypeApiNameAtoB, aSideObject: a, bSideObject: b } }),
}

describe.skipIf(noDb)('edit functions', () => {
  let db: pg.Client
  let ont = ''
  let ticket = ''
  let other = ''
  let version = ''
  let action = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)

  beforeAll(async () => {
    db = await connect()
    const org = (await one(`insert into public.organizations (name) values ('editfn') returning id`)).id
    const usr = (await one('select gen_random_uuid() as id')).id
    const email = `editfn-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, email, org])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: org } })])
    await db.query('set local role authenticated')

    const space = (await one(`select public.create_space('Edit fn') as id`)).id
    ont = (await one(`insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
                      values ($1,'editfn','Edit fn',false) returning id`, [space])).id
    const proj = (await one(`insert into public.projects (organization_id, space_id, api_name, name)
                             values ($1,$2,'editfn','EditFn') returning id`, [org, space])).id
    // A datasource each: an object type is backed by its own dataset, and
    // sharing one makes the second save fail its own datasource check.
    const mkDatasource = async (slug: string) => {
      const ds = (await one(`insert into public.datasets (organization_id, project_id, api_name, name)
                             values ($1,$2,$3,$3) returning id`, [org, proj, slug])).id
      const br = (await one(`insert into public.dataset_branches (dataset_id, name)
                             values ($1,'master') returning id`, [ds])).id
      return { ds, br }
    }

    const mkType = async (api: string) => {
      const { ds, br } = await mkDatasource(`editfn_${api.toLowerCase()}`)
      const id = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
        JSON.stringify({ api_name: api, label: api, ontology_id: ont,
          datasources: [{ dataset_id: ds, branch_id: br }] }),
        JSON.stringify([{ property_id: 'pk', display_name: 'Id', api_name: 'id',
          base_type: 'string', source: 'column', backing_column: 'pk',
          is_primary_key: true, is_title_key: true, required: true }]),
      ])).id
      await db.query('select public.save_working_state()')
      await db.query('update public.object_types set edits_enabled = true where id = $1', [id])
      return id
    }
    ticket = await mkType('Ticket')
    other = await mkType('Aircraft')

    const fn = (await one(
      `insert into public.functions (ontology_id, project_id, api_name, display_name)
       values ($1,$2,'escalateTicket','Escalate ticket') returning id`, [ont, proj])).id
    version = (await one(
      `insert into public.function_versions
         (function_id, major, minor, patch, source, signature, imports, edits)
       values ($1,1,0,0,'export default function f(){ return [] }',$2::jsonb,$3::jsonb,$4::jsonb)
       returning id`, [fn,
        JSON.stringify({ parameters: [{ name: 'ticketId', type: 'string', required: true }],
          returns: 'OntologyEdit[]' }),
        JSON.stringify({ object_types: ['Ticket'], link_types: [] }),
        JSON.stringify({ object_types: ['Ticket'] })])).id
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  // ── the declaration ───────────────────────────────────────────────────────

  it('an edit function declares provenance and a query function does not', async () => {
    const fn = (await one(
      `insert into public.functions (ontology_id, project_id, api_name, display_name)
       values ($1, (select project_id from public.functions limit 1),'countTickets','Count') returning id`,
      [ont])).id
    const publish = (returns: string, edits: string[]) =>
      db.query(
        `insert into public.function_versions
           (function_id, major, minor, patch, source, signature, imports, edits)
         values ($1,1,0,0,'export default function f(){}',$2::jsonb,
                 '{"object_types":[],"link_types":[]}'::jsonb,$3::jsonb)`,
        [fn, JSON.stringify({ parameters: [], returns }), JSON.stringify({ object_types: edits })])

    // "You must then declare that the function returns an array of edits."
    expect(await refused(db, () => publish('OntologyEdit[]', []))).toContain('edits_valid')
    expect(await refused(db, () => publish('Integer', ['Ticket']))).toContain('edits_valid')
    await publish('OntologyEdit[]', ['Ticket'])
    expect(await count(
      `select count(*) n from public.function_versions where function_id = $1`, [fn])).toBe(1)
  })

  it('provenance names an object type that exists here', async () => {
    const err = await refused(db, () => db.query(
      `update public.function_versions set edits = '{"object_types":["Nonexistent"]}'::jsonb
        where id = $1`, [version]))
    expect(err).toContain('Functions:UnknownEditedObjectType')
  })

  // ── the rule ──────────────────────────────────────────────────────────────

  it('a function rule pins a version, and only an edit function', async () => {
    action = (await one(`select public.save_action_type($1::jsonb) as id`, [JSON.stringify({
      api_name: 'escalate', label: 'Escalate', ontology_id: ont,
      parameters: [{ api_name: 'ticketId', display_name: 'Ticket', base_type: 'string',
        required: true, position: 0 }],
      rules: [{ kind: 'function', position: 0, function_name: 'escalateTicket',
        function_version_id: version,
        inputs: [{ input_name: 'ticketId', parameter_api_name: 'ticketId' }] }],
    })])).id
    await db.query('select public.save_working_state()')

    // The session carried all three things 444 used to drop.
    const rule = await one(
      `select function_version_id, auto_upgrade from public.action_type_rules
        where action_type_id = $1`, [action])
    expect(rule.function_version_id).toBe(version)
    expect(rule.auto_upgrade).toBe(false)
    expect(await count(
      `select count(*) n from public.action_type_rule_inputs i
         join public.action_type_rules r on r.id = i.rule_id
        where r.action_type_id = $1 and i.input_name = 'ticketId'`, [action])).toBe(1)
  })

  // 509 stored `auto_upgrade` from the Run function card's "Auto upgrade to
  // compatible versions" toggle and nothing ever read it. 538 made it mean what
  // the page says it means: a caret range on the pinned version, resolved to
  // "the maximum satisfying version". Asked on every run, because a resolver
  // that silently reverts to the pin is indistinguishable from one that works.
  it('auto upgrade moves within the caret, and never past a major', async () => {
    const rule = (await one(
      `select id, function_version_id from public.action_type_rules
        where action_type_id = $1 and kind = 'function'`, [action]))
    // The same signature as the pin: dropping `ticketId` would be a breaking
    // change, and `Functions:BreakingChangeNeedsMajor` refuses it inside a
    // minor — which is exactly the compatibility a caret range relies on.
    const sig = JSON.stringify({
      parameters: [{ name: 'ticketId', type: 'string', required: true }],
      returns: 'OntologyEdit[]',
    })
    const eds = JSON.stringify({ object_types: ['Ticket'] })
    // A compatible release and a breaking one land after the pin (1.0.0).
    await db.query(
      `insert into public.function_versions
         (function_id, major, minor, patch, source, signature, edits)
       select v.function_id, 1, 1, 0, 'export default () => 2', $2::jsonb, $3::jsonb
         from public.function_versions v where v.id = $1`, [rule.function_version_id, sig, eds])
    await db.query(
      `insert into public.function_versions
         (function_id, major, minor, patch, source, signature, edits)
       select v.function_id, 2, 0, 0, 'export default () => 3', $2::jsonb, $3::jsonb
         from public.function_versions v where v.id = $1`, [rule.function_version_id, sig, eds])

    // Off: the pin holds even though newer versions exist.
    expect((await one('select public.action_rule_version($1) as v', [rule.id])).v)
      .toBe(rule.function_version_id)

    await db.query('update public.action_type_rules set auto_upgrade = true where id = $1', [rule.id])
    const resolved = (await one(
      `select public.function_version_string(major, minor, patch, prerelease) as s
         from public.function_versions where id = public.action_rule_version($1)`, [rule.id])).s
    expect(resolved).toBe('1.1.0')

    // And the payload the runner receives reports the version it will run.
    const payload = (await one(
      'select public.action_function_to_run($1) as p', [action])).p as unknown as { version: string }
    expect(payload.version).toBe('1.1.0')

    // The rule is shared with the cases below, which expect the pin. Left on,
    // this reads as those cases failing rather than as this one leaking.
    await db.query('update public.action_type_rules set auto_upgrade = false where id = $1', [rule.id])
  })

  it('refuses a function rule with no version, and a version on another kind', async () => {
    const act = (await one(
      `insert into public.action_types (ontology_id, api_name, label)
       values ($1,'bare-fn','Bare') returning id`, [ont])).id
    expect(await refused(db, () => db.query(
      `insert into public.action_type_rules (action_type_id, kind, function_name)
       values ($1,'function','escalateTicket')`, [act])))
      .toContain('Actions:FunctionRuleNeedsVersion')
    expect(await refused(db, () => db.query(
      `insert into public.action_type_rules (action_type_id, kind, object_type_id, function_version_id)
       values ($1,'create_object',$2,$3)`, [act, ticket, version])))
      .toContain('Actions:FunctionVersionOnNonFunctionRule')
  })

  it('gives the runtime the source, the pinned version and the input mapping', async () => {
    const payload = (await one(
      'select public.action_function_to_run($1) as p', [action])).p as unknown as Record<string, unknown>
    expect(payload.version).toBe('1.0.0')
    expect(payload.api_name).toBe('escalateTicket')
    expect(payload.edits).toEqual(['Ticket'])
    expect(payload.inputs).toEqual({ ticketId: 'ticketId' })
  })

  // ── the apply ─────────────────────────────────────────────────────────────

  it('writes the published edit variants as the flowchart instructions', async () => {
    const n = Number((await one('select public.apply_function_edits($1,$2::jsonb) as n', [
      action, JSON.stringify([
        BATCH.create('Ticket', 'T-1', { status: 'open' }),
        BATCH.update('Ticket', 'T-2', { status: 'escalated' }),
        BATCH.remove('Ticket', 'T-3'),
      ])])).n)
    expect(n).toBe(3)
    const rows = (await db.query(
      `select primary_key, instruction from public.object_edits
        where action_type_id = $1 order by primary_key`, [action])).rows
    expect(rows.map((r) => (r as { instruction: string }).instruction))
      .toEqual(['create', 'modify', 'delete'])
  })

  it('fails the action when an edit names a type outside the provenance', async () => {
    // Aircraft is a real, editable object type in the same ontology — the only
    // thing wrong with it is that this version did not declare it.
    expect(await count('select count(*) n from public.object_types where id = $1', [other])).toBe(1)
    const err = await refused(db, () => db.query(
      'select public.apply_function_edits($1,$2::jsonb)',
      [action, JSON.stringify([BATCH.update('Aircraft', 'A-1', {})])]))
    expect(err).toContain('Functions:UndeclaredObjectTypeEdited')
  })

  it('refuses a link edit by name', async () => {
    const err = await refused(db, () => db.query(
      'select public.apply_function_edits($1,$2::jsonb)',
      [action, JSON.stringify([BATCH.link('tickets',
        { objectType: 'Ticket', primaryKey: 'T-1' }, { objectType: 'Ticket', primaryKey: 'T-2' })])]))
    expect(err).toContain('Actions:LinkEditsNotSupported')
  })

  it('refuses an output that is not the published shape', async () => {
    for (const bad of ['[{"renameObject":{"objectType":"Ticket","primaryKey":"T"}}]',
                       '[{"modifyObject":{"objectType":"Ticket"}}]']) {
      const err = await refused(db, () => db.query(
        'select public.apply_function_edits($1,$2::jsonb)', [action, bad]))
      expect(err).toContain('Actions:InvalidOutput')
    }
  })

  it('sends the rule to the runtime that can run it, and never runs it in SQL', async () => {
    const err = await refused(db, () => db.query(
      'select public.apply_action($1,$2::jsonb)', [action, JSON.stringify({ ticketId: 'T-1' })]))
    expect(err).toContain('Actions:WrongRuntime')

    // The registry is the one place that says so.
    const kind = await one(
      `select executable, runtime from public.action_rule_kinds() where kind = 'function'`)
    expect(kind.executable).toBe(true)
    expect(kind.runtime).toBe('function')
  })

  // 418 admitted object_parameter_property and apply_action's CASE never
  // handled it, so a rule declaring it wrote NULL into the property instead of
  // refusing. A declarable value that produces a wrong answer is worse than one
  // that refuses.
  it('refuses a value source it cannot resolve instead of writing NULL', async () => {
    const act = (await one(
      `insert into public.action_types (ontology_id, api_name, label)
       values ($1,'objparam','Obj param') returning id`, [ont])).id
    const par = (await one(
      `insert into public.action_type_parameters (action_type_id, api_name, display_name, base_type, required)
       values ($1,'ref','Ref','string',true) returning id`, [act])).id
    const rule = (await one(
      `insert into public.action_type_rules (action_type_id, kind, position, object_type_id)
       values ($1,'modify_object',0,$2) returning id`, [act, ticket])).id
    const prop = (await one(
      `select id from public.object_type_properties where object_type_id = $1`, [ticket])).id
    await db.query(
      `insert into public.action_type_rule_properties (rule_id, property_id, value_source, parameter_id)
       values ($1,$2,'object_parameter_property',$3)`, [rule, prop, par])

    const err = await refused(db, () => db.query(
      'select public.apply_action($1,$2::jsonb,$3)', [act, JSON.stringify({ ref: 'T-1' }), 'T-1']))
    expect(err).toContain('Actions:ValueSourceNotExecutable')
  })
})
