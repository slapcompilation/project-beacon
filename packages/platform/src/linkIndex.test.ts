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

  it('an object lists its linked objects through the pair store (752)', async () => {
    // "Lists the linked objects for a specific object and the given link
    // type" — whole far rows, no totalCount; the badge is the companion.
    const { rows } = await db.query(
      `select e from public.list_linked_objects($1,'A1','linkidx_pairs') e`, [ta])
    expect(rows.map((r) => (r.e as { pk: string }).pk)).toEqual(['B1', 'B2'])
    expect(Number((await one(
      `select public.count_linked_objects($1,'A1','linkidx_pairs') as n`, [ta])).n)).toBe(2)
    // Paged: the second page holds the second row.
    const page = await db.query(
      `select e from public.list_linked_objects($1,'A1','linkidx_pairs',1,1) e`, [ta])
    expect((page.rows[0].e as { pk: string }).pk).toBe('B2')
    // And from the far side back.
    const back = await db.query(
      `select e from public.list_linked_objects($1,'B3','linkidx_pairs') e`, [tb])
    expect(back.rows.map((r) => (r.e as { pk: string }).pk)).toEqual(['A3'])
  })

  it('a function-backed action links and unlinks, immediately and revertibly (753)', async () => {
    // "For many-to-many links, the link and unlink methods are available" —
    // the addLink lands in the pair store synchronously ("visible immediately
    // after the action completes") and the revert appends the compensation.
    const fnId = (await one(
      `insert into public.functions (ontology_id, api_name, display_name)
       values ($1,'linkidxEditFn','Link idx edit fn') returning id`, [ont])).id
    const ver = (await one(
      `insert into public.function_versions (function_id, major, minor, patch, source, signature, imports, edits)
       values ($1,1,0,0,'export default function f(){return []}',
               '{"parameters":[],"returns":"OntologyEdit[]"}'::jsonb,
               '{"object_types":[],"link_types":[]}'::jsonb,
               '{"object_types":["LinkIdxA","LinkIdxB"]}'::jsonb) returning id`, [fnId])).id
    const act = (await one(
      `insert into public.action_types (ontology_id, api_name, label, allow_revert)
       values ($1,'linkidx-run','Link idx run',true) returning id`, [ont])).id
    await db.query(
      `insert into public.action_type_rules (action_type_id, kind, position, function_name, function_version_id)
       values ($1,'function',0,'linkidxEditFn',$2)`, [act, ver])

    const app = (await one(
      `select (public.action_function_preflight($1,'{}'::jsonb) ->> 'application_id') as id`, [act])).id
    await db.query(`select public.apply_function_edits($1, $2::jsonb, $3)`, [act, JSON.stringify([
      { addLink: { linkTypeApiNameAtoB: 'linkidx_pairs',
        aSideObject: { objectType: 'LinkIdxA', primaryKey: 'A2' },
        bSideObject: { objectType: 'LinkIdxB', primaryKey: 'B3' } } }]), app])
    expect(Number((await one(
      `select public.count_linked_objects($1,'A2','linkidx_pairs') as n`, [ta])).n),
      'the added link is visible immediately').toBe(2)

    await db.query('select public.revert_action($1)', [app])
    expect(Number((await one(
      `select public.count_linked_objects($1,'A2','linkidx_pairs') as n`, [ta])).n),
      'the revert takes it back').toBe(1)
  })

  it('a create-link rule runs, through the front door, and reverts (755)', async () => {
    // "Create link(s): Can be used to create a many-to-many link between
    // objects that are passed via object reference parameters."
    await one(`select public.save_action_type($1::jsonb) as id`, [JSON.stringify({
      api_name: 'linkidx-pair-up', label: 'Pair up', ontology_id: ont, project_id: f.projectId,
      parameters: [
        { api_name: 'left', display_name: 'Left', data_kind: 'object', object_type_id: ta,
          required: true, exposed: true, editable: true, position: 0 },
        { api_name: 'right', display_name: 'Right', data_kind: 'object', object_type_id: tb,
          required: true, exposed: true, editable: true, position: 1 }],
      rules: [{ kind: 'create_link', position: 0, link_type_id: link,
        source_parameter_api_name: 'left', target_parameter_api_name: 'right', properties: [] }],
    })])
    await db.query('select public.save_working_state()')
    const act = (await one(
      `select id from public.action_types where api_name='linkidx-pair-up'`)).id

    await db.query(`select public.apply_action($1, '{"left":"A3","right":"B1"}'::jsonb)`, [act])
    expect(Number((await one(
      `select public.count_linked_objects($1,'A3','linkidx_pairs') as n`, [ta])).n),
      'the rule-created link is visible immediately').toBe(2)

    const app = (await one(
      `select id from public.action_applications where action_type_id=$1
        order by applied_at desc limit 1`, [act])).id
    await db.query('select public.revert_action($1)', [app])
    expect(Number((await one(
      `select public.count_linked_objects($1,'A3','linkidx_pairs') as n`, [ta])).n),
      'the revert takes it back').toBe(1)
  })

  // 765 built the object-backed walk, so what this asked has moved: an
  // object-backed link may not exist WITHOUT its edges (create-link-type makes
  // them a prerequisite), and the refusal that remains names a link with no
  // backing at all.
  it('an object-backed link cannot exist without its edges, and a backing-less link still refuses (765)', async () => {
    expect(await refused(db, () => db.query(
      `insert into public.link_types (ontology_id, project_id, source_object_type_id,
         target_object_type_id, api_name, label, cardinality, backing_kind, backing_object_type_id)
       values ($1,$2,$3,$4,'linkidx_via','Link idx via','many_to_one','object_backed',$4)`,
      // 766 made the edge guard a CONSTRAINT trigger, so the row's own CHECK
      // answers for the row and the guard answers only for the edges.
      [ont, f.projectId, ta, tb]))).toMatch(/link_types_object_backed_edges/)

    await db.query(
      `insert into public.link_types (ontology_id, project_id, source_object_type_id,
         target_object_type_id, api_name, label, cardinality)
       values ($1,$2,$3,$4,'linkidx_bare','Link idx bare','many_to_one')`,
      [ont, f.projectId, ta, tb])
    const err = await refused(db, () => db.query(
      'select public.count_object_set($1,$2::jsonb)',
      [ta, JSON.stringify(presence('linkidx_bare', 'MUST_HAVE'))]))
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

  // ── 765: an object-backed link names its edges, and a search-around walks
  // them. "The object in the middle serves as the intermediary and provides
  // additional metadata about the connection between the two entities, and
  // backs the link." Its own three types, because an object-backed link needs
  // each side's primary-key column named on the middle (417's FK rule).
  it('walks an object-backed link through the object in the middle, both ways (765)', async () => {
    const mk = async (api: string, col: string, keys: string[]) => {
      const ds = (await one(
        `insert into public.datasets (organization_id, project_id, api_name, name)
         values ($1,$2,$3,$3) returning id`, [f.orgId, f.projectId, api.toLowerCase()])).id
      const br = (await one(
        `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [ds])).id
      await commitRows(ds, br, [{ name: col, type: 'STRING' }], async (phys, file) => {
        await db.query(`insert into datasets.${phys} (_file, ${col}) select $1, unnest($2::text[])`, [file, keys])
      })
      const t = (await one(
        `insert into public.object_types (ontology_id, project_id, api_name, label)
         values ($1,$2,$3,$3) returning id`, [ont, f.projectId, api])).id
      await db.query(`insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
                      values ($1,$2,$3)`, [t, ds, br])
      await db.query(
        `insert into public.object_type_properties
           (object_type_id, property_id, api_name, display_name, base_type, source,
            backing_column, datasource_id, is_primary_key, is_title_key, required)
         values ($1,$2,'id','Id','string','column',$2,
                 (select id from public.object_type_datasources where object_type_id = $1),
                 true,true,true)`, [t, col])
      return t
    }
    const tc = await mk('LinkIdxC', 'c_pk', ['C1', 'C2'])
    const td = await mk('LinkIdxD', 'd_pk', ['D1', 'D2'])

    // the manifest: its own key, plus one column per side, named as each
    // side's primary key column so 417's foreign-key rule is satisfied
    const mds = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'linkidx_mid','linkidx_mid') returning id`, [f.orgId, f.projectId])).id
    const mbr = (await one(
      `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [mds])).id
    await commitRows(mds, mbr,
      [{ name: 'pk', type: 'STRING' }, { name: 'c_pk', type: 'STRING' }, { name: 'd_pk', type: 'STRING' }],
      async (phys, file) => {
        // C1 reaches D1; C2's manifest names a D that does not exist.
        await db.query(`insert into datasets.${phys} (_file, pk, c_pk, d_pk)
                        values ($1,'M1','C1','D1'),($1,'M2','C2','GONE')`, [file])
      })
    const tm = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'LinkIdxMid','LinkIdxMid') returning id`, [ont, f.projectId])).id
    await db.query(`insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
                    values ($1,$2,$3)`, [tm, mds, mbr])
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source, backing_column,
          datasource_id, is_primary_key, is_title_key, required)
       values ($1,'pk','id','Id','string','column','pk',
               (select id from public.object_type_datasources where object_type_id = $1),true,true,true)`, [tm])
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source, backing_column, datasource_id)
       select $1, v.c, v.a, v.d, 'string', 'column', v.c,
              (select id from public.object_type_datasources where object_type_id = $1)
         from (values ('c_pk','cKey','C key'),('d_pk','dKey','D key')) as v(c, a, d)`, [tm])

    const edge = async (api: string, target: string, col: string) => (await one(
      `insert into public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                      api_name, label, cardinality, backing_kind, backing_column)
       values ($1,$2,$3,$4,$5,$5,'many_to_one','foreign_key',$6) returning id`,
      [ont, f.projectId, tm, target, api, col])).id
    const ec = await edge('linkidx-of-c', tc, 'c_pk')
    const ed = await edge('linkidx-of-d', td, 'd_pk')

    // the guard refuses edges that do not run from the middle to each side
    expect(await refused(db, () => db.query(
      `insert into public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                      api_name, label, cardinality, backing_kind, backing_object_type_id,
                                      source_edge_link_type_id, target_edge_link_type_id)
       values ($1,$2,$3,$4,'linkidx-bad','Bad','many_to_one','object_backed',$5,$6,$7)`,
      [ont, f.projectId, tc, td, tm, ed, ec]))).toMatch(/Ontology:LinkEdgeDoesNotReachTheSide/)

    await db.query(
      `insert into public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                      api_name, label, cardinality, backing_kind, backing_object_type_id,
                                      source_edge_link_type_id, target_edge_link_type_id)
       values ($1,$2,$3,$4,'linkidx-via','Via','many_to_one','object_backed',$5,$6,$7)`,
      [ont, f.projectId, tc, td, tm, ec, ed])
    await db.query('select public.run_index_build($1::uuid[], true)', [[tc, td, tm]])

    // the filter: one C has a link, the other's manifest names nothing real
    expect(await count(tc, presence('linkidx-via', 'MUST_HAVE'))).toBe(1)
    expect(await count(tc, presence('linkidx-via', 'MUST_NOT_HAVE'))).toBe(1)
    // and from the far side, which reads the same two edges the other way
    expect(await count(td, presence('linkidx-via', 'MUST_HAVE'))).toBe(1)

    // the listing walks it too, and the count follows
    expect(Number((await one(
      `select count(*) n from public.list_linked_objects($1,'C1','linkidx-via')`, [tc])).n)).toBe(1)
    expect(Number((await one(
      `select count(*) n from public.list_linked_objects($1,'C2','linkidx-via')`, [tc])).n)).toBe(0)
    expect(Number((await one(
      `select public.count_linked_objects($1,'D1','linkidx-via') n`, [td])).n)).toBe(1)
  })
})
