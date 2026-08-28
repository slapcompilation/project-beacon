// The ontology creation flow, walked end to end, v2.
// F1 (wizard deadlock) is already established; this walks the rest of the
// chain the way the ENGINE supports it (inline datasources), noting where the
// surface diverges. One transaction, savepoint per step, ROLLBACK at the end.
import { connectionString, SSL } from '../db-url.mjs'
import pg from 'pg'

const c = new pg.Client({ connectionString: connectionString(), ssl: SSL })
await c.connect()
await c.query('BEGIN')

const one = async (sql, p = []) => (await c.query(sql, p)).rows[0]
const results = []
let n = 0
async function step(name, fn) {
  n += 1
  await c.query('SAVEPOINT s')
  try {
    const detail = await fn()
    results.push(`${n}. PASS ${name}${detail ? ' - ' + detail : ''}`)
    await c.query('RELEASE SAVEPOINT s')
    return true
  } catch (e) {
    await c.query('ROLLBACK TO SAVEPOINT s')
    results.push(`${n}. FAIL ${name} - ${e.message}`)
    return false
  }
}
async function refusal(name, fn) {
  n += 1
  await c.query('SAVEPOINT s')
  try {
    await fn()
    await c.query('ROLLBACK TO SAVEPOINT s')
    results.push(`${n}. FAIL ${name} - was NOT refused`)
  } catch (e) {
    await c.query('ROLLBACK TO SAVEPOINT s')
    results.push(`${n}. PASS ${name} - refused: ${e.message.slice(0, 120)}`)
  }
}

