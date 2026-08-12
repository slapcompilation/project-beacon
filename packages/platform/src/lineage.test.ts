// The lineage graph, re-asked on every CI run.
//
// Migration 479 asserts this once at land time. The durable questions: one
// graph spans datasets and object types over the four edge sources; the
// "Defines an object type" indicator sits on the right dataset; out-of-date
// with parent flips when a direct parent commits; an outsider cannot walk it.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

interface GraphNode {
  kind: string; id: string; label: string
  defines_object_type: boolean | null
  out_of_date_with_parent: boolean
  txn_type: string | null
  row_count: number | null
}
interface Graph { nodes: GraphNode[]; edges: { edge: string; api_name: string | null }[]; truncated: boolean }

describe.skipIf(noDb)('the lineage graph', () => {
  let db: pg.Client
  let f: Fixture
  let raw = ''
  let clean = ''
  let thing = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const graph = async (kind: string, id: string): Promise<Graph> =>
    (await one(`select public.lineage_graph($1,$2,3,3) as g`, [kind, id])).g as unknown as Graph

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'lineage479')
    // project_role reads the caller's grants, which need a real user behind
    // the claims — the bare fixture claims carry none.
    const usr = (await one('select gen_random_uuid() as id')).id
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, `lineage479-${Date.now()}@beacon.test`])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, `lineage479-${Date.now()}@beacon.test`, f.orgId])
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, usr, f.orgId])
    f.claims = JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [f.claims])
    const ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'lineage479','Lineage',false) returning id`, [f.spaceId])).id

    // raw → clean → Thing → export, with a link Thing—Other.
    raw = f.datasetId
    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [raw, f.branchId])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [txn])

    clean = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'lineage479_clean','clean') returning id`, [f.orgId, f.projectId])).id
    const brc = (await one(
      `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [clean])).id
    await db.query(`insert into public.dataset_inputs (dataset_id, input_dataset_id) values ($1,$2)`, [clean, raw])
    const txc = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [clean, brc])).id
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields)
       values ($1,$2,'[{"name":"k","type":"STRING"}]'::jsonb)`, [clean, txc])
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'clean.parquet',1) returning id`, [clean, txc])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [txc])
    const tbl = (await one('select public.dataset_materialize($1,$2) as t', [clean, txc])).t
    await db.query(`insert into datasets.${tbl} (_file, k) values ($1,'a')`, [file])

    thing = (await one(
      `insert into public.object_types (ontology_id, api_name, label, edits_enabled)
       values ($1,'LThing479','Thing',true) returning id`, [ont])).id
    await db.query(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3)`, [thing, clean, brc])
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type,
          backing_column, required, is_primary_key, is_title_key)
       values ($1,'k','K','k','string','k',true,true,true)`, [thing])
    const other = (await one(
      `insert into public.object_types (ontology_id, api_name, label)
       values ($1,'LOther479','Other') returning id`, [ont])).id
    await db.query(
      `insert into public.link_types (ontology_id, source_object_type_id, target_object_type_id,
         api_name, label, source_api_name, source_label, target_api_name, target_label, cardinality)
       values ($1,$2,$3,'lthing-to-other','Thing to Other','things','Things','other','Other','many_to_one')`,
      [ont, thing, other])

    const idx = await one('select status, error from public.index_object_type($1)', [thing])
    expect(idx.status, idx.error ?? '').toBe('success')
    // One transaction, two clocks: indexed_at is now(); the fixture commits
    // use clock_timestamp(). Align so staleness compares real moments.
    await db.query(
      `update public.object_type_indexes set indexed_at = clock_timestamp() where object_type_id=$1`, [thing])

    const exportDs = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'lineage479_export','export') returning id`, [f.orgId, f.projectId])).id
    await db.query(
      `insert into public.object_type_materializations (object_type_id, dataset_id) values ($1,$2)`,
      [thing, exportDs])
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('spans datasets and object types with all four edge kinds', async () => {
    const g = await graph('dataset', clean)
    expect(g.nodes).toHaveLength(5)
    expect(new Set(g.edges.map((e) => e.edge)))
      .toEqual(new Set(['input', 'datasource', 'materialization', 'link_type']))
    const cleanNode = g.nodes.find((n) => n.id === clean)
    expect(cleanNode?.defines_object_type).toBe(true)
    expect(cleanNode?.txn_type).toBe('SNAPSHOT')
    expect(Number(cleanNode?.row_count)).toBe(1)
    expect(g.nodes.find((n) => n.id === raw)?.defines_object_type).toBe(false)
  })

  it('flips out-of-date with parent when a direct parent commits', async () => {
    let g = await graph('dataset', clean)
    expect(g.nodes.some((n) => n.out_of_date_with_parent)).toBe(false)

    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'APPEND') returning id`, [raw, f.branchId])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [txn])

    g = await graph('dataset', clean)
    expect(g.nodes.find((n) => n.id === clean)?.out_of_date_with_parent).toBe(true)
    expect(g.nodes.find((n) => n.id === raw)?.out_of_date_with_parent).toBe(false)
  })

  it('refuses an outsider by name', async () => {
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ app_metadata: { role: 'admin', org_id: '00000000-0000-0000-0000-000000000001' } })])
    expect(await refused(db, () => db.query(`select public.lineage_graph('dataset',$1,1,1)`, [clean])))
      .toContain('Compass:DatasetNotFound')
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [f.claims])
  })
})
