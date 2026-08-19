import pg from 'pg'
import { connectionString, SSL } from './scripts/db-url.mjs'
const c = new pg.Client({ connectionString: connectionString(), ssl: SSL })
await c.connect(); await c.query('BEGIN')
const one = async (q, p=[]) => (await c.query(q, p)).rows[0]
try {
  const org = (await one(`insert into public.organizations (name) values ('sev') returning id`)).id
  const sp = (await one(`insert into public.spaces (name) values ('sev') returning id`)).id
  await c.query(`insert into public.space_organizations (space_id, organization_id) values ($1,$2)`, [sp, org])
  const pr = (await one(`insert into public.projects (organization_id, api_name, name) values ($1,'sev','sev') returning id`, [org])).id
  const ont = (await one(`insert into public.ontologies (space_id, api_name, label, require_resources_in_project) values ($1,'sev','S',false) returning id`, [sp])).id
  await c.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ app_metadata: { role: 'admin', org_id: org } })])
  const ot = (await one(`insert into public.object_types (ontology_id, project_id, api_name, label) values ($1,$2,'Craft','Craft') returning id`, [ont, pr])).id

  const mk = async (slug, cols) => {
    const ds = (await one(`insert into public.datasets (organization_id, project_id, api_name, name) values ($1,$2,$3,$3) returning id`, [org, pr, slug])).id
    const br = (await one(`insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [ds])).id
    const tx = (await one(`insert into public.dataset_transactions (dataset_id, branch_id, txn_type) values ($1,$2,'SNAPSHOT') returning id`, [ds, br])).id
    await c.query(`insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      [ds, tx, JSON.stringify(cols.map((n) => ({ name: n, type: 'STRING' })))])
    await c.query(`update public.dataset_transactions set status='COMMITTED', committed_at=now() where id=$1`, [tx])
    return { ds, br }
  }
  const a = await mk('sev_a', ['tail_number','model'])
  const dsA = (await one(`insert into public.object_type_datasources (object_type_id, dataset_id, branch_id) values ($1,$2,$3) returning id`, [ot, a.ds, a.br])).id
  await c.query(`insert into public.object_type_properties (object_type_id, property_id, api_name, display_name, base_type, source, backing_column, is_primary_key, is_title_key, required, datasource_id)
    values ($1,'tail_number','tailNumber','Tail','string','column','tail_number',true,true,true,null),
           ($1,'model','model','Model','string','column','model',false,false,false,$2)`, [ot, dsA])
  const b = await mk('sev_b', ['tail','seats'])
  const dsB = (await one(`insert into public.object_type_datasources (object_type_id, dataset_id, branch_id, primary_key_column) values ($1,$2,$3,'tail') returning id`, [ot, b.ds, b.br])).id
  await c.query(`insert into public.object_type_properties (object_type_id, property_id, api_name, display_name, base_type, source, backing_column, datasource_id)
    values ($1,'seats','seats','Seats','integer','column','seats',$2)`, [ot, dsB])

  console.log('--- the datasource DOES declare its key column as `tail` ---')
  for (const r of (await c.query(`select scope, problem from public.ontology_violations() order by 1,2`)).rows) {
    console.log(`  ${r.scope}: ${r.problem}`)
  }
} finally { await c.query('ROLLBACK'); await c.end() }
