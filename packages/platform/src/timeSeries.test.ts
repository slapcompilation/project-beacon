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

  it('requires the declaration of a bound property, and that its boolean is readable', async () => {
    const pkOf = (await one(
      `select id from public.object_type_properties
        where object_type_id = $1 and is_primary_key`, [machine])).id
    const tsDs = (await one(
      `select id from public.object_type_datasources
        where object_type_id = $1 and time_series_sync_id is not null limit 1`, [machine])).id
    await db.query(`delete from public.object_type_time_series_sources where property_id = $1`, [tsp])
    await db.query(
      `update public.object_type_properties set time_series_item_type = null where id = $1`, [tsp])
    expect(await refused(db, () => db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [tsDs, tsp]))).toContain('TimeSeries:ItemTypeNotDeclared')

    // 779 refused isNonNumericPropertyTypeId outright, on the cost of "a second
    // lookup". 782 made that lookup routine and 786 reads it off the SAME index
    // row as the series id, so the refusal is gone — replaced by the one thing
    // that makes it readable at all.
    const boolProp = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
       values ($1,'is_cat','Is categorical','isCat','boolean','column','machine_id',$2) returning id`,
      [machine, tabular])).id
    await db.query(
      `update public.object_type_properties
          set time_series_item_type = 'numericOrNonNumeric', time_series_is_non_numeric_property_id = $2
        where id = $1`, [tsp, boolProp])
    await db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [tsDs, tsp])
    expect(Number((await one(
      `select count(*) as n from public.object_type_time_series_sources where property_id = $1`,
      [tsp])).n)).toBe(1)

    // A boolean the reader cannot take off the index row is refused instead.
    await db.query(`delete from public.object_type_time_series_sources where property_id = $1`, [tsp])
    await db.query(
      `update public.object_type_properties
          set time_series_is_non_numeric_property_id = $2 where id = $1`, [tsp, pkOf])
    expect(await refused(db, () => db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [tsDs, tsp]))).toContain('TimeSeries:IsNonNumericPropertyUnreadable')

    await db.query(
      `update public.object_type_properties
          set time_series_is_non_numeric_property_id = null,
              time_series_item_type = 'double' where id = $1`, [tsp])
    await db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [tsDs, tsp])
    await db.query('delete from public.object_type_properties where id = $1', [boolProp])
  })

  // ── 780: the designation, and the two silences it closes ────────────────

  // "When configuring the first time series property for an object type, that
  //  property will be set as the default time series property." The fixture
  //  never asked for it; the trigger did it as the property became one.
  it('makes the first time series property the default, and leaves the next alone', async () => {
    expect((await one(
      'select is_default_time_series as d from public.object_type_properties where id = $1',
      [tsp])).d).toBe(true)

    const second = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source,
          backing_column, datasource_id, time_series_item_type)
       values ($1,'pressure_id','Pressure','pressure','time_series','column','temperature_id',$2,'double')
       returning id`, [machine, tabular])).id
    expect((await one(
      'select is_default_time_series as d from public.object_type_properties where id = $1',
      [second])).d).toBe(false)

    // "An object type can have one time series property designated as the
    //  default time series property."
    expect(await refused(db, () => db.query(
      'update public.object_type_properties set is_default_time_series = true where id = $1',
      [second]))).toMatch(/object_type_one_default_time_series|duplicate key/)

    // The path that made an earlier draft of the trigger wrong: with the
    // default cleared and a TSP still present, a NEW one is not the first.
    await db.query(
      'update public.object_type_properties set is_default_time_series = false where id = $1', [tsp])
    const third = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source,
          backing_column, datasource_id, time_series_item_type)
       values ($1,'flow_id','Flow','flow','time_series','column','temperature_id',$2,'double')
       returning id`, [machine, tabular])).id
    expect((await one(
      'select is_default_time_series as d from public.object_type_properties where id = $1',
      [third])).d).toBe(false)

    // and time series properties with no default is a WARNING, not a violation
    expect(await count(
      `select count(*) as n from public.ontology_warnings() w
        where w.object_type = 'TsMachine774' and w.problem like 'Time series properties are configured%'`))
      .toBe(1)
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774' and v.problem like '%default time series%'`)).toBe(0)

    await db.query(
      'delete from public.object_type_properties where id = any($1::uuid[])', [[second, third]])
    await db.query(
      'update public.object_type_properties set is_default_time_series = true where id = $1', [tsp])
  })

  // "you can link a time series property to multiple time series syncs. To do
  //  this, you must have a column of qualified series IDs" — 774 excluded those,
  //  and time_series_points resolves the binding with LIMIT 1, so a second
  //  binding would be answered by whichever row came back first.
  it('resolves through one sync, and refuses a declaration the sync disagrees with', async () => {
    const states = await dataset('ts780_states',
      [{ name: 'series_id', type: 'STRING' }, { name: 'ts', type: 'TIMESTAMP' }, { name: 'val', type: 'STRING' }],
      `insert into datasets.__TBL__ (_file, series_id, ts, val)
       values ($1,'M1-temp','2026-01-01T00:00:00Z','RUNNING')`)
    const catSync = (await one(
      `insert into public.time_series_syncs
         (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
       values ($1,$2,$3,'TS780 states','series_id','ts','val') returning id`,
      [f.orgId, f.projectId, states.ds])).id

    // "A String type indicates a Categorical time series" — the sync answers
    // the question the setup dialog never asks.
    expect((await one('select public.time_series_sync_item_type($1) as t', [catSync])).t).toBe('string')
    expect((await one('select public.time_series_sync_item_type($1) as t', [sync])).t).toBe('double')

    const catDs = (await one(
      `insert into public.object_type_datasources (object_type_id, time_series_sync_id)
       values ($1,$2) returning id`, [machine, catSync])).id
    const prop = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source,
          backing_column, datasource_id, time_series_item_type)
       values ($1,'state_id','State','state','time_series','column','temperature_id',$2,'double')
       returning id`, [machine, tabular])).id

    // 779's reader nulls the categorical column for a `double` property, so
    // every point would come back empty. Refused instead.
    expect(await refused(db, () => db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [catDs, prop]))).toContain('TimeSeries:ItemTypeDisagreesWithSync')

    await db.query(
      `update public.object_type_properties
          set time_series_item_type = public.time_series_sync_item_type($2) where id = $1`,
      [prop, catSync])
    await db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [catDs, prop])

    // A SECOND sync was refused until 786. Now the two kinds differ, so the
    // declaration must be the member that says the type is inferred.
    const tsDs = (await one(
      `select id from public.object_type_datasources
        where object_type_id = $1 and time_series_sync_id = $2`, [machine, sync])).id
    expect(await refused(db, () => db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [tsDs, prop]))).toContain('TimeSeries:ItemTypeMustBeMixed')

    await db.query(
      `update public.object_type_properties
          set time_series_item_type = 'numericOrNonNumeric' where id = $1`, [prop])
    await db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [tsDs, prop])
    expect(Number((await one(
      `select count(*) as n from public.object_type_time_series_sources where property_id = $1`,
      [prop])).n), 'both syncs back the property').toBe(2)

    await db.query('delete from public.object_type_time_series_sources where property_id = $1', [prop])
    await db.query('delete from public.object_type_properties where id = $1', [prop])
    await db.query('delete from public.object_type_datasources where id = $1', [catDs])
  })

  // ── 782: the base formatter ────────────────────────────────────────

  // "Time series formatting allows setting the desired internal interpolation
  //  and units of the time series." Both halves are the api's constant-or-
  //  property operand, which is why formatting_operand_valid already validates
  //  them and why an invented shape is refused.
  it('takes the api\'s operand and the five interpolations the page publishes', async () => {
    expect(await refused(db, () => db.query(
      `update public.object_type_properties set time_series_units = '{"value":"kg"}'::jsonb
        where id = $1`, [tsp]))).toMatch(/time_series_formatting_is_an_operand/)

    expect(await refused(db, () => db.query(
      `update public.object_type_properties
          set time_series_interpolation = '{"constant":{"value":"SPLINE"}}'::jsonb where id = $1`,
      [tsp]))).toMatch(/time_series_interpolation_is_a_published_member/)

    // and a formatter only belongs on a time series property
    const other = (await one(
      `select id from public.object_type_properties
        where object_type_id = $1 and base_type = 'string' limit 1`, [machine])).id
    expect(await refused(db, () => db.query(
      `update public.object_type_properties
          set time_series_units = '{"constant":{"value":"kg"}}'::jsonb where id = $1`,
      [other]))).toMatch(/time_series_formatting_only_on_a_time_series_property/)
  })

  // "By default, numeric time series use LINEAR interpolation and categorical
  //  series use PREVIOUS." Unset is not unknown.
  it('resolves the page\'s own defaults, and a constant beats them', async () => {
    // An earlier case in this file leaves the per-series boolean set, and 779's
    // CHECK ties it to numericOrNonNumeric — so it is cleared here rather than
    // inherited.
    await db.query(
      `update public.object_type_properties
          set time_series_interpolation = null, time_series_units = null,
              time_series_is_non_numeric_property_id = null,
              time_series_item_type = 'double' where id = $1`, [tsp])
    let r = await one('select * from public.time_series_formatting($1, $2)', [machine, 'temperature_id'])
    expect(r.interpolation).toBe('LINEAR')
    expect(r.units).toBeNull()

    await db.query(
      `update public.object_type_properties set time_series_item_type = 'string' where id = $1`, [tsp])
    r = await one('select * from public.time_series_formatting($1, $2)', [machine, 'temperature_id'])
    expect(r.interpolation).toBe('PREVIOUS')

    // numericOrNonNumeric "must be inferred from the result of a time series
    // query", so it resolves to nothing rather than guessing.
    await db.query(
      `update public.object_type_properties
          set time_series_item_type = 'numericOrNonNumeric' where id = $1`, [tsp])
    r = await one('select * from public.time_series_formatting($1, $2)', [machine, 'temperature_id'])
    expect(r.interpolation).toBeNull()

    await db.query(
      `update public.object_type_properties
          set time_series_item_type = 'double',
              time_series_interpolation = '{"constant":{"value":"NEXT"}}'::jsonb,
              time_series_units = '{"constant":{"value":"PSI"}}'::jsonb where id = $1`, [tsp])
    r = await one('select * from public.time_series_formatting($1, $2)', [machine, 'temperature_id'])
    expect(r.interpolation).toBe('NEXT')
    expect(r.units).toBe('PSI')
  })

  // The whole reason the pointer exists: "if each time series contained in the
  // time series property has different units and or interpolation".
  it('reads a pointer per object, and answers without one only as far as it goes', async () => {
    // The pointer names a property the INDEX carries. This fixture's index was
    // built in beforeAll, so a property added now would have no column in it;
    // machine_id is a string property of this object type and is indexed.
    await db.query(
      `update public.object_type_properties
          set time_series_units = jsonb_build_object('propertyType',
                jsonb_build_object('propertyApiName', 'machine_id')) where id = $1`, [tsp])

    // Without a primary key there is no object to resolve against, so the
    // pointer answers nothing rather than inventing a value.
    let r = await one('select * from public.time_series_formatting($1, $2)', [machine, 'temperature_id'])
    expect(r.units).toBeNull()

    // The fixture's index carries machine_id as the uom column's value.
    r = await one('select * from public.time_series_formatting($1, $2, $3)',
      [machine, 'temperature_id', 'M1'])
    expect(r.units).toBe('M1')
    r = await one('select * from public.time_series_formatting($1, $2, $3)',
      [machine, 'temperature_id', 'M2'])
    expect(r.units).toBe('M2')

    // A pointer at a property that is not a string property of this object type
    // cannot resolve, and that can become true without anyone editing the
    // formatter — so it is a violation, not a write-time refusal.
    await db.query(
      `update public.object_type_properties
          set time_series_units = jsonb_build_object('propertyType',
                jsonb_build_object('propertyApiName', 'nosuch')) where id = $1`, [tsp])
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774'
          and v.problem like '%points at a property that is not a string%'`)).toBe(1)

    await db.query(
      `update public.object_type_properties set time_series_units = null where id = $1`, [tsp])
  })

  // "LINEAR: ... Only applicable to numerical time series." No page says what
  // happens if it is set anyway, so refusing would be stricter than Foundry.
  it('warns rather than refuses LINEAR on a categorical series', async () => {
    await db.query(
      `update public.object_type_properties
          set time_series_item_type = 'string',
              time_series_is_non_numeric_property_id = null,
              time_series_interpolation = '{"constant":{"value":"LINEAR"}}'::jsonb
        where id = $1`, [tsp])
    expect(await count(
      `select count(*) as n from public.ontology_warnings() w
        where w.object_type = 'TsMachine774'
          and w.problem like 'LINEAR interpolation is only applicable%'`)).toBe(1)
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774' and v.problem like '%LINEAR%'`)).toBe(0)

    await db.query(
      `update public.object_type_properties
          set time_series_item_type = 'double', time_series_interpolation = null
        where id = $1`, [tsp])
  })

  // ── 783: sensor object types ───────────────────────────────────────

  // "You must select at least one link type which links this sensor object type
  //  to a root object type for which this records time series data" and "You
  //  must also select the property containing the Sensor name for this link
  //  type" — so an entry is a PAIR, and every part of it is checked.
  it('configures a sensor link only on a sensor, for its own string property', async () => {
    const root = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'Ts783Root','Root') returning id`, [ont, f.projectId])).id
    const lk = (await one(
      `insert into public.link_types (ontology_id, project_id, source_object_type_id,
         target_object_type_id, api_name, label, cardinality, backing_kind, backing_column)
       values ($1,$2,$3,$4,'ts783-root','Root','many_to_one','foreign_key','machine_id')
       returning id`, [ont, f.projectId, machine, root])).id
    const name = (await one(
      `select id from public.object_type_properties
        where object_type_id = $1 and property_id = 'machine_id'`, [machine])).id

    // The toggle comes first: an entry on a type that is not a sensor is refused.
    expect(await refused(db, () => db.query(
      `insert into public.object_type_sensor_links
         (object_type_id, link_type_id, sensor_name_property_id) values ($1,$2,$3)`,
      [machine, lk, name]))).toContain('TimeSeries:NotASensorObjectType')

    await db.query('update public.object_types set is_sensor = true where id = $1', [machine])

    // A sensor object type with no entry is a violation, and one entry clears it.
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774' and v.problem like '%configures no sensor link%'`)).toBe(1)

    // The sensor name must be a string property of THIS object type.
    expect(await refused(db, () => db.query(
      `insert into public.object_type_sensor_links
         (object_type_id, link_type_id, sensor_name_property_id) values ($1,$2,$3)`,
      [machine, lk, tsp]))).toContain('TimeSeries:SensorNameMustBeString')

    const foreign = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source,
          backing_column, is_primary_key, is_title_key, required)
       values ($1,'code','Code','code','string','column','code',true,true,true) returning id`,
      [root])).id
    expect(await refused(db, () => db.query(
      `insert into public.object_type_sensor_links
         (object_type_id, link_type_id, sensor_name_property_id) values ($1,$2,$3)`,
      [machine, lk, foreign]))).toContain('Ontology:PropertyNotOnThisObjectType')

    await db.query(
      `insert into public.object_type_sensor_links
         (object_type_id, link_type_id, sensor_name_property_id) values ($1,$2,$3)`,
      [machine, lk, name])
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774' and v.problem like '%configures no sensor link%'`)).toBe(0)

    // "A series ID for the sole TSP" — a second one is a violation, not a refusal.
    const second = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source,
          backing_column, datasource_id, time_series_item_type)
       values ($1,'second_id','Second','secondId','time_series','column','temperature_id',$2,'double')
       returning id`, [machine, tabular])).id
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774'
          and v.problem like 'A sensor object type has one time series property%'`)).toBe(1)

    await db.query('delete from public.object_type_properties where id = $1', [second])
    await db.query('delete from public.object_type_sensor_links where object_type_id = $1', [machine])
    await db.query('update public.object_types set is_sensor = false where id = $1', [machine])
    await db.query('delete from public.link_types where id = $1', [lk])
    await db.query('delete from public.object_types where id = $1', [root])
  })

  // ── 787: the two findings 786 deferred ──────────────────────────

  // 780 checks a string/double declaration against its sync when the BINDING is
  // made and never again. Repointing the sync is one of the three edges that
  // passes unremarked, and it makes 779's projection null the column it named.
  it('reports a declaration its own sync has stopped agreeing with', async () => {
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774' and v.problem like '%now holds%'`)).toBe(0)

    const cat = await dataset('ts787_cat',
      [{ name: 'series_id', type: 'STRING' }, { name: 'ts', type: 'TIMESTAMP' }, { name: 'val', type: 'STRING' }],
      `insert into datasets.__TBL__ (_file, series_id, ts, val)
       values ($1,'M1-temp','2026-01-01T00:00:00Z','RUNNING')`)

    // The property still declares `double`; its sync now holds strings.
    await db.query('update public.time_series_syncs set input_dataset_id = $2 where id = $1',
      [sync, cat.ds])
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774' and v.problem like '%now holds string values%'`)).toBe(1)

    await db.query('update public.time_series_syncs set input_dataset_id = $2 where id = $1',
      [sync, pointsDataset])
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774' and v.problem like '%now holds%'`)).toBe(0)
  })

  // The one place in this slice where the two audiences split, and both sides
  // are cited: the sensor page says the boolean MUST be selected, the api
  // publishes the same field as optional with a working fallback.
  it('blocks a mixed-kind sensor with no boolean, and only advises otherwise', async () => {
    const states = await dataset('ts787_states',
      [{ name: 'series_id', type: 'STRING' }, { name: 'ts', type: 'TIMESTAMP' }, { name: 'val', type: 'STRING' }],
      `insert into datasets.__TBL__ (_file, series_id, ts, val)
       values ($1,'M1-temp','2026-01-01T00:00:00Z','RUNNING')`)
    const catSync = (await one(
      `insert into public.time_series_syncs
         (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
       values ($1,$2,$3,'TS787 states','series_id','ts','val') returning id`,
      [f.orgId, f.projectId, states.ds])).id
    const catDs = (await one(
      `insert into public.object_type_datasources (object_type_id, time_series_sync_id)
       values ($1,$2) returning id`, [machine, catSync])).id

    await db.query(
      `update public.object_type_properties
          set time_series_item_type = 'numericOrNonNumeric',
              time_series_is_non_numeric_property_id = null where id = $1`, [tsp])
    await db.query(
      `insert into public.object_type_time_series_sources (datasource_id, property_id) values ($1,$2)`,
      [catDs, tsp])

    // Not a sensor: advice, and it must not block a save.
    expect(await count(
      `select count(*) as n from public.ontology_warnings() w
        where w.object_type = 'TsMachine774' and w.problem like 'Backed by syncs of both kinds%'`)).toBe(1)
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774' and v.problem like '%boolean property saying which%'`)).toBe(0)

    // The SAME configuration on a sensor object type blocks.
    await db.query('update public.object_types set is_sensor = true where id = $1', [machine])
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774' and v.problem like '%boolean property saying which%'`)).toBe(1)
    expect(await count(
      `select count(*) as n from public.ontology_warnings() w
        where w.object_type = 'TsMachine774' and w.problem like 'Backed by syncs of both kinds%'`)).toBe(0)

    // Two syncs of ONE kind are not mixed — the over-wide shape 586 got wrong.
    await db.query('update public.time_series_syncs set input_dataset_id = $2 where id = $1',
      [catSync, pointsDataset])
    expect(await count(
      `select count(*) as n from public.ontology_violations() v
        where v.object_type = 'TsMachine774' and v.problem like '%boolean property saying which%'`)).toBe(0)

    await db.query('update public.object_types set is_sensor = false where id = $1', [machine])
    await db.query('delete from public.object_type_time_series_sources where datasource_id = $1', [catDs])
    await db.query('delete from public.object_type_datasources where id = $1', [catDs])
    await db.query(
      `update public.object_type_properties set time_series_item_type = 'double' where id = $1`, [tsp])
  })

  it('carries the rid the time series catalogue names it by', async () => {
    const r = await one(`select rid from public.time_series_syncs where id = $1`, [sync])
    expect(r.rid).toBe(`ri.time-series-catalog.main.sync.${sync}`)
  })
})