// -- fixture ------------------------------------------------------------------
const org = (await one(`insert into public.organizations (name) values ('e2eprobe') returning id`)).id
const space = (await one(`insert into public.spaces (name) values ('e2eprobe') returning id`)).id
await c.query(`insert into public.space_organizations (space_id, organization_id) values ($1,$2)`, [space, org])
const proj = (await one(`insert into public.projects (organization_id, api_name, name) values ($1,'e2eprobe','e2eprobe') returning id`, [org])).id
const usr = (await one(`select gen_random_uuid() as id`)).id
const mail = `e2e-${Date.now()}@beacon.test`
await c.query(`insert into auth.users (id, instance_id, aud, role, email) values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`, [usr, mail])
await c.query(`insert into public.users (id, email, role, organization_id) values ($1,$2,'admin',$3)`, [usr, mail, org])
await c.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id) values ($1,$2,'owner',$3)`, [proj, usr, org])
await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: org } })])

async function datasetWithRows(slug, rows) {
  const d = (await one(`insert into public.datasets (organization_id, project_id, api_name, name) values ($1,$2,$3,$3) returning id`, [org, proj, slug])).id
  const b = (await one(`insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [d])).id
  const t = (await one(`insert into public.dataset_transactions (dataset_id, branch_id, txn_type) values ($1,$2,'SNAPSHOT') returning id`, [d, b])).id
  await c.query(`insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`, [d, t, JSON.stringify([{ name: 'pk', type: 'STRING' }, { name: 'city', type: 'STRING' }])])
  const f = (await one(`insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count) values ($1,$2,'rows.parquet',$3) returning id`, [d, t, rows.length])).id
  await c.query(`update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [t])
  const phys = (await one(`select public.dataset_materialize($1,$2) as t`, [d, t])).t
  for (const [pk, city] of rows) await c.query(`insert into datasets.${phys} (_file, pk, city) values ($1,$2,$3)`, [f, pk, city])
  return { d, b }
}
const dsB = await datasetWithRows('e2e_ports', [['A', 'ATH'], ['B', 'SKG']])
const dsC = await datasetWithRows('e2e_ships', [['S1', 'PIR']])

const ont = (await one(`insert into public.ontologies (space_id, api_name, label, require_resources_in_project) values ($1,'e2eprobe','E2E probe',false) returning id`, [space])).id
const pkProp = { property_id: 'pk', display_name: 'Id', api_name: 'id', base_type: 'string', source: 'column', backing_column: 'pk', is_primary_key: true, is_title_key: true, required: true }

// -- F1 recap: the wizard deadlock, asserted compactly ------------------------
let staged = null
await step('F1a: save_object_type stages; the row is NOT in object_types yet', async () => {
  staged = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
    JSON.stringify({ api_name: 'ProbeShipX', label: 'Probe ship X', ontology_id: ont }), JSON.stringify([pkProp])])).id
  const r = await one(`select count(*)::int as k from public.object_types where id=$1`, [staged])
  if (r.k !== 0) throw new Error('unexpectedly landed')
  return 'staged only, as designed'
})
await refusal('F1b: generate_backing_dataset cannot see the staged type (the wizard calls it here)', async () => {
  await one(`select public.generate_backing_dataset($1, 'X backing', $2)`, [staged, proj])
})
await refusal('F1c: the existing-dataset branch (direct insert) fails the same way', async () => {
  await c.query(`insert into public.object_type_datasources (object_type_id, dataset_id, branch_id) values ($1,$2,$3)`, [staged, dsB.d, dsB.b])
})
await refusal('F1d: and the save stays refused - the deadlock', async () => {
  await c.query('select public.save_working_state()')
})
await step('discard_working_state clears the poisoned entry', async () => {
  const r = await one(`select public.discard_working_state() as k`)
  return `${r.k} entr(ies) discarded`
})

// -- the engine's own path: inline datasources --------------------------------
let typeB = null
await step('create ProbePort: save_object_type WITH inline datasources + save lands it', async () => {
  typeB = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
    JSON.stringify({ api_name: 'ProbePort', label: 'Probe port', ontology_id: ont, datasources: [{ dataset_id: dsB.d, branch_id: dsB.b }] }),
    JSON.stringify([pkProp])])).id
  await c.query('select public.save_working_state()')
  const r = await one(`select count(*)::int as k from public.object_type_datasources where object_type_id=$1`, [typeB])
  return `landed with ${r.k} datasource(s)`
})
await step('edit flow: add a non-key property naming the landed datasource + save', async () => {
  const dsrc = (await one(`select id from public.object_type_datasources where object_type_id=$1`, [typeB])).id
  await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
    JSON.stringify({ id: typeB, api_name: 'ProbePort', label: 'Probe port', ontology_id: ont }),
    JSON.stringify([pkProp, { property_id: 'city', display_name: 'City', api_name: 'city', base_type: 'string', source: 'column', backing_column: 'city', datasource_id: dsrc, required: false, position: 1 }])])
  await c.query('select public.save_working_state()')
  const r = await one(`select count(*)::int as k from public.object_type_properties where object_type_id=$1`, [typeB])
  return `${r.k} properties`
})
let typeC = null
await step('create ProbeShip over the second dataset', async () => {
  typeC = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
    JSON.stringify({ api_name: 'ProbeShip', label: 'Probe ship', ontology_id: ont, datasources: [{ dataset_id: dsC.d, branch_id: dsC.b }] }),
    JSON.stringify([pkProp])])).id
  await c.query('select public.save_working_state()')
  return typeC
})

// -- link type ----------------------------------------------------------------
await step('save_link_type ship->port + save; note the default backing', async () => {
  const link = (await one(`select public.save_link_type($1::jsonb) as id`, [
    JSON.stringify({ source_object_type_id: typeC, target_object_type_id: typeB, api_name: 'docked_at', label: 'Docked at', ontology_id: ont })])).id
  await c.query('select public.save_working_state()')
  const r = await one(`select backing_kind, cardinality from public.link_types where id=$1`, [link])
  return `backing_kind=${r.backing_kind ?? 'NULL'} cardinality=${r.cardinality ?? 'NULL'}`
})

// -- action type + apply ------------------------------------------------------
let action = null
let application = null
await step('save_action_type (create_object rule on ProbePort) + save', async () => {
  const pid = (await one(`select id from public.object_type_properties where object_type_id=$1 and is_primary_key`, [typeB])).id
  action = (await one(`select public.save_action_type($1::jsonb) as id`, [
    JSON.stringify({ api_name: 'add-port', label: 'Add port', ontology_id: ont,
      parameters: [{ api_name: 'portId', display_name: 'Port id', base_type: 'string', required: true, position: 0 }],
      rules: [{ kind: 'create_object', position: 0, object_type_id: typeB,
        properties: [{ property_id: pid, value_source: 'parameter', parameter_api_name: 'portId' }] }] })])).id
  await c.query('select public.save_working_state()')
  return action
})
await refusal('apply_action refuses while edits are disabled (allow-editing default)', async () => {
  await one(`select public.apply_action($1, '{"portId":"C0"}'::jsonb) as k`, [action])
})
await step('enable edits on ProbePort (the allow-editing step of the flow)', async () => {
  await c.query(`update public.object_types set edits_enabled = true where id=$1`, [typeB])
  return 'edits_enabled=true (direct update; note WHERE the surface offers this)'
})
await step('apply_action creates the object edit; the application is recorded', async () => {
  const r = await one(`select public.apply_action($1, '{"portId":"C"}'::jsonb) as k`, [action])
  const e = await one(`select count(*)::int as k from public.object_edits where object_type_id=$1`, [typeB])
  application = (await one(`select id, revertible from public.action_applications where action_type_id=$1 order by applied_at desc limit 1`, [action]))
  return `${r.k} edit(s); log=${e.k}; application=${application?.id?.slice(0, 8)} revertible=${application?.revertible}`
})
await refusal('a direct INSERT into object_edits is refused as authenticated (605)', async () => {
  await c.query('SET LOCAL ROLE authenticated')
  await c.query(`insert into public.object_edits (object_type_id, primary_key, instruction, properties) values ($1,'X','create','{}'::jsonb)`, [typeB])
})

// -- index --------------------------------------------------------------------
let idxTable = null
await step('run_index_build indexes ProbePort through a real build', async () => {
  const b = (await one(`select public.run_index_build(array[$1]::uuid[], true) as b`, [typeB])).b
  const job = await one(`select state, error from public.build_jobs where build_id=$1`, [b])
  if (job.state !== 'COMPLETED') throw new Error(`job ${job.state}: ${job.error}`)
  const st = await one(`select status from public.builds where id=$1`, [b])
  const idx = await one(`select index_table, object_count::int as k from public.object_type_indexes where object_type_id=$1`, [typeB])
  idxTable = idx.index_table
  return `build ${st.status}; ${idx.k} objects in objects.${idxTable} (2 rows + 1 edit)`
})
// The OSv2 mediation, deliberate: the raw index is private, function reads serve.
await refusal('a direct read of the index table as authenticated is refused (mediated reads)', async () => {
  await c.query('SET LOCAL ROLE authenticated')
  await one(`select count(*)::int as k from objects.${idxTable}`)
})
await step('evaluate_object_set reads the type as authenticated', async () => {
  await c.query('SET LOCAL ROLE authenticated')
  const r = (await c.query(`select public.evaluate_object_set($1, '[]'::jsonb) as r`, [typeB])).rows
  await c.query('RESET ROLE')
  return `${r.length} result(s)`
})

// -- revert -------------------------------------------------------------------
await step('revert_action + rebuild drops the created object', async () => {
  if (!application?.id) throw new Error('no application recorded upstream')
  await c.query(`select public.revert_action($1)`, [application.id])
  await c.query(`select public.run_index_build(array[$1]::uuid[], true)`, [typeB])
  const idx = await one(`select object_count::int as k from public.object_type_indexes where object_type_id=$1`, [typeB])
  if (idx.k !== 2) throw new Error(`expected 2, index holds ${idx.k}`)
  return 'back to the 2 dataset rows'
})

// -- the linter's two lists ---------------------------------------------------
await step('ontology_violations / ontology_warnings over the probe types', async () => {
  const v = (await c.query(`select object_type, problem from public.ontology_violations() where object_type like 'Probe%'`)).rows
  const w = (await c.query(`select * from public.ontology_warnings() limit 50`)).rows
  return `violations on Probe*: ${JSON.stringify(v)}; warnings total: ${w.length}`
})

await c.query('ROLLBACK')
await c.end()
console.log(results.join('\n'))
