// What backs an object type, and what makes several datasources one type.
//
// "Object types are limited to a maximum of 70 datasources. Only datasources
// that are synced to object storage count towards this limit, so it does not
// include media sets or time series syncs."
//
// "This means that a specific property of an object type must come from one—and
// only one—of the input datasources (except for the primary key property, which
// must exist in every input datasource to join all datasources)."
//
// — object-permissioning/multi-datasource-objects
//
// Migration 585 added the media set view as a third backing kind and left the
// 70-counter counting it. That is the regression this file exists to catch, and
// it can only be caught by actually filling the limit: a rule about a boundary
// is not tested anywhere except at the boundary.
//
// The join key is the other half. It is reported and not refused, because the
// page's two screenshots show an object type in error with its edit standing.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('a datasource carries the key that joins it', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let type = ''
  let dsA = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  /** A dataset with a schema, on its own master branch. */
  const dataset = async (slug: string, columns: string[]) => {
    const ds = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,$3,$3) returning id`, [f.orgId, f.projectId, slug])).id
    const br = (await one(
      `insert into public.dataset_branches (dataset_id, name)
       values ($1,'master') returning id`, [ds])).id
    if (columns.length > 0) {
      const txn = (await one(
        `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
         values ($1,$2,'SNAPSHOT') returning id`, [ds, br])).id
      await db.query(
        `insert into public.dataset_schemas (dataset_id, transaction_id, fields)
         values ($1,$2,$3::jsonb)`,
        [ds, txn, JSON.stringify(columns.map((name) => ({ name, type: 'STRING' })))])
      await db.query(`update public.dataset_transactions set status='COMMITTED',
                      committed_at=now() where id=$1`, [txn])
    }
    return { ds, br }
  }

  const problems = async (id: string): Promise<string[]> => {
    const { rows } = await db.query(
      `select problem from public.datasource_mapping_problems() where subject = $1`, [id])
    return (rows as { problem: string }[]).map((r) => r.problem)
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'dsmap586')
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'dsmap586','DsMap586',false) returning id`, [f.spaceId])).id
    type = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'Craft','Craft') returning id`, [ont, f.projectId])).id

    // The first datasource, and the primary key property that names its column.
    const a = await dataset('dsmap586_a', ['tail_number', 'model'])
    dsA = (await one(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3) returning id`, [type, a.ds, a.br])).id
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source,
          backing_column, is_primary_key, is_title_key, required, datasource_id)
       values ($1,'tail_number','tailNumber','Tail number','string','column',
               'tail_number',true,true,true,null),
              ($1,'model','model','Model','string','column',
               'model',false,false,false,$2)`,
      [type, dsA])
  })

  afterAll(async () => { await rollback(db) })

  it('a media set view does not count toward the 70', async () => {
    // Its own object type: filling a limit saturates whatever it is filled on.
    const full = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'Full','Full') returning id`, [ont, f.projectId])).id

    // Sixty-nine synced datasources, in one round trip — the trigger still runs
    // per row, which is the part being tested.
    await db.query(
      `with d as (
         insert into public.datasets (organization_id, project_id, api_name, name)
         select $1, $2, 'dsmap586_fill'||g, 'dsmap586_fill'||g
           from generate_series(1,69) g
         returning id
       ), b as (
         insert into public.dataset_branches (dataset_id, name)
         select id, 'master' from d returning id, dataset_id
       )
       insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       select $3, dataset_id, id from b`, [f.orgId, f.projectId, full])

    // A media set view. Under 585's counter this is the seventieth row and the
    // next synced datasource is refused; under the page's rule it is not
    // counted at all.
    await db.query(
      `insert into public.object_type_datasources
         (object_type_id, media_set_rid, media_set_view_rid)
       values ($1,'ri.mio.main.media-set.00000000-0000-0000-0000-0000000005dc',
                  'ri.mio.main.view.00000000-0000-0000-0000-0000000005dd')`, [full])

    const seventieth = await dataset('dsmap586_seventieth', [])
    const ok = await refused(db, () => db.query(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3)`, [full, seventieth.ds, seventieth.br]))
    expect(ok).toBeNull()

    // And with the seventieth in place, the next one is refused — so the limit
    // is still a limit, it just counts the right rows.
    await db.query(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3)`, [full, seventieth.ds, seventieth.br])
    const overflow = await dataset('dsmap586_overflow', [])
    const err = await refused(db, () => db.query(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3)`, [full, overflow.ds, overflow.br]))
    expect(err).toMatch(/TooManyDatasources/)
  })

  it('a media set view has nothing to join, so it may not name a key column', async () => {
    const err = await refused(db, () => db.query(
      `insert into public.object_type_datasources
         (object_type_id, media_set_rid, media_set_view_rid, primary_key_column)
       values ($1,'ri.mio.main.media-set.00000000-0000-0000-0000-00000000060a',
                  'ri.mio.main.view.00000000-0000-0000-0000-00000000060b','tail_number')`,
      [type]))
    expect(err).toMatch(/media_has_no_join_key/)
  })

  it('the key the primary key property names is inherited by every datasource', async () => {
    expect(await problems(dsA)).toEqual([])
  })

  it('a datasource spelling the key differently is reported until it says so', async () => {
    // A second dataset whose key column is `tail`, not `tail_number`.
    const b = await dataset('dsmap586_b', ['tail', 'seats'])
    const dsB = (await one(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3) returning id`, [type, b.ds, b.br])).id
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source,
          backing_column, datasource_id)
       values ($1,'seats','seats','Seats','integer','column','seats',$2)`, [type, dsB])

    // The edit stands — the object type is in error, not the insert refused.
    expect(await problems(dsB)).toEqual([
      expect.stringContaining('must exist in every input datasource'),
    ])

    await db.query(
      `update public.object_type_datasources set primary_key_column='tail' where id=$1`, [dsB])
    expect(await problems(dsB)).toEqual([])
  })

  it('a datasource that backs nothing is reported', async () => {
    const c = await dataset('dsmap586_c', ['tail_number'])
    const dsC = (await one(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3) returning id`, [type, c.ds, c.br])).id
    expect(await problems(dsC)).toEqual([
      expect.stringContaining('maps no properties'),
    ])
  })

  it('an object type icon carries a colour, and it must be a hex code', async () => {
    const { icon_color: dflt } = await one(
      `select icon_color from public.object_types where id=$1`, [type])
    expect(dflt).toBe('#2D72D2')

    const err = await refused(db, () => db.query(
      `update public.object_types set icon_color='blue' where id=$1`, [type]))
    expect(err).toMatch(/icon_color_is_hex/)
  })
})
