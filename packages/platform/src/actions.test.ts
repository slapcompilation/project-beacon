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
  let action: string

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)

  beforeAll(async () => {
    db = await connect()
    const org = (await one(`insert into public.organizations (name) values ('act-regress') returning id`)).id
    await admin(db, org, `act-${Date.now()}@beacon.test`)
    await db.query('set local role authenticated')

    const space = (await one(`select public.create_space('Act regress') as id`)).id
    ont = (await one(`insert into public.ontologies (space_id, api_name, label)
                      values ($1,'actregress','Act regress') returning id`, [space])).id
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
  it('has exactly three executable kinds, said by the registry', async () => {
    expect(await count('select count(*) n from public.action_rule_kinds() where executable')).toBe(3)
    expect(await count('select count(*) n from public.action_rule_kinds()')).toBe(7)
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
    // action_types carries no deprecation_reason/deadline — unlike its three
    // siblings. A schema asymmetry worth the gap agent's attention; the status
    // alone is enough to exercise the rename rule.
    await db.query(`update public.action_types set status='deprecated' where id = $1`, [action])
    expect(await refused(db, () =>
      db.query(`update public.action_types set api_name = 'renamed' where id = $1`, [action]))).toMatch(/ApiNameIsFixed/)
    await db.query(`update public.action_types set status = 'experimental' where id = $1`, [action])
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

  // ── 444: deletion takes the children ──────────────────────────────────────
  it('deletes a staged action whole, children included', async () => {
    await db.query(`select public.delete_ontology_resource('action_type', $1)`, [action])
    expect(await count('select count(*) n from public.action_types where id = $1', [action])).toBe(1)
    await db.query('select public.save_working_state()')
    expect(await count('select count(*) n from public.action_types where id = $1', [action])).toBe(0)
    expect(await count('select count(*) n from public.action_type_parameters where action_type_id = $1', [action])).toBe(0)
  })
})
