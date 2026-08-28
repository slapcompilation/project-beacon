// Pin F3: what exactly does the create-rule edit hold, and what does
// object_state say for it, when the index build fails on NULL pk?
import { connectionString, SSL } from '../db-url.mjs'
import pg from 'pg'
const c = new pg.Client({ connectionString: connectionString(), ssl: SSL })
await c.connect()
await c.query('BEGIN')
const one = async (sql, p = []) => (await c.query(sql, p)).rows[0]

const org = (await one(`insert into public.organizations (name) values ('f3probe') returning id`)).id
const space = (await one(`insert into public.spaces (name) values ('f3probe') returning id`)).id
await c.query(`insert into public.space_organizations (space_id, organization_id) values ($1,$2)`, [space, org])
const proj = (await one(`insert into public.projects (organization_id, api_name, name) values ($1,'f3probe','f3probe') returning id`, [org])).id
const usr = (await one(`select gen_random_uuid() as id`)).id
await c.query(`insert into auth.users (id, instance_id, aud, role, email) values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`, [usr, `f3-${Date.now()}@beacon.test`])
await c.query(`insert into public.users (id, email, role, organization_id) values ($1,$2,'admin',$3)`, [usr, `f3-${Date.now()}@beacon.test`, org])
await c.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id) values ($1,$2,'owner',$3)`, [proj, usr, org])
await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: org } })])

const d = (await one(`insert into public.datasets (organization_id, project_id, api_name, name) values ($1,$2,'f3_ds','f3_ds') returning id`, [org, proj])).id
const b = (await one(`insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [d])).id
const t = (await one(`insert into public.dataset_transactions (dataset_id, branch_id, txn_type) values ($1,$2,'SNAPSHOT') returning id`, [d, b])).id
await c.query(`insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`, [d, t, JSON.stringify([{ name: 'pk', type: 'STRING' }])])
const f = (await one(`insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count) values ($1,$2,'r.parquet',1) returning id`, [d, t])).id
await c.query(`update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [t])
const phys = (await one(`select public.dataset_materialize($1,$2) as t`, [d, t])).t
await c.query(`insert into datasets.${phys} (_file, pk) values ($1,'A')`, [f])

const ont = (await one(`insert into public.ontologies (space_id, api_name, label, require_resources_in_project) values ($1,'f3probe','F3',false) returning id`, [space])).id
const type = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
  JSON.stringify({ api_name: 'F3Thing', label: 'F3 thing', ontology_id: ont, datasources: [{ dataset_id: d, branch_id: b }] }),
  JSON.stringify([{ property_id: 'pk', display_name: 'Id', api_name: 'id', base_type: 'string', source: 'column', backing_column: 'pk', is_primary_key: true, is_title_key: true, required: true }])])).id
await c.query('select public.save_working_state()')
await c.query(`update public.object_types set edits_enabled = true where id=$1`, [type])

const pid = (await one(`select id, property_id, api_name from public.object_type_properties where object_type_id=$1`, [type]))
console.log('property row:', JSON.stringify(pid))

const action = (await one(`select public.save_action_type($1::jsonb) as id`, [
  JSON.stringify({ api_name: 'f3-add', label: 'F3 add', ontology_id: ont,
    parameters: [{ api_name: 'newId', display_name: 'Id', base_type: 'string', required: true, position: 0 }],
    rules: [{ kind: 'create_object', position: 0, object_type_id: type,
      properties: [{ property_id: pid.id, value_source: 'parameter', parameter_api_name: 'newId' }] }] })])).id
await c.query('select public.save_working_state()')
await c.query(`select public.apply_action($1, '{"newId":"C"}'::jsonb)`, [action])

const edit = await one(`select primary_key, instruction, properties from public.object_edits where object_type_id=$1`, [type])
console.log('edit row:', JSON.stringify(edit))
const st = await one(`select public.object_state($1, 'C', null) as s`, [type]).catch((e) => ({ s: 'ERR ' + e.message }))
console.log('object_state(C):', JSON.stringify(st.s))

const build = (await one(`select public.run_index_build(array[$1]::uuid[], true) as b`, [type])).b
const job = await one(`select state, error from public.build_jobs where build_id=$1`, [build])
console.log('index job:', job.state, '|', job.error)

await c.query('ROLLBACK')
await c.end()
