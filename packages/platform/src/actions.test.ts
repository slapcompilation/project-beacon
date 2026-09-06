// Actions, as regression tests rather than migration assertions.
//
// Migrations 444–449 assert all of this once, at the moment each landed, and
// never again — applied migrations are immutable and run once. These are the
// same invariants asked on every CI run: the whole-action session, the
// lifecycle protections, the array element rules, the executable-kind
// registry, the apply path and the criteria gate.
//
// Everything runs as `authenticated`; the fixture is one org, one ontology,
// one Ticket type with edits enabled.

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

describe.skipIf(noDb)('actions', () => {
  let db: pg.Client
  let ont: string
  let type: string
  let pid: string
  let statusPid: string
  let action: string
  let org: string
  let claims: string

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)

  beforeAll(async () => {
    db = await connect()
    org = (await one(`insert into public.organizations (name) values ('act-regress') returning id`)).id
    await admin(db, org, `act-${Date.now()}@beacon.test`)
    claims = (await one(`select current_setting('request.jwt.claims', true) as c`)).c
    await db.query('set local role authenticated')

    const space = (await one(`select public.create_space('Act regress') as id`)).id
    await db.query(`delete from public.ontologies where space_id = '${space}'`)
    ont = (await one(`insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
                      values ('${space}','actregress','Act regress',false) returning id`)).id
    const proj = (await one(`insert into public.projects (organization_id, space_id, api_name, name)
                             values ($1,$2,'actr','ActR') returning id`, [org, space])).id
    const ds = (await one(`insert into public.datasets (organization_id, project_id, api_name, name)
                           values ($1,$2,'actds','actds') returning id`, [org, proj])).id
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
    await db.query('update public.object_types set edits_enabled = true where id = $1', [type])
    pid = (await one(`select id from public.object_type_properties
                       where object_type_id = $1 and property_id = 'ticket_id'`, [type])).id
    // A non-key property names the datasource it comes from, so it joins after
    // the save that made the datasource (760's cases modify it).
    statusPid = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id, required)
       values ($1, 'status', 'Status', 'status', 'string', 'column', 'status',
               (select id from public.object_type_datasources where object_type_id = $1), false)
       returning id`, [type])).id
  })
  afterAll(async () => { await rollback(db) })

  // ── 444: the whole-action session ─────────────────────────────────────────
  it('stages a whole action as one entry and lands it whole', async () => {
    action = (await one(`select public.save_action_type($1::jsonb) as id`, [JSON.stringify({
      api_name: 'escalate', label: 'Escalate', ontology_id: ont,
      parameters: [
        { api_name: 'ticketId', display_name: 'Ticket', base_type: 'string', required: true, position: 0 },
        { api_name: 'severity', display_name: 'Severity', base_type: 'string', required: true, position: 1 },
      ],
      rules: [{
        kind: 'create_object', position: 0, object_type_id: type,
        properties: [{ property_id: pid, value_source: 'parameter', parameter_api_name: 'ticketId' }],
      }],
      criteria: [
        { key: 'root', node_type: 'logical', logical_operator: 'all', position: 0,
          failure_message: 'Escalation requirements not met.' },
        { key: 'c1', parent_key: 'root', node_type: 'condition', position: 0,
          template: 'parameter', parameter_api_name: 'severity',
          operator: 'is not', value_source: 'static', static_value: 'low',
          failure_message: 'Low severity tickets are not escalated.' },
      ],
    })])).id
    expect(await count('select count(*) n from public.working_state_changes')).toBe(1)
    expect(await count('select count(*) n from public.action_types where id = $1', [action])).toBe(0)

    await db.query('select public.save_working_state()')
    expect(await count('select count(*) n from public.action_type_parameters where action_type_id = $1', [action])).toBe(2)
    expect(await count('select count(*) n from public.action_type_rules where action_type_id = $1', [action])).toBe(1)
    // Natural keys resolved on land: the rule property found its parameter…
    expect(await count(
      `select count(*) n from public.action_type_rule_properties rp
        join public.action_type_rules r on r.id = rp.rule_id
       where r.action_type_id = $1 and rp.parameter_id is not null`, [action])).toBe(1)
    // …and the criterion found its parent group.
    expect(await count(
      `select count(*) n from public.action_type_submission_criteria
        where action_type_id = $1 and parent_id is not null`, [action])).toBe(1)
  })

  it('leaves every section standing through a label-only edit', async () => {
    await db.query(`select public.save_action_type($1::jsonb)`,
      [JSON.stringify({ id: action, label: 'Escalate ticket' })])
    await db.query('select public.save_working_state()')
    expect(await count('select count(*) n from public.action_type_parameters where action_type_id = $1', [action])).toBe(2)
    expect(await count('select count(*) n from public.action_type_submission_criteria where action_type_id = $1', [action])).toBe(2)
  })

  // ── 446: the registry says what executes ──────────────────────────────────
  // 509 split the fact this used to assert. `executable` is now "can be
  // applied at all" and a function rule is — by the action runtime, which owns
  // the isolate. What apply_action can run is the SQL-runtime subset, and that
  // is still three.
  it('has exactly ten kinds apply_action can run, said by the registry', async () => {
    // Three since 445; the three interface OBJECT rules joined them at 592/593,
    // the two LINK rules at 755, once the pair store existed for their edits,
    // and create-or-modify at 760, once the merged object could be asked
    // whether it exists. The two interface LINK rules still wait — the rule
    // must name an interface link constraint, which no rule column points at.
    expect(await count(
      `select count(*) n from public.action_rule_kinds() where executable and runtime = 'sql'`)).toBe(10)
    expect(await count('select count(*) n from public.action_rule_kinds() where executable')).toBe(11)
    expect(await count('select count(*) n from public.action_rule_kinds()')).toBe(13)
    // The ones still waiting, by name, so this fails loudly if one quietly flips.
    expect((await db.query(
      `select kind from public.action_rule_kinds() where not executable order by kind`)).rows
      .map((r) => (r as { kind: string }).kind)).toEqual([
        'create_link_on_object_of_interface',
        'delete_link_on_object_of_interface',
      ])
  })

  // ── 445 + 449: the apply path and its gates ───────────────────────────────
  it('requires the required parameters by name', async () => {
    const why = await refused(db, () =>
      db.query(`select public.apply_action($1, '{"severity":"high"}'::jsonb)`, [action]))
    expect(why).toMatch(/MissingParameter.*ticketId/)
  })

  it('refuses a failing criterion with its own words', async () => {
    const why = await refused(db, () =>
      db.query(`select public.apply_action($1, '{"ticketId":"T-9","severity":"low"}'::jsonb)`, [action]))
    expect(why).toMatch(/Low severity tickets are not escalated\./)
  })

  // "action submission criteria are hidden from users who cannot edit action
  // types" — and the gate still has to fire for them, which is the half a
  // policy change alone would have lost (607).
  it('hides the criteria from a non-editor and still refuses them by name', async () => {
    // same org, a role that is not owner or admin: can see the action type,
    // cannot edit it
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: '00000000-0000-0000-0000-0000000000aa',
        app_metadata: { role: 'user', org_id: org } })])
    try {
      expect(await one('select public.can_read_action_type($1) v', [action])).toEqual({ v: true })
      expect(await one('select public.can_write_action_type($1) v', [action])).toEqual({ v: false })
      expect(await count(`select count(*) n from public.action_type_submission_criteria
                           where action_type_id = $1`, [action])).toBe(0)
      const v = await one(`select public.submission_criteria_verdict($1,
        '{"ticketId":"T-9","severity":"low"}'::jsonb) as v`, [action])
      expect(v.v).toMatch(/Low severity/)
    } finally {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
    }
  })

  it('gives the form a pre-check that matches the gate', async () => {
    const bad = await one(`select public.submission_criteria_verdict($1,
      '{"ticketId":"T-9","severity":"low"}'::jsonb) as v`, [action])
    expect(bad.v).toMatch(/Low severity/)
    const good = await one(`select public.submission_criteria_verdict($1,
      '{"ticketId":"T-9","severity":"high"}'::jsonb) as v`, [action])
    expect(good.v).toBeNull()
  })

  it('applies a passing form into the edit log, attributed', async () => {
    expect(await count(`select public.apply_action($1, '{"ticketId":"T-9","severity":"high"}'::jsonb) n`,
      [action])).toBe(1)
    expect(await count(
      `select count(*) n from public.object_edits
        where object_type_id = $1 and primary_key = 'T-9'
          and instruction = 'create' and action_type_id = $2`, [type, action])).toBe(1)
  })

  // "3. Create or modify object(s): Can be used to modify an existing object
  // based on an object reference parameter. If an object is not selected, a
  // new object will be created with either an automatically generated unique
  // ID, or with a user submitted primary key." — 760, through the front door.
  it('a create-or-modify rule creates when nothing is selected and modifies when it is (760)', async () => {
    // The Gaia card: "Modify existing selected" through an object parameter,
    // "Or create a new object with" → Auto-generated primary key.
    const upsert = (await one(`select public.save_action_type($1::jsonb) as id`, [JSON.stringify({
      api_name: 'upsert-ticket', label: 'Upsert ticket', ontology_id: ont,
      parameters: [
        { api_name: 'ticket', display_name: 'Ticket', data_kind: 'object', object_type_id: type, required: false, position: 0 },
        { api_name: 'status', display_name: 'Status', base_type: 'string', required: true, position: 1 },
      ],
      rules: [{
        kind: 'create_or_modify_object', position: 0, object_type_id: type,
        object_parameter_api_name: 'ticket', create_new_object_with: 'auto_generated_primary_key',
        properties: [{ property_id: statusPid, value_source: 'parameter', parameter_api_name: 'status' }],
      }],
    })])).id
    await db.query('select public.save_working_state()')
    expect((await one(`select create_new_object_with as w, object_parameter_id is not null as p
                        from public.action_type_rules where action_type_id = $1`, [upsert])))
      .toEqual({ w: 'auto_generated_primary_key', p: true })

    // nothing selected: a create — "Foundry will automatically generate a unique ID"
    expect(await count(`select public.apply_action($1, '{"status":"open"}'::jsonb) n`, [upsert])).toBe(1)
    const created = await one(`select primary_key, properties from public.object_edits
                                where action_type_id = $1 and instruction = 'create'`, [upsert])
    expect(created.primary_key).toMatch(/^[0-9a-f-]{36}$/)
    expect((created.properties as unknown as Record<string, string>).status).toBe('open')

    // selected through the parameter: a modify of that object, with its before-image
    expect(await count(`select public.apply_action($1, $2::jsonb) n`,
      [upsert, JSON.stringify({ ticket: created.primary_key, status: 'closed' })])).toBe(1)
    const modified = await one(`select properties, "before" from public.object_edits
                                 where action_type_id = $1 and instruction = 'modify'`, [upsert])
    expect((modified.properties as unknown as Record<string, string>).status).toBe('closed')
    expect((modified.before as unknown as Record<string, string>).status).toBe('open')
    expect(await count(`select count(*) n from public.object_edits where action_type_id = $1`, [upsert])).toBe(2)

    // a key that names no object is not a create — "the parameter value must be
    // the primary key of an object found within an object set"
    expect(await refused(db, () => db.query(
      `select public.apply_action($1, '{"ticket":"NOPE","status":"x"}'::jsonb)`, [upsert]))).toMatch(/Actions:ObjectNotFound/)

    // the parameter named but blank: the caller's selection still stands — a
    // modify of the selected object, not a second create
    expect(await count(`select public.apply_action($1, '{"status":"reopened"}'::jsonb, $2) n`,
      [upsert, created.primary_key])).toBe(1)
    expect(await count(`select count(*) n from public.object_edits where action_type_id = $1 and instruction = 'create'`, [upsert])).toBe(1)
    expect(await count(`select count(*) n from public.object_edits
                         where action_type_id = $1 and instruction = 'modify' and primary_key = $2`, [upsert, created.primary_key])).toBe(2)
  })

  it('a create-or-modify rule with a user-submitted key takes it from its properties, and the selection from the caller (760)', async () => {
    // No object parameter: "Modify existing selected" is the caller's selection
    // (the Explorer's p_primary_key); "a user submitted primary key" is the
    // mapped key, the create_object contract unchanged.
    const upsert = (await one(`select public.save_action_type($1::jsonb) as id`, [JSON.stringify({
      api_name: 'upsert-ticket-keyed', label: 'Upsert ticket, keyed', ontology_id: ont,
      parameters: [
        { api_name: 'ticketId', display_name: 'Ticket', base_type: 'string', required: false, position: 0 },
        { api_name: 'status', display_name: 'Status', base_type: 'string', required: true, position: 1 },
      ],
      rules: [{
        kind: 'create_or_modify_object', position: 0, object_type_id: type,
        create_new_object_with: 'user_submitted_primary_key',
        properties: [
          { property_id: pid, value_source: 'parameter', parameter_api_name: 'ticketId' },
          { property_id: statusPid, value_source: 'parameter', parameter_api_name: 'status' },
        ],
      }],
    })])).id
    await db.query('select public.save_working_state()')

    // no key submitted and nothing selected: the create has no key
    expect(await refused(db, () => db.query(
      `select public.apply_action($1, '{"status":"open"}'::jsonb)`, [upsert]))).toMatch(/Actions:CreateNeedsPrimaryKey/)
    // the submitted key creates
    expect(await count(`select public.apply_action($1, '{"ticketId":"T-760","status":"open"}'::jsonb) n`, [upsert])).toBe(1)
    expect(await count(`select count(*) n from public.object_edits
                         where action_type_id = $1 and instruction = 'create' and primary_key = 'T-760'`, [upsert])).toBe(1)
    // the caller's selection modifies it; the mapped key stands aside
    expect(await count(`select public.apply_action($1, '{"ticketId":"other","status":"closed"}'::jsonb, 'T-760') n`, [upsert])).toBe(1)
    expect(await count(`select count(*) n from public.object_edits
                         where action_type_id = $1 and instruction = 'modify' and primary_key = 'T-760'
                           and properties = '{"status":"closed"}'::jsonb`, [upsert])).toBe(1)
  })

  it('the save generates the card into parameters, and a modify finds a required property on the merged object (760)', async () => {
    // A type whose title is required: the create must carry it, the modify
    // through the object parameter may leave it out — the required-properties
    // fallback reads the key the rule edits, not the caller's (760 fixed that).
    // its own dataset — a datasource backs one object type (417)
    const home = await one(
      `select d.organization_id, d.project_id from public.datasets d
         join public.object_type_datasources o on o.dataset_id = d.id where o.object_type_id = $1`, [type])
    const ds2 = (await one(`insert into public.datasets (organization_id, project_id, api_name, name)
                            values ($1,$2,'task760ds','task760ds') returning id`, [home.organization_id, home.project_id])).id
    const br2 = (await one(`insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [ds2])).id
    const task = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
      JSON.stringify({ api_name: 'Task760', label: 'Task 760', ontology_id: ont,
        datasources: [{ dataset_id: ds2, branch_id: br2 }] }),
      JSON.stringify([
        { property_id: 'task_id', display_name: 'Task Id', api_name: 'taskId', base_type: 'string',
          source: 'column', backing_column: 'task_id', is_primary_key: true, is_title_key: true, required: true },
      ]),
    ])).id
    await db.query('select public.save_working_state()')
    await db.query('update public.object_types set edits_enabled = true where id = $1', [task])
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id, required)
       select $1, v.pid, v.dn, v.an, 'string', 'column', v.pid,
              (select id from public.object_type_datasources where object_type_id = $1), v.req
         from (values ('title', 'Title', 'title', true), ('status', 'Status', 'status', false)) as v(pid, dn, an, req)`,
      [task])
    const prop = async (p: string) =>
      (await one(`select id from public.object_type_properties where object_type_id = $1 and property_id = $2`, [task, p])).id

    // no object parameter named, auto-generated key: the save generates both
    const upsert = (await one(`select public.save_action_type($1::jsonb) as id`, [JSON.stringify({
      api_name: 'upsert-task', label: 'Upsert task', ontology_id: ont,
      parameters: [
        { api_name: 'title', display_name: 'Title', base_type: 'string', required: false, position: 0 },
        { api_name: 'status', display_name: 'Status', base_type: 'string', required: true, position: 1 },
      ],
      rules: [{
        kind: 'create_or_modify_object', position: 0, object_type_id: task,
        create_new_object_with: 'auto_generated_primary_key',
        properties: [
          { property_id: await prop('title'), value_source: 'parameter', parameter_api_name: 'title' },
          { property_id: await prop('status'), value_source: 'parameter', parameter_api_name: 'status' },
        ],
      }],
    })])).id
    await db.query('select public.save_working_state()')
    // the chip is a parameter named after the type; the key row is the Unique
    // Identifier mapping type, which names no parameter (761)
    const generated = await one(
      `select pa.api_name as obj, pa.data_kind as kind, pa.exposed as exposed,
              (select rp.value_source from public.action_type_rule_properties rp
                 join public.object_type_properties p on p.id = rp.property_id
                where rp.rule_id = r.id and p.is_primary_key) as key_source,
              (select count(*) from public.action_type_parameters g
                where g.action_type_id = r.action_type_id and 'generate_uuid' = any (g.type_classes)) as minted
         from public.action_type_rules r join public.action_type_parameters pa on pa.id = r.object_parameter_id
        where r.action_type_id = $1`, [upsert])
    expect(generated).toEqual({ obj: 'task760', kind: 'object', exposed: true, key_source: 'unique_identifier', minted: '0' })

    // the create carries the required title
    expect(await count(`select public.apply_action($1, '{"title":"first","status":"open"}'::jsonb) n`, [upsert])).toBe(1)
    const key = (await one(`select primary_key from public.object_edits
                             where action_type_id = $1 and instruction = 'create'`, [upsert])).primary_key
    expect(key).toMatch(/^[0-9a-f-]{36}$/)

    // a second card mapping only the status: modifying the object it selects
    // passes because the required title is found on the merged object — an
    // object no index has built — while creating through it is refused
    const close = (await one(`select public.save_action_type($1::jsonb) as id`, [JSON.stringify({
      api_name: 'close-task', label: 'Close task', ontology_id: ont,
      parameters: [{ api_name: 'status', display_name: 'Status', base_type: 'string', required: true, position: 0 }],
      rules: [{
        kind: 'create_or_modify_object', position: 0, object_type_id: task,
        create_new_object_with: 'auto_generated_primary_key',
        properties: [{ property_id: await prop('status'), value_source: 'parameter', parameter_api_name: 'status' }],
      }],
    })])).id
    await db.query('select public.save_working_state()')
    expect(await count(`select public.apply_action($1, $2::jsonb) n`,
      [close, JSON.stringify({ task760: key, status: 'closed' })])).toBe(1)
    expect((await one(`select properties from public.object_edits where action_type_id = $1`, [close])).properties)
      .toEqual({ status: 'closed' })
    expect(await refused(db, () => db.query(
      `select public.apply_action($1, '{"status":"x"}'::jsonb)`, [close]))).toMatch(/Actions:RequiredPropertyMissing/)
  })

  // "by default, new object types only allow edits via actions" — so the same
  // edit the action just wrote is refused when written directly, as the caller
  // rather than through apply_action. 605's arm, asked as `authenticated`.
  it('refuses a direct edit on a type that only allows edits via actions', async () => {
    expect(await one('select only_edits_via_actions v from public.object_types where id = $1',
      [type])).toEqual({ v: true })
    const why = await refused(db, () => db.query(
      `insert into public.object_edits (object_type_id, primary_key, instruction, properties)
       values ($1,'T-DIRECT','create','{}'::jsonb)`, [type]))
    expect(why).toMatch(/Actions:PermissionDenied/)

    // and with the toggle off it is the reopened mode the page discourages
    await db.query('update public.object_types set only_edits_via_actions = false where id = $1', [type])
    await db.query(
      `insert into public.object_edits (object_type_id, primary_key, instruction, properties)
       values ($1,'T-DIRECT','create','{}'::jsonb)`, [type])
    await db.query('update public.object_types set only_edits_via_actions = true where id = $1', [type])
  })

  it('refuses to edit a type whose edits are disabled', async () => {
    await db.query('update public.object_types set edits_enabled = false where id = $1', [type])
    const why = await refused(db, () =>
      db.query(`select public.apply_action($1, '{"ticketId":"T-10","severity":"high"}'::jsonb)`, [action]))
    expect(why).toMatch(/EditsDisabled/)
    await db.query('update public.object_types set edits_enabled = true where id = $1', [type])
  })

  // ── 447: the lifecycle protections ────────────────────────────────────────
  it('protects an active resource from deletion and rename', async () => {
    await db.query(`update public.action_types set status = 'active' where id = $1`, [action])
    expect(await refused(db, () =>
      db.query('delete from public.action_types where id = $1', [action]))).toMatch(/ActiveResourceIsProtected/)
    expect(await refused(db, () =>
      db.query(`update public.action_types set api_name = 'renamed' where id = $1`, [action]))).toMatch(/ApiNameIsFixed/)
    await db.query(`update public.action_types set status = 'experimental' where id = $1`, [action])
  })

  it('lets only experimental rename', async () => {
    await db.query(`update public.action_types set api_name = 'escalate-2' where id = $1`, [action])
    await db.query(
      `update public.action_types set status='deprecated',
         deprecation_reason='Superseded', deprecation_deadline=current_date + 30 where id = $1`, [action])
    expect(await refused(db, () =>
      db.query(`update public.action_types set api_name = 'renamed' where id = $1`, [action]))).toMatch(/ApiNameIsFixed/)
    await db.query(`update public.action_types set status = 'experimental',
      deprecation_reason = null, deprecation_deadline = null where id = $1`, [action])
  })

  // ── 469: rules compile in order ───────────────────────────────────────────
  it('refuses the unsupported rule combinations by their own words', async () => {
    const a2 = (await one(`insert into public.action_types (ontology_id, api_name, label)
                           values ($1,'rule-order','Rule order') returning id`, [ont])).id
    const probe = async (rows: string) => await refused(db, async () => {
      await db.query(`insert into public.action_type_rules (action_type_id, kind, position, object_type_id)
                      values ${rows}`, [a2, type])
      await db.query('set constraints all immediate')
    })
    expect(await probe(`($1,'create_object',0,$2), ($1,'create_object',1,$2)`))
      .toContain('created twice in one form submission')
    expect(await probe(`($1,'modify_object',0,$2), ($1,'create_object',1,$2)`))
      .toContain('modified before they are added')
    expect(await probe(`($1,'delete_object',0,$2), ($1,'create_object',1,$2)`))
      .toContain('deleted before they are added or modified')
  })

  // ── 456: a deprecated action documents itself ─────────────────────────────
  it('refuses an undocumented deprecation', async () => {
    expect(await refused(db, () =>
      db.query(`update public.action_types set status='deprecated' where id = $1`, [action])))
      .toMatch(/deprecation_documented/)
  })

  // ── 448: arrays declare their element ─────────────────────────────────────
  it('records an array element and refuses the documented exclusions', async () => {
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type,
          array_element_type, source, backing_column,
          datasource_id)
       values ($1, 'tags', 'Tags', 'tags', 'array', 'string', 'column', 'tags',
               (select id from public.object_type_datasources where object_type_id = $1))`, [type])
    expect((await one(`select array_element_type from public.object_type_properties
                        where object_type_id = $1 and property_id = 'tags'`, [type])).array_element_type).toBe('string')

    expect(await refused(db, () => db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, array_element_type, source, backing_column)
       values ($1, 'bad', 'Bad', 'bad', 'array', 'array', 'column', 'bad')`, [type]))).toMatch(/check/)

    // The title rule composes through the element: markings cannot title.
    expect(await refused(db, () => db.query(
      `update public.object_type_properties
          set array_element_type = 'marking', is_title_key = true
        where object_type_id = $1 and property_id = 'tags'`, [type]))).toMatch(/check/)
  })

  // ── 762: the write half of the usage ledger ───────────────────────────────
  // "A write is recorded when an application makes edits to objects of this
  // type as the result of an Action … one write represents one edit request …
  // Many objects edited in bulk at once will only be recorded as a single
  // write." The doors are asked here because this is where an apply happens.
  it('records one write per resource an edit request touched, and only for a caller that names itself (762)', async () => {
    await db.query(
      `update public.ontologies set metrics_enabled = true,
              metrics_enabled_at = now() - interval '90 days' where id = $1`, [ont])
    const writesBy = async (app: string) => Number((await one(
      `select coalesce(sum(writes), 0) as n from public.ontology_usage
        where object_type_id = $1 and application = $2`, [type, app])).n)

    // a caller that does not name itself edits and records nothing (746's rule)
    await db.query(`select public.apply_action($1, '{"ticketId":"W-1","severity":"high"}'::jsonb)`, [action])
    expect(await count(`select count(*) n from public.ontology_usage where object_type_id = $1`, [type])).toBe(0)

    // "any object type or link type usage happening in Ontology Manager is not
    // included" — the recorder drops the name the OMA's Apply dialog passes
    await db.query(
      `select public.apply_action($1, '{"ticketId":"W-2","severity":"high"}'::jsonb, null, 'ontology-manager')`, [action])
    expect(await count(`select count(*) n from public.ontology_usage where object_type_id = $1`, [type])).toBe(0)

    // a named request: one write, and no read
    await db.query(
      `select public.apply_action($1, '{"ticketId":"W-3","severity":"high"}'::jsonb, null, 'object-explorer')`, [action])
    expect(await writesBy('object-explorer')).toBe(1)
    expect(await count(
      `select coalesce(sum(reads), 0) n from public.ontology_usage where object_type_id = $1`, [type])).toBe(0)

    // a revert is an edit request against what it puts back
    const app = (await one(
      `select id from public.action_applications where action_type_id = $1
        order by applied_at desc limit 1`, [action])).id
    await db.query(`select public.revert_action($1, 'object-explorer')`, [app])
    expect(await writesBy('object-explorer')).toBe(2)

    // the summary counts them, and Active users sees the one caller
    const s = await one(`select * from public.ontology_usage_summary($1, 30)`, [type])
    expect(Number(s.writes)).toBe(2)
    expect(Number(s.active_users)).toBe(1)
    await db.query(`update public.ontologies set metrics_enabled = false where id = $1`, [ont])
  })

  // ── 444: deletion takes the children ──────────────────────────────────────
  it('deletes a staged action whole, children included', async () => {
    await db.query(`select public.delete_ontology_resource('action_type', $1)`, [action])
    expect(await count('select count(*) n from public.action_types where id = $1', [action])).toBe(1)
    await db.query('select public.save_working_state()')
    expect(await count('select count(*) n from public.action_types where id = $1', [action])).toBe(0)
    expect(await count('select count(*) n from public.action_type_parameters where action_type_id = $1', [action])).toBe(0)
  })
})
