// A join table is indexed alongside the objects, and a search-around reads it
// (750/751).
//
// "In many-to-many relationships, the Ontology requires the definition of a
// join table to define all of the links between objects based on their
// primary keys. These tables are indexed alongside the objects in the
// Ontology" — so a join-table link type owns a pair store built by a real
// build job, and the link presence filter left-semi joins through it. Front
// door where it matters: the link stages through save_link_type and lands
// through save_working_state.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('a join table is indexed alongside the objects', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let ta = ''
  let tb = ''
  let jds = ''
  let jbr = ''
  let jphys = ''
  let link = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (type: string, filters: unknown) =>
    Number((await one('select public.count_object_set($1,$2::jsonb) as n',
      [type, JSON.stringify(filters)])).n)
  const presence = (linkType: string, matchType: string) =>
    [{ type: 'linkFilter', linkType, value: { type: 'presenceFilter', matchType } }]

  // A committed transaction with one file, its rows inserted after commit.
  const commitRows = async (ds: string, br: string, fields: unknown[], insert: (phys: string, file: string) => Promise<void>) => {
    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
       select $1, $2, case when b.head_transaction_id is null then 'SNAPSHOT' else 'APPEND' end,
              b.head_transaction_id
         from public.dataset_branches b where b.id = $2 returning id`, [ds, br])).id
    if (fields.length > 0) {
      await db.query(
        `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
        [ds, txn, JSON.stringify(fields)])
    }
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'rows-' || gen_random_uuid()::text || '.parquet',0) returning id`, [ds, txn])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp()
        where id=$1`, [txn])
    // Only a schema-bearing transaction materializes; an append reuses the
    // physical table the caller already holds.
    const phys = fields.length > 0
      ? (await one('select public.dataset_materialize($1,$2) as t', [ds, txn])).t
      : ''
    await insert(phys, file)
    return phys
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'linkidx')
    const usr = (await one('select gen_random_uuid() as id')).id
    const email = `linkidx-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, email, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'linkidx','Link idx',false) returning id`, [f.spaceId])).id

    // Two sides, each over a real dataset, each indexed.
    for (const [api, keys] of [['LinkIdxA', ['A1', 'A2', 'A3']], ['LinkIdxB', ['B1', 'B2', 'B3']]] as const) {
      const ds = (await one(
        `insert into public.datasets (organization_id, project_id, api_name, name)
         values ($1,$2,$3,$3) returning id`, [f.orgId, f.projectId, api.toLowerCase()])).id
      const br = (await one(
        `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [ds])).id
      await commitRows(ds, br, [{ name: 'pk', type: 'STRING' }], async (phys, file) => {
        await db.query(
          `insert into datasets.${phys} (_file, pk) select $1, unnest($2::text[])`, [file, keys])
      })
      const t = (await one(
        `insert into public.object_types (ontology_id, project_id, api_name, label)
         values ($1,$2,$3,$3) returning id`, [ont, f.projectId, api])).id
      await db.query(
        `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
         values ($1,$2,$3)`, [t, ds, br])
      await db.query(
        `insert into public.object_type_properties
           (object_type_id, property_id, api_name, display_name, base_type, source,
            backing_column, is_primary_key, is_title_key, required)
         values ($1,'pk','id','Id','string','column','pk',true,true,true)`, [t])
      if (api === 'LinkIdxA') ta = t; else tb = t
    }
    await db.query('select public.run_index_build($1::uuid[], true)', [[ta, tb]])

    // The join dataset: three pairs, one stated twice.
    jds = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'linkidx_join','linkidx_join') returning id`, [f.orgId, f.projectId])).id
    jbr = (await one(
      `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [jds])).id
    jphys = await commitRows(jds, jbr,
      [{ name: 'a_key', type: 'STRING' }, { name: 'b_key', type: 'STRING' }],
      async (phys, file) => {
        await db.query(
          `insert into datasets.${phys} (_file, a_key, b_key)
           values ($1,'A1','B1'),($1,'A1','B2'),($1,'A2','B1'),($1,'A1','B1')`, [file])
      })

    // Front door: the link stages, the save lands it.
    await one(`select public.save_link_type($1::jsonb) as id`, [
      JSON.stringify({ source_object_type_id: ta, target_object_type_id: tb,
        api_name: 'linkidx_pairs', label: 'Link idx pairs', ontology_id: ont,
        project_id: f.projectId,
        cardinality: 'many_to_many', backing_kind: 'join_table',
        dataset_id: jds, branch_id: jbr,
        source_key_column: 'a_key', target_key_column: 'b_key' })])
    await db.query('select public.save_working_state()')
    link = (await one(`select id from public.link_types where api_name='linkidx_pairs'`)).id
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('refuses to traverse before the pair store exists, by name', async () => {
    const err = await refused(db, () => db.query(
      'select public.count_object_set($1,$2::jsonb)',
      [ta, JSON.stringify(presence('linkidx_pairs', 'MUST_HAVE'))]))
    expect(err).toContain('Ontology:LinkNotIndexed')
  })

  it('builds the pair store through a real job, deduped', async () => {
    const build = (await one(
      'select public.run_link_index_build(array[$1]::uuid[], true) as b', [link])).b
    const job = await one(
      'select state, error from public.build_jobs where build_id=$1 and output_link_type_id=$2',
      [build, link])
    expect(job.state, job.error ?? '').toBe('COMPLETED')
    const idx = await one(
      'select link_count, index_table from public.link_type_indexes where link_type_id=$1', [link])
    expect(Number(idx.link_count), 'four rows, one duplicate: three pairs').toBe(3)
  })

  it('a search-around is a left-semi join, both directions and both match types', async () => {
    // "returns only the objects from the result set that have matching links"
    expect(await count(ta, presence('linkidx_pairs', 'MUST_HAVE'))).toBe(2)
    expect(await count(ta, presence('linkidx_pairs', 'MUST_NOT_HAVE'))).toBe(1)
    expect(await count(tb, presence('linkidx_pairs', 'MUST_HAVE'))).toBe(2)
    expect(await count(tb, presence('linkidx_pairs', 'MUST_NOT_HAVE'))).toBe(1)
  })

  it('a fresh pair store is not rebuilt; a moved join dataset is', async () => {
    const again = (await db.query(
      'select public.run_link_index_build(array[$1]::uuid[], false) as b', [link])).rows[0] as { b: string | null }
    expect(again.b, 'fresh: no build at all').toBeNull()

    // The append restates a pair the store already holds: the rebuild runs
    // (staleness is the dataset moving) and the count stays (dedupe holds
    // across files).
    await commitRows(jds, jbr, [], async (_phys, file) => {
      await db.query(
        `insert into datasets.${jphys} (_file, a_key, b_key) values ($1,'A1','B1')`, [file])
    })
    const rebuilt = (await one(
      'select public.run_link_index_build(array[$1]::uuid[], false) as b', [link])).b
    expect(rebuilt, 'stale: a build ran').not.toBeNull()
    const idx = await one(
      'select link_count from public.link_type_indexes where link_type_id=$1', [link])
    expect(Number(idx.link_count)).toBe(3)
  })

  it('the heartbeat picks up a stale pair store unprompted', async () => {
    await commitRows(jds, jbr, [], async (_phys, file) => {
      await db.query(
        `insert into datasets.${jphys} (_file, a_key, b_key) values ($1,'A3','B3')`, [file])
    })
    expect(Number((await one('select public.run_stale_indexes(clock_timestamp()) as n')).n))
      .toBeGreaterThan(0)
    const idx = await one(
      'select link_count from public.link_type_indexes where link_type_id=$1', [link])
    expect(Number(idx.link_count), 'the new pair arrived without anyone asking').toBe(4)
    expect(await count(ta, presence('linkidx_pairs', 'MUST_NOT_HAVE'))).toBe(0)
  })

  it('an object-backed link still refuses, scoped to what is unbuilt', async () => {
    await db.query(
      `insert into public.link_types (ontology_id, project_id, source_object_type_id,
         target_object_type_id, api_name, label, cardinality, backing_kind, backing_object_type_id)
       values ($1,$2,$3,$4,'linkidx_via','Link idx via','many_to_one','object_backed',$4)`,
      [ont, f.projectId, ta, tb])
    const err = await refused(db, () => db.query(
      'select public.count_object_set($1,$2::jsonb)',
      [ta, JSON.stringify(presence('linkidx_via', 'MUST_HAVE'))]))
    expect(err).toContain('Ontology:LinkFilterBackingUnsupported')
  })

  it('deleting the link type drops its pair store', async () => {
    const idx = await one(
      'select index_table from public.link_type_indexes where link_type_id=$1', [link])
    await db.query('delete from public.link_types where id=$1', [link])
    const gone = await one(
      `select count(*)::int as n from information_schema.tables
        where table_schema='objects' and table_name=$1`, [idx.index_table])
    expect(Number(gone.n)).toBe(0)
  })
})
