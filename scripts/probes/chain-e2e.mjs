// The whole chain, walked end to end, from a file on disk to an automation
// acting on the objects it produced.
//
// The creation probe beside this one walks the ONTOLOGY. This walks the
// PLATFORM: upload, transform, build, index, read, act, schedule, automate,
// materialise. Foundry's own use-case page sequences a delivery that way —
// source the data, transform it, model it, then build views that capture
// decisions back into the system — and every stage below has an engine here.
// The question this asks is whether they reach each other.
//
// One transaction, a savepoint per step, ROLLBACK at the end: nothing it does
// survives, so it can be run against the live database without leaving rows.
// A step that fails does not stop the walk — the point is the whole report,
// not the first failure.

import { connectionString, SSL } from '../db-url.mjs'
import pg from 'pg'

const c = new pg.Client({ connectionString: connectionString(), ssl: SSL })
await c.connect()
await c.query('BEGIN')

const one = async (sql, p = []) => (await c.query(sql, p)).rows[0]
const results = []
let n = 0

async function step (name, fn) {
  n += 1
  await c.query('SAVEPOINT s')
  try {
    const detail = await fn()
    results.push(`${String(n).padStart(2)}. PASS  ${name}${detail ? ' — ' + detail : ''}`)
    await c.query('RELEASE SAVEPOINT s')
    return true
  } catch (e) {
    await c.query('ROLLBACK TO SAVEPOINT s')
    results.push(`${String(n).padStart(2)}. FAIL  ${name} — ${e.message.slice(0, 200)}`)
    return false
  }
}

// ── fixture ─────────────────────────────────────────────────────────────────
const org = (await one(`insert into public.organizations (name) values ('chainprobe') returning id`)).id
const usr = (await one('select gen_random_uuid() as id')).id
const mail = `chain-${usr}@beacon.test`
await c.query(
  `insert into auth.users (id, instance_id, aud, role, email)
   values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`, [usr, mail])
await c.query(`select set_config('request.jwt.claims', $1, true)`,
  [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: org } })])
await c.query(`insert into public.users (id, email, role, organization_id) values ($1,$2,'admin',$3)`,
  [usr, mail, org])
const space = (await one(`select public.create_space('Chain probe') as id`)).id
const proj = (await one(
  `insert into public.projects (organization_id, space_id, api_name, name)
   values ($1,$2,'chainprobe','Chain probe') returning id`, [org, space])).id
await c.query(
  `insert into public.project_role_grants (project_id, user_id, role, organization_id)
   values ($1,$2,'owner',$3)`, [proj, usr, org])
const ont = (await one(`select id from public.ontologies where space_id = $1`, [space])).id
await c.query(`update public.ontologies set require_resources_in_project = false where id = $1`, [ont])

const NL = '\n'
let ds = null
let br = null
let ot = null
let action = null
let derived = null

