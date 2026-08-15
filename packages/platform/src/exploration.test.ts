// The exploration engine, re-asked on every CI run.
//
// Migration 475 asserts this once, at the moment it landed — applied
// migrations are immutable and run once. The questions here are the durable
// ones: the documented filter grammar (generate-urls.md), the render-hint
// gates (metadata-render-hints.md), hidden properties appearing nowhere
// (search-objects.md), and the aggregation vocabulary of the charts page.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('the exploration engine', () => {
  let db: pg.Client
  let f: Fixture
  let flight = ''
  let airline = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const count = async (filters: unknown) =>
    Number((await one('select public.count_object_set($1,$2::jsonb) as n', [flight, JSON.stringify(filters)])).n)

  // An index is what a build produces, so the fixture builds one.
  const reindex = async (t: string) => {
    const build = (await one('select public.run_index_build(array[$1]::uuid[], true) as b', [t])).b
    const job = await one('select state, error from public.build_jobs where build_id = $1', [build])
    expect(job.state, job.error ?? '').toBe('COMPLETED')
  }

  // Two datasets materialize and two indexes build; the default 10s is tight.
  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'explore475')
    // Saving into a project reads the caller's project role, which needs a
    // real user behind the claims — the bare fixture claims carry none.
    const usr = (await one('select gen_random_uuid() as id')).id
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, `explore475-${Date.now()}@beacon.test`])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, `explore475-${Date.now()}@beacon.test`, f.orgId])
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, usr, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])
    const ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'explore475','Explore',false) returning id`, [f.spaceId])).id

    // Flights over a materialized datasource, exactly the 442 pipeline.
    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [f.datasetId, f.branchId])).id
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      [f.datasetId, txn, JSON.stringify([
        { name: 'flight_id', type: 'STRING' }, { name: 'status', type: 'STRING' },
        { name: 'origin', type: 'STRING' }, { name: 'distance', type: 'DOUBLE' },
        { name: 'day', type: 'DATE' }, { name: 'airline_id', type: 'STRING' }])])
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'flights.parquet',4) returning id`, [f.datasetId, txn])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [txn])
    const tbl = (await one('select public.dataset_materialize($1,$2) as t', [f.datasetId, txn])).t
    await db.query(
      `insert into datasets.${tbl} (_file, flight_id, status, origin, distance, day, airline_id) values
        ($1,'F1','on time','JFK', 100,'2026-01-01','A1'),
        ($1,'F2','delayed','JFK',2500,'2026-02-01','A1'),
        ($1,'F3','on time','SFO', 900,'2026-03-01','A1'),
        ($1,'F4','delayed','LAX',1200,'2026-04-01',null)`, [file])

    flight = (await one(
      `insert into public.object_types (ontology_id, api_name, label)
       values ($1,'Flight','Flight') returning id`, [ont])).id
    const src = (await one(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3) returning id`, [flight, f.datasetId, f.branchId])).id
    for (const [pid, api, base, pk] of [
      ['flight_id', 'flightId', 'string', true], ['status', 'status', 'string', false],
      ['origin', 'origin', 'string', false], ['distance', 'distance', 'double', false],
      ['day', 'day', 'date', false], ['airline_id', 'airlineId', 'string', false],
    ] as [string, string, string, boolean][]) {
      await db.query(
        `insert into public.object_type_properties
           (object_type_id, property_id, display_name, api_name, base_type,
            backing_column, datasource_id, required, is_primary_key, is_title_key)
         values ($1,$2,$2,$3,$4,$2,$5,$6,$6,$6)`,
        [flight, pid, api, base, src, pk])
    }

    // Airlines: the ONE side a foreign-key link joins on its primary key.
    const dsa = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'explore475_air','airlines') returning id`, [f.orgId, f.projectId])).id
    const bra = (await one(
      `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [dsa])).id
    const txna = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [dsa, bra])).id
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields)
       values ($1,$2,'[{"name":"airline_id","type":"STRING"}]'::jsonb)`, [dsa, txna])
    const fa = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'airlines.parquet',2) returning id`, [dsa, txna])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [txna])
    const tbla = (await one('select public.dataset_materialize($1,$2) as t', [dsa, txna])).t
    await db.query(`insert into datasets.${tbla} (_file, airline_id) values ($1,'A1'),($1,'A2')`, [fa])

    airline = (await one(
      `insert into public.object_types (ontology_id, api_name, label)
       values ($1,'Airline','Airline') returning id`, [ont])).id
    const srca = (await one(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3) returning id`, [airline, dsa, bra])).id
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type,
          backing_column, datasource_id, required, is_primary_key, is_title_key)
       values ($1,'airline_id','airline_id','airlineId','string','airline_id',$2,true,true,true)`,
      [airline, srca])

    await db.query(
      `insert into public.link_types (ontology_id, source_object_type_id, target_object_type_id,
         api_name, label, source_api_name, source_label, target_api_name, target_label,
         cardinality, backing_kind, backing_column)
       values ($1,$2,$3,'flight-to-airline','Flight to Airline',
         'flights','Flights','airline','Airline','many_to_one','foreign_key','airline_id')`,
      [ont, flight, airline])

    await reindex(flight)
    await reindex(airline)
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('answers the documented filter grammar over the index', async () => {
    expect(await count([])).toBe(4)
    expect(await count([{ type: 'propertyFilter', propertyType: 'status',
      value: { type: 'valuesFilter', values: ['on time'] } }])).toBe(2)
    // "Matches objects where the property contains all search tokens."
    expect(await count([{ type: 'propertyFilter', propertyType: 'status',
      value: { type: 'textFilter', text: 'time on' } }])).toBe(2)
    expect(await count([{ type: 'propertyFilter', propertyType: 'distance',
      value: { type: 'numberRangeFilter', min: 1000 } }])).toBe(2)
    expect(await count([{ type: 'propertyFilter', propertyType: 'day',
      value: { type: 'dateRangeFilter', dateRangeFilter: { start: '2026-02-15' } } }])).toBe(2)
  })

  it('filters on link presence over foreign-key backing, both ways', async () => {
    const has = { type: 'linkFilter', linkType: 'flight-to-airline',
      value: { type: 'presenceFilter', matchType: 'MUST_HAVE' } }
    expect(await count([has])).toBe(3)
    expect(await count([{ ...has, value: { type: 'presenceFilter', matchType: 'MUST_NOT_HAVE' } }])).toBe(1)
  })

  it('sorts in order and rejects the grammar it should', async () => {
    const first = (await db.query(
      `select e from public.evaluate_object_set($1,'[]','[{"property":"distance","direction":"desc"}]',1,0) e`,
      [flight])).rows[0] as { e: { distance: number } }
    expect(Number(first.e.distance)).toBe(2500)

    // "You can have many PROPERTY filters, but only 1 LINK filter."
    const twoLinks = [
      { type: 'linkFilter', linkType: 'a', value: { type: 'presenceFilter', matchType: 'MUST_HAVE' } },
      { type: 'linkFilter', linkType: 'b', value: { type: 'presenceFilter', matchType: 'MUST_HAVE' } }]
    const msg = await refused(db, () =>
      db.query('select public.count_object_set($1,$2::jsonb)', [flight, JSON.stringify(twoLinks)]))
    expect(msg).toContain('Ontology:InvalidFilters')
  })

  it('aggregates with the charts vocabulary, and histograms partition', async () => {
    const top = (await db.query(
      `select * from public.aggregate_object_set($1,'[]','status','distance')`, [flight]))
      .rows[0] as Record<string, string>
    expect(top.group_value).toBe('delayed')
    expect(Number(top.object_count)).toBe(2)
    expect(Number(top.sum)).toBe(3700)

    const single = (await db.query(
      `select * from public.aggregate_object_set($1,'[]',null,'distance')`, [flight]))
      .rows[0] as Record<string, string>
    expect(Number(single.object_count)).toBe(4)
    expect(Number(single.sum)).toBe(4700)
    expect(Number(single.unique_count)).toBe(4)

    const buckets = (await db.query(
      `select * from public.histogram_object_set($1,'[]','distance',4)`, [flight]))
      .rows as { object_count: string }[]
    expect(buckets.reduce((s, b) => s + Number(b.object_count), 0)).toBe(4)
  })

  it('hides hidden properties everywhere, and the hints gate by name', async () => {
    await db.query(
      `update public.object_type_properties set visibility='hidden'
       where object_type_id=$1 and property_id='origin'`, [flight])
    await db.query(
      `update public.object_type_properties set searchable=false, sortable=false, selectable=false
       where object_type_id=$1 and property_id='status'`, [flight])
    await reindex(flight) // the flips mark the index stale (442)

    const row = (await db.query(
      `select e from public.evaluate_object_set($1,'[]','[]',1,0) e`, [flight]))
      .rows[0] as { e: Record<string, unknown> }
    expect(row.e).not.toHaveProperty('origin')

    expect(await refused(db, () => db.query(
      'select public.count_object_set($1,$2::jsonb)',
      [flight, JSON.stringify([{ type: 'propertyFilter', propertyType: 'origin',
        value: { type: 'valuesFilter', values: ['JFK'] } }])])))
      .toContain('Ontology:PropertyIsHidden')

    expect(await refused(db, () => db.query(
      'select public.count_object_set($1,$2::jsonb)',
      [flight, JSON.stringify([{ type: 'propertyFilter', propertyType: 'status',
        value: { type: 'textFilter', text: 'on' } }])])))
      .toContain('Ontology:PropertyNotSearchable')

    expect(await refused(db, () => db.query(
      `select e from public.evaluate_object_set($1,'[]','[{"property":"status"}]',1,0) e`, [flight])))
      .toContain('Ontology:PropertyNotSortable')

    expect(await refused(db, () => db.query(
      `select * from public.aggregate_object_set($1,'[]','status',null)`, [flight])))
      .toContain('Ontology:PropertyNotSelectable')

    // "Searchable must be selected in order for applications to apply the
    // Selectable, Sortable, or Low cardinality render hints."
    expect(await refused(db, () => db.query(
      `update public.object_type_properties set sortable=true
       where object_type_id=$1 and property_id='status'`, [flight])))
      .toContain('hints_need_searchable')
  })

  it('holds saved sets to the same grammar', async () => {
    const { rows } = await db.query('select ontology_id from public.object_types where id=$1', [flight])
    const ont = (rows[0] as { ontology_id: string }).ontology_id
    await db.query(
      `insert into public.object_sets (ontology_id, project_id, name, api_name, subject_type_id, filters)
       values ($1,$2,'Delayed','delayed_475',$3,$4::jsonb)`,
      [ont, f.projectId, flight, JSON.stringify([{ type: 'propertyFilter', propertyType: 'status',
        value: { type: 'valuesFilter', values: ['delayed'] } }])])
    expect(await refused(db, () => db.query(
      `insert into public.object_sets (ontology_id, project_id, name, api_name, subject_type_id, filters)
       values ($1,$2,'Bad','bad_475',$3,'[{"type":"nonsense"}]'::jsonb)`, [ont, f.projectId, flight])))
      .toContain('object_sets_filters_check')
  })

  it('saves a dynamic exploration and a static list, and only one follows the world', async () => {
    const save = async (kind: string, name: string) => (await one(
      'select public.save_object_set($1::jsonb) as id',
      [JSON.stringify({ name, subject_type_id: flight, project_id: f.projectId,
        set_kind: kind, filters: [{ type: 'propertyFilter', propertyType: 'distance',
          value: { type: 'numberRangeFilter', min: 1000 } }] })])).id
    const size = async (id: string) =>
      Number((await one('select public.object_set_size($1) as n', [id])).n)

    const exploration = await save('exploration', 'Long flights')
    const list = await save('list', 'Long flights snapshot')
    expect(await size(exploration)).toBe(2)
    expect(await size(list)).toBe(2)

    // A new long flight arrives: "updates with new results" versus "will not
    // change unless manually updated".
    await db.query(`update public.object_types set edits_enabled=true where id=$1`, [flight])
    await db.query(
      `insert into public.object_edits (object_type_id, primary_key, instruction, properties)
       values ($1,'F9','create','{"flight_id":"F9","distance":9000}'::jsonb)`, [flight])
    await reindex(flight)
    expect(await size(exploration)).toBe(3)
    expect(await size(list)).toBe(2)
  })
})
