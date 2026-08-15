// Restricted views, re-asked on every CI run.
//
// Migrations 483–485 assert this once at landing. The durable questions: the
// policy grammar refuses what manage-granular-policies refuses, the index
// stays whole while every reader applies the policy per caller
// (restricted-views: "the restricted view controls what objects users can
// see"), and a restricted-view-backed type never travels to the shared
// search index.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('restricted views', () => {
  let db: pg.Client
  let f: Fixture
  let owner = ''
  let rep = ''
  let saleType = ''
  let rv = ''
  let fields: unknown

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const claims = async (sub: string, role: string) =>
    db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub, app_metadata: { role, org_id: f.orgId } })])

  const visible = async () =>
    Number((await one('select public.count_object_set($1, $2::jsonb) as n', [saleType, '[]'])).n)

  const checkPolicy = async (policy: unknown) =>
    refused(db, () => db.query('select public.granular_policy_check($1::jsonb, $2::jsonb)',
      [JSON.stringify(policy), JSON.stringify(fields)]))

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'rvtest485')
    for (const key of ['owner', 'rep'] as const) {
      const id = (await one('select gen_random_uuid() as id')).id
      await db.query(
        `insert into auth.users (id, instance_id, aud, role, email)
         values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
        [id, `rvtest-${key}-${Date.now()}@beacon.test`])
      if (key === 'owner') owner = id; else rep = id
    }
    await claims(owner, 'admin')
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, owner, f.orgId])
    const ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'rvtest485','RV',false) returning id`, [f.spaceId])).id

    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [f.datasetId, f.branchId])).id
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      [f.datasetId, txn, JSON.stringify([
        { name: 'sale_id', type: 'STRING' }, { name: 'owner_id', type: 'STRING' },
        { name: 'region', type: 'STRING' }])])
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'sales.parquet',3) returning id`, [f.datasetId, txn])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [txn])
    const tbl = (await one('select public.dataset_materialize($1,$2) as t', [f.datasetId, txn])).t
    await db.query(
      `insert into datasets.${tbl} (_file, sale_id, owner_id, region) values
        ($1,'S1',$2,'ATH'), ($1,'S2',$3,'ATH'), ($1,'S3',$3,'SKG')`, [file, owner, rep])
    fields = (await one('select public.dataset_current_fields($1) as f', [f.datasetId])).f

    rv = (await one(
      `insert into public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
       values ($1,$2,'rv_sales485','Sales by owner',
         '{"match":"all","rules":[{"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}')
       returning id`, [f.projectId, f.datasetId])).id

    saleType = (await one(
      `insert into public.object_types (ontology_id, api_name, label)
       values ($1,'RvSale485','Sale') returning id`, [ont])).id
    const src = (await one(
      `insert into public.object_type_datasources (object_type_id, restricted_view_id)
       values ($1,$2) returning id`, [saleType, rv])).id
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type,
          backing_column, required, is_primary_key, is_title_key)
       values ($1,'sale_id','Sale Id','saleId','string','sale_id',true,true,true)`, [saleType])
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type,
          backing_column, datasource_id, required)
       values ($1,'owner_id','Owner','ownerId','string','owner_id',$2,false),
              ($1,'region','Region','region','string','region',$2,false)`, [saleType, src])

    // Through a build, not a bare call. This fixture indexed directly for as
    // long as it existed, and that is why nobody saw that a restricted-view
    // backing leaves `object_type_datasources.dataset_id` NULL by constraint —
    // `job_spec_input_state` aggregated on it and raised "field name must not
    // be null". 531 resolves the view to the dataset underneath it.
    const build = (await one(
      'select public.run_index_build(array[$1]::uuid[], true) as b', [saleType])).b
    const job = await one(
      'select state, error from public.build_jobs where build_id = $1', [build])
    expect(job.state, job.error ?? '').toBe('COMPLETED')
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('the index stays whole — the policy never bakes into the build', async () => {
    const r = await one(
      `select object_count from public.object_type_indexes where object_type_id=$1`, [saleType])
    expect(Number(r.object_count)).toBe(3)
  })

  it('each caller reads only their rows, through the shared WHERE', async () => {
    await claims(owner, 'admin')
    expect(await visible()).toBe(1)
    await claims(rep, 'limited_access')
    expect(await visible()).toBe(2)
  })

  it('quicksearch applies the same gate', async () => {
    await claims(rep, 'limited_access')
    const r = await one(
      `select count(*) as n from public.search_objects('S', 25) s where s.object_type_id = $1`, [saleType])
    expect(Number(r.n)).toBe(2)
  })

  it('a restricted-view-backed type never travels to the shared search index', async () => {
    await claims(owner, 'admin')
    const scope = await one(
      `select count(*) as n from public.search_visible_types() v where v.object_type_id = $1`, [saleType])
    expect(Number(scope.n)).toBe(0)
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ role: 'service_role' })])
    const payload = await one('select public.search_index_payload($1) as p', [saleType])
    expect(payload.p).toBeNull()
    await claims(owner, 'admin')
  })

  it('a restricted view backs alone', async () => {
    const err = await refused(db, () => db.query(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3)`, [saleType, f.datasetId, f.branchId]))
    expect(err).toContain('Ontology:RestrictedViewBacksAlone')
  })

  it('group membership widens visibility at query time, no rebuild', async () => {
    await claims(owner, 'admin')
    await db.query(
      `update public.restricted_views set policy = '{"match":"any","rules":[
         {"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}},
         {"left":{"user_attribute":"group_names"},"comparison":"intersects","right":{"value":["RV Leads 485"]}}]}'
       where id = $1`, [rv])
    const g = (await one(
      `insert into public.groups (organization_id, name, created_by)
       values ($1,'RV Leads 485',$2) returning id`, [f.orgId, owner])).id
    await db.query(`insert into public.group_members (group_id, member_user_id) values ($1,$2)`, [g, rep])
    await claims(rep, 'limited_access')
    expect(await visible()).toBe(3)
  })

  it('the grammar refuses what the pages refuse', async () => {
    expect(await checkPolicy({ match: 'all', rules: [
      { left: { user_attribute: 'group_ids' }, comparison: 'equal', right: { column: 'region' } }] }))
      .toContain('Policies:ComparisonNeedsScalars')
    expect(await checkPolicy({ match: 'all', rules: [
      { left: { column: 'region' }, comparison: 'equal', right: { value: 'ATH' } }] }))
      .toContain('Policies:PolicyNeedsAUserAttribute')
    expect(await checkPolicy({ match: 'all', not: true, rules: [
      { left: { user_attribute: 'user_id' }, comparison: 'equal', right: { column: 'owner_id' } }] }))
      .toContain('Policies:NotUnsupported')
    expect(await checkPolicy({ match: 'all', rules: [
      { left: { user_attribute: 'user_id' }, comparison: 'equal', right: { column: 'ghost' } }] }))
      .toContain('Policies:ColumnNotInBackingDataset')
    // Four marking conditions weigh 12,000 — over the documented cap.
    const marking = { left: { user_attribute: 'marking_ids' }, comparison: 'intersects', right: { value: ['m'] } }
    expect(await checkPolicy({ match: 'all', rules: [marking, marking, marking, marking] }))
      .toContain('Policies:PolicyOverweight')
  })
})