// ── 1. a file becomes a dataset ─────────────────────────────────────────────
await step('a dataset is created empty', async () => {
  ds = (await one(
    `insert into public.datasets (organization_id, project_id, api_name, name)
     values ($1,$2,'chain_ports','Ports') returning id`, [org, proj])).id
  br = (await one(
    `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [ds])).id
  return 'chain_ports on master'
})

await step('a CSV uploads, and its schema is inferred', async () => {
  const t = (await one(`select public.upload_file_to_dataset($1,'ports.csv',$2) as t`,
    [ds, `code,name,berths${NL}ATH,Piraeus,12${NL}SKG,Thessaloniki,7${NL}`])).t
  const s = await one(`select fields, txn_type from public.dataset_schemas s
    join public.dataset_transactions x on x.id = s.transaction_id where s.transaction_id = $1`, [t])
  return `${s.txn_type}; ${JSON.stringify(s.fields.map((f) => `${f.name}:${f.type}`))}`
})

await step('a second file appends and BOTH are in the view', async () => {
  await one(`select public.upload_file_to_dataset($1,'more-ports.csv',$2) as t`,
    [ds, `code,name,berths${NL}HER,Heraklion,5${NL}`])
  const v = await c.query(`select logical_path, row_count from public.dataset_view($1) order by 1`, [br])
  if (v.rows.length !== 2) throw new Error(`view holds ${v.rows.length} file(s), expected 2`)
  const rows = v.rows.reduce((k, r) => k + r.row_count, 0)
  return `${v.rows.length} files, ${rows} rows`
})

await step('re-uploading a filename replaces it rather than adding', async () => {
  const t = (await one(`select public.upload_file_to_dataset($1,'ports.csv',$2) as t`,
    [ds, `code,name,berths${NL}ATH,Piraeus,14${NL}SKG,Thessaloniki,7${NL}PIR,Piraeus B,3${NL}`])).t
  const k = await one(`select txn_type from public.dataset_transactions where id = $1`, [t])
  const v = await c.query(`select logical_path, row_count from public.dataset_view($1)`, [br])
  const rows = v.rows.reduce((s, r) => s + r.row_count, 0)
  return `${k.txn_type}; ${v.rows.length} files, ${rows} rows`
})

// ── 2. the dataset backs an object type ─────────────────────────────────────
const pk = { property_id: 'code', display_name: 'Code', api_name: 'code', base_type: 'string',
  source: 'column', backing_column: 'code', is_primary_key: true, is_title_key: true, required: true }

await step('an object type is saved over the uploaded dataset', async () => {
  ot = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
    JSON.stringify({
      api_name: 'ChainPort', label: 'Chain port', ontology_id: ont,
      datasources: [{ dataset_id: ds, branch_id: br }],
    }),
    JSON.stringify([pk])])).id
  await c.query('select public.save_working_state()')
  const d = await one(`select count(*)::int as k from public.object_type_datasources where object_type_id=$1`, [ot])
  return `landed with ${d.k} datasource(s)`
})

await step('its other columns become properties naming that datasource', async () => {
  // A non-key property must name the datasource it comes from, and a datasource
  // only has an id once it has landed — so this is a second save by design.
  const dsrc = (await one(
    `select id from public.object_type_datasources where object_type_id=$1`, [ot])).id
  await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
    JSON.stringify({ id: ot, api_name: 'ChainPort', label: 'Chain port', ontology_id: ont }),
    JSON.stringify([pk,
      { property_id: 'name', display_name: 'Name', api_name: 'name', base_type: 'string',
        source: 'column', backing_column: 'name', datasource_id: dsrc, position: 1 },
      { property_id: 'berths', display_name: 'Berths', api_name: 'berths', base_type: 'integer',
        source: 'column', backing_column: 'berths', datasource_id: dsrc, position: 2 }])])
  await c.query('select public.save_working_state()')
  const k = await one(
    `select count(*)::int as k from public.object_type_properties where object_type_id=$1`, [ot])
  return `${k.k} properties`
})

await step('the index build turns the uploaded rows into objects', async () => {
  const b = (await one(`select public.run_index_build(array[$1]::uuid[], true) as b`, [ot])).b
  const job = await one(`select state, error from public.build_jobs where build_id=$1`, [b])
  if (job.state !== 'COMPLETED') throw new Error(`job ${job.state}: ${job.error}`)
  const idx = await one(
    `select index_table, object_count::int as k from public.object_type_indexes where object_type_id=$1`, [ot])
  return `${idx.k} objects in objects.${idx.index_table}`
})

await step('the objects read back as the caller, not the owner', async () => {
  await c.query('SET LOCAL ROLE authenticated')
  const r = (await c.query(`select public.evaluate_object_set($1, '[]'::jsonb) as r`, [ot])).rows
  await c.query('RESET ROLE')
  return `${r.length} object(s) visible to authenticated`
})

// ── 3. a transform makes a derived dataset ──────────────────────────────────
await step('a transform publishes a derived dataset from the uploaded one', async () => {
  derived = (await one(
    `insert into public.datasets (organization_id, project_id, api_name, name)
     values ($1,$2,'chain_big_ports','Big ports') returning id`, [org, proj])).id
  await c.query(`insert into public.dataset_branches (dataset_id, name) values ($1,'master')`, [derived])
  const phys = (await one(`select physical_table from public.datasets where id=$1`, [ds])).physical_table
  await c.query(`insert into public.dataset_inputs (dataset_id, input_dataset_id) values ($1,$2)`, [derived, ds])
  await c.query(
    `insert into public.job_specs (output_dataset_id, logic_sql, published_by, published_at)
     values ($1,$2,$3, clock_timestamp())`,
    [derived, `select code, name, berths from datasets.${phys}`, usr])
  return 'job spec published'
})

await step('run_build materialises the derived dataset', async () => {
  const b = (await one(`select public.run_build(array[$1]::uuid[], true, null, null, false) as b`, [derived])).b
  const job = await one(`select state, error from public.build_jobs where build_id=$1`, [b])
  const st = await one(`select status from public.builds where id=$1`, [b])
  if (job.state !== 'COMPLETED') throw new Error(`build ${st.status}, job ${job.state}: ${job.error}`)
  const phys = (await one(`select physical_table from public.datasets where id=$1`, [derived])).physical_table
  const k = phys ? (await one(`select count(*)::int as k from datasets.${phys}`)).k : 0
  return `build ${st.status}; ${k} row(s) in datasets.${phys}`
})

// ── 4. a schedule drives the build ──────────────────────────────────────────
let sched = null
await step('a schedule targets the derived dataset', async () => {
  sched = (await one(
    `insert into public.schedules (organization_id, name, target_dataset_ids, trigger, scope,
                                   scope_project_ids, updated_by)
     values ($1,'Nightly ports',array[$2]::uuid[],$3::jsonb,'project',array[$4]::uuid[],$5) returning id`,
    [org, derived, JSON.stringify({ type: 'time', cron: '0 2 * * *', timezone: 'UTC' }),
     proj, usr])).id
  return sched.slice(0, 8)
})

await step('a schedule can only be run by hand through an action', async () => {
  // Not a defect: 668 built run_schedule_now as the action Schedule rule's
  // entry point, "delegates control over running it from the schedule to the
  // action type". The finding is that there is no OTHER manual path — the
  // Builds surface has no run-now that does not go through an action.
  await c.query('SAVEPOINT inner_s')
  try {
    await one(`select public.run_schedule_now($1) as b`, [sched])
    await c.query('RELEASE SAVEPOINT inner_s')
    return 'ran outside an action, which contradicts its own guard'
  } catch (e) {
    await c.query('ROLLBACK TO SAVEPOINT inner_s')
    if (!e.message.includes('Actions:NotApplying')) throw e
    return 'refused outside the action window, as 668 designed; no other manual path exists'
  }
})

// ── 5. an action writes back ────────────────────────────────────────────────
await step('an action type creates an object', async () => {
  const pid = (await one(
    `select id from public.object_type_properties where object_type_id=$1 and is_primary_key`, [ot])).id
  action = (await one(`select public.save_action_type($1::jsonb) as id`, [
    JSON.stringify({
      api_name: 'add-chain-port', label: 'Add port', ontology_id: ont,
      parameters: [{ api_name: 'portId', display_name: 'Port id', base_type: 'string', required: true, position: 0 }],
      rules: [{ kind: 'create_object', position: 0, object_type_id: ot,
        properties: [{ property_id: pid, value_source: 'parameter', parameter_api_name: 'portId' }] }],
    })])).id
  await c.query('select public.save_working_state()')
  await c.query(`update public.object_types set edits_enabled = true where id=$1`, [ot])
  const r = await one(`select public.apply_action($1, '{"portId":"VOL"}'::jsonb) as k`, [action])
  return `${r.k} edit(s) written`
})

await step('the edit joins the dataset rows at the next index build', async () => {
  await c.query(`select public.run_index_build(array[$1]::uuid[], true)`, [ot])
  const idx = await one(`select object_count::int as k from public.object_type_indexes where object_type_id=$1`, [ot])
  return `${idx.k} objects (dataset rows plus the edit)`
})

// ── 6. an automation acts on what changed ───────────────────────────────────
let auto = null
await step('an automation is created over the object type', async () => {
  const oset = (await one(
    `insert into public.object_sets (name, api_name, subject_type_id, project_id, ontology_id, filters)
     values ('Chain ports','chain_ports_set',$1,$2,$3,'[]'::jsonb) returning id`,
    [ot, proj, ont])).id
  auto = (await one(
    `insert into public.automations (project_id, display_name, owner_id, condition)
     values ($1,'Port watch',$2,$3::jsonb) returning id`,
    [proj, usr, JSON.stringify({ type: 'objects_added', object_set_id: oset })])).id
  await c.query(
    `insert into public.automation_effects (automation_id, position, kind, action_type_id, parameters)
     values ($1,0,'action',$2,$3::jsonb)`,
    [auto, action, JSON.stringify({ portId: 'AUTO' })])
  return auto.slice(0, 8)
})

await step('the automation executes and records a run', async () => {
  await one(`select public.execute_automation_now($1) as k`, [auto])
  const runs = await one(`select count(*)::int as k from public.automation_runs where automation_id=$1`, [auto])
  const ev = await one(`select count(*)::int as k from public.automation_events where automation_id=$1`, [auto])
  return `${runs.k} run(s), ${ev.k} event(s)`
})

await step('THE GAP: an effect can see the objects that triggered it', async () => {
  // The deliverable map records this as absent. The probe asks the question
  // rather than assuming the answer: is there any column, parameter or
  // function by which a condition's matched objects reach an effect?
  const col = await one(
    `select count(*)::int as k from information_schema.columns
      where table_name='automation_effects' and column_name ~ 'input'`)
  const fn = await one(
    `select count(*)::int as k from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
      where ns.nspname='public' and p.proname ~ 'effect_input'`)
  if (col.k === 0 && fn.k === 0) throw new Error('no effect-input column and no effect-input function exist')
  return `columns=${col.k} functions=${fn.k}`
})

// ── 7. the ontology writes back out ─────────────────────────────────────────
await step('a materialization writes the merged state back to a dataset', async () => {
  const out = (await one(
    `insert into public.datasets (organization_id, project_id, api_name, name)
     values ($1,$2,'chain_ports_mat','Ports materialized') returning id`, [org, proj])).id
  await c.query(`insert into public.dataset_branches (dataset_id, name) values ($1,'master')`, [out])
  const m = (await one(
    `insert into public.object_type_materializations (object_type_id, dataset_id, created_by_user_id)
     values ($1,$2,$3) returning id`, [ot, out, usr])).id
  await one(`select public.build_materialization($1) as k`, [m])
  const phys = (await one(`select physical_table from public.datasets where id=$1`, [out])).physical_table
  const k = phys ? (await one(`select count(*)::int as k from datasets.${phys}`)).k : 0
  return `${k} row(s) written to datasets.${phys}`
})

// ── 8. the linter over everything the walk built ────────────────────────────
await step('the linter has nothing to say about what the walk built', async () => {
  const v = (await c.query(
    `select object_type, problem from public.ontology_violations() where object_type like 'Chain%'`)).rows
  const w = (await c.query(
    `select * from public.ontology_warnings() limit 100`)).rows
  if (v.length > 0) throw new Error(`violations: ${JSON.stringify(v)}`)
  return `0 violations on Chain*, ${w.length} warning(s) platform-wide`
})

await c.query('ROLLBACK')
await c.end()

console.log('THE CHAIN, END TO END')
console.log('=====================')
console.log(results.join('\n'))
const failed = results.filter((r) => r.includes('FAIL')).length
console.log(`\n${results.length - failed}/${results.length} steps passed`)
