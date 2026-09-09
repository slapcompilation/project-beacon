// Time series, as regression tests rather than migration assertions.
//
// 774 and 775 assert this once, at the moment each landed. These are the same
// invariants asked on every CI run: a sync's three columns are the ones
// time-series-syncs prints, a time-series datasource is the fourth arm of the
// union and carries no columns of its own, a bound property is a time series
// property of that object type, and an object's points come back — windowed,
// and only to a caller who may read the sync's dataset.
//
// Everything runs as `authenticated`.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('time series', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let machine = ''
  let tabular = ''
  let tsp = ''
  let sync = ''
  let pointsDataset = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)

  /** A committed, materialized dataset with the given schema and rows. */
  const dataset = async (slug: string, fields: unknown, rows: string) => {
    const ds = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,$3,$3) returning id`, [f.orgId, f.projectId, slug])).id
    const br = (await one(
      `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [ds])).id
    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [ds, br])).id
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      [ds, txn, JSON.stringify(fields)])
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,$3,1) returning id`, [ds, txn, `${slug}.parquet`])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [txn])
    const tbl = (await one('select public.dataset_materialize($1,$2) as t', [ds, txn])).t
    await db.query(rows.replace(/__TBL__/g, tbl), [file])
    return { ds, br }
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'ts774')
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'ts774','TS',false) returning id`, [f.spaceId])).id

    // The object type's backing dataset: a primary key and a series id column.
    const machines = await dataset('ts774_machines',
      [{ name: 'machine_id', type: 'STRING' }, { name: 'temperature_id', type: 'STRING' }],
      `insert into datasets.__TBL__ (_file, machine_id, temperature_id)
       values ($1,'M1','M1-temp'), ($1,'M2','M2-temp')`)

    // The sync's dataset: the three columns the glossary calls exact.
    const points = await dataset('ts774_points',
      [{ name: 'series_id', type: 'STRING' }, { name: 'ts', type: 'TIMESTAMP' }, { name: 'val', type: 'DOUBLE' }],
      `insert into datasets.__TBL__ (_file, series_id, ts, val)
       values ($1,'M1-temp','2026-01-01T00:00:00Z',10.0),
              ($1,'M1-temp','2026-01-01T01:00:00Z',11.5),
              ($1,'M2-temp','2026-01-01T00:00:00Z',99.0)`)
    pointsDataset = points.ds

    machine = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'TsMachine774','Machine') returning id`, [ont, f.projectId])).id
    tabular = (await one(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3) returning id`, [machine, machines.ds, machines.br])).id
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source,
          backing_column, datasource_id, is_primary_key, is_title_key, required)
       values ($1,'machine_id','Machine Id','machineId','string','column','machine_id',$2,true,true,true)`,
      [machine, tabular])
    // 779: the api makes itemType required on a timeseries property type. The
    // sync's value column is a DOUBLE, so these series are numeric.
    tsp = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source,
          backing_column, datasource_id, time_series_item_type)
       values ($1,'temperature_id','Temperature','temperature','time_series','column','temperature_id',$2,'double')
       returning id`, [machine, tabular])).id

    sync = (await one(
      `insert into public.time_series_syncs
         (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
       values ($1,$2,$3,'TS774 points','series_id','ts','val') returning id`,
      [f.orgId, f.projectId, points.ds])).id
    const tsDs = (await one(
      `insert into public.object_type_datasources (object_type_id, time_series_sync_id)
       values ($1,$2) returning id`, [machine, sync])).id
    await db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [tsDs, tsp])

    const build = (await one(
      'select public.run_index_build(array[$1]::uuid[], true) as b', [machine])).b
    const job = await one('select state, error from public.build_jobs where build_id = $1', [build])
    expect(job.state, job.error ?? '').toBe('COMPLETED')
  }, 90_000)
  afterAll(async () => { await rollback(db) })

  // "Each series ID column in the time series object type backing dataset maps
  //  to one TSP" — the column keeps holding strings, so the indexed column is
  //  text. Before 774 it fell through to jsonb and the build still succeeded.
  it('indexes a series id as text, not as the jsonb it used to fall through to', async () => {
    expect((await one(`select public.property_column_type('time_series') as t`)).t).toBe('text')
  })

  it('returns an object’s points, and a window narrows them', async () => {
    expect(await count(
      `select count(*) n from public.time_series_points($1,'M1','temperature_id')`, [machine])).toBe(2)
    expect(await count(
      `select count(*) n from public.time_series_points($1,'M2','temperature_id')`, [machine])).toBe(1)
    const first = await one(
      `select num from public.time_series_points($1,'M1','temperature_id') order by point_time limit 1`,
      [machine])
    expect(Number(first.num)).toBe(10)
    expect(await count(
      `select count(*) n from public.time_series_points($1,'M1','temperature_id','2026-01-01T00:30:00Z',null)`,
      [machine])).toBe(1)
  })

  it('refuses a sync column that is not in its dataset, or is the wrong type', async () => {
    const mk = (name: string, sid: string, ts: string, val: string) => db.query(
      `insert into public.time_series_syncs
         (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [f.orgId, f.projectId, pointsDataset, name, sid, ts, val])
    expect(await refused(db, () => mk('nope col', 'nope', 'ts', 'val')))
      .toContain('TimeSeries:SyncColumnNotInDataset')
    // "timestamp: ... (`timestamp` or `long`)"
    expect(await refused(db, () => mk('bad time', 'series_id', 'val', 'val')))
      .toContain('TimeSeries:TimestampTypeNotAllowed')
    // A string value is a CATEGORICAL series, and is allowed.
    await mk('categorical', 'series_id', 'ts', 'series_id')
  })

  // The api's timeSeries datasource carries a flat properties list, not a
  // column mapping, so the binding says which properties — and only which.
  it('binds only time series properties of its own object type', async () => {
    const tsDs = (await one(
      `select id from public.object_type_datasources
        where object_type_id = $1 and time_series_sync_id is not null limit 1`, [machine])).id
    const pk = (await one(
      `select id from public.object_type_properties
        where object_type_id = $1 and is_primary_key`, [machine])).id
    expect(await refused(db, () => db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [tsDs, pk]))).toContain('TimeSeries:NotATimeSeriesProperty')
  })

  // 586 wrote "it does not include media sets or time series syncs" and could
  // only implement half of it; a sync must not count toward the limit, and
  // must not be treated as a dataset by the organization check.
  it('is the fourth arm of the datasource union, and no arm admits two backings', async () => {
    expect(await count(
      `select count(*) n from public.object_type_datasources
        where object_type_id = $1 and time_series_sync_id is not null`, [machine])).toBe(1)
    expect(await refused(db, () => db.query(
      `insert into public.object_type_datasources (object_type_id, time_series_sync_id, media_set_rid)
       values ($1,$2,'ri.mio.main.media-set.00000000-0000-0000-0000-000000000000')`, [machine, sync])))
      .toContain('object_type_datasources_one_backing')
  })

  // ── 779: a time series property says what its values are ─────────────────
  // "A union of the types supported by time series properties": string, double,
  // numericOrNonNumeric — the last being the one whose type "must be inferred
  // from the result of a time series query".
  it('returns the column its itemType promises', async () => {
    const point = async () => await one(
      `select num, cat from public.time_series_points($1,'M1','temperature_id') order by point_time limit 1`,
      [machine])

    // declared double: a number, and no categorical value
    let p = await point()
    expect(Number(p.num)).toBe(10)
    expect(p.cat).toBeNull()

    await db.query(
      `update public.object_type_properties set time_series_item_type = 'string' where id = $1`, [tsp])
    p = await point()
    expect(p.num).toBeNull()
    expect(p.cat).not.toBeNull()

    // the mixed member keeps both, because that is the one that says to infer
    await db.query(
      `update public.object_type_properties set time_series_item_type = 'numericOrNonNumeric' where id = $1`, [tsp])
    p = await point()
    expect(p.num).not.toBeNull()
    expect(p.cat).not.toBeNull()

    await db.query(
      `update public.object_type_properties set time_series_item_type = 'double' where id = $1`, [tsp])
  })

  it('requires the declaration of a bound property, and refuses the per-series boolean', async () => {
    const tsDs = (await one(
      `select id from public.object_type_datasources
        where object_type_id = $1 and time_series_sync_id is not null limit 1`, [machine])).id
    await db.query(`delete from public.object_type_time_series_sources where property_id = $1`, [tsp])
    await db.query(
      `update public.object_type_properties set time_series_item_type = null where id = $1`, [tsp])
    expect(await refused(db, () => db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [tsDs, tsp]))).toContain('TimeSeries:ItemTypeNotDeclared')

    // isNonNumericPropertyTypeId is storable and refused, rather than stored
    // and ignored: it resolves per SERIES and the reader does not do that yet.
    const boolProp = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
       values ($1,'is_cat','Is categorical','isCat','boolean','column','machine_id',$2) returning id`,
      [machine, tabular])).id
    await db.query(
      `update public.object_type_properties
          set time_series_item_type = 'numericOrNonNumeric', time_series_is_non_numeric_property_id = $2
        where id = $1`, [tsp, boolProp])
    expect(await refused(db, () => db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [tsDs, tsp]))).toContain('TimeSeries:MixedSeriesNotBuilt')
  })

  it('carries the rid the time series catalogue names it by', async () => {
    const r = await one(`select rid from public.time_series_syncs where id = $1`, [sync])
    expect(r.rid).toBe(`ri.time-series-catalog.main.sync.${sync}`)
  })
})
