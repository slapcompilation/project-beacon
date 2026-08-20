// A media reference property and the media source it points into.
//
// 582 and 585 built both halves — `object_type_media_sources`, the media set
// view as a third backing kind, and `media_property_problems()` reporting a
// media property with no source — and nothing could create either. The add
// control offered datasets and restricted views, so a media datasource could
// not exist, so the binding had nothing to bind to, so every media reference
// property in the ontology reported a problem no one could fix.
//
// Two bindings, not one, and that is the part worth pinning down: the property
// is still backed the ordinary way, by a media reference column on the dataset,
// AND names the media set view its references resolve in. A correct column is
// not enough.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

const SET_RID = 'ri.mio.main.media-set.00000000-0000-0000-0000-000000000f01'
const VIEW_RID = 'ri.mio.main.view.00000000-0000-0000-0000-000000000f02'

describe.skipIf(noDb)('a media reference property names its media source', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let type = ''
  let photo = ''
  let media = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const problems = async () => {
    const { rows } = await db.query(
      `select problem from public.ontology_violations() where object_type = 'Listing'`)
    return (rows as { problem: string }[]).map((r) => r.problem)
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'media585')
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'media585','Media585',false) returning id`, [f.spaceId])).id
    type = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'Listing','Listing') returning id`, [ont, f.projectId])).id
    const ds = (await one(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3) returning id`, [type, f.datasetId, f.branchId])).id
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source,
          backing_column, is_primary_key, is_title_key, required)
       values ($1,'listing_id','listingId','Listing id','string','column',
               'listing_id',true,true,true)`, [type])
    // Backed by a column, the ordinary way, and still incomplete.
    photo = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source,
          backing_column, datasource_id)
       values ($1,'photo','photo','Photo','media_reference','column','photo',$2) returning id`,
      [type, ds])).id
  })

  afterAll(async () => { await rollback(db) })

  it('is reported until it has one, even with a correct backing column', async () => {
    expect(await problems()).toEqual([
      expect.stringContaining('media source'),
    ])
  })

  it('a media source is a media set and a view of it, and neither RID is free-form', async () => {
    const err = await refused(db, () => db.query(
      `insert into public.object_type_datasources (object_type_id, media_set_rid, media_set_view_rid)
       values ($1,'images','master')`, [type]))
    expect(err).toMatch(/media_set_rids_are_rids/)

    media = (await one(
      `insert into public.object_type_datasources
         (object_type_id, media_set_rid, media_set_view_rid)
       values ($1,$2,$3) returning id`, [type, SET_RID, VIEW_RID])).id
    expect(media).toBeTruthy()
  })

  it('binding the property to it clears both problems it caused', async () => {
    // A second datasource that backs nothing is also reported, so an unbound
    // media source trips two arms; the one binding answers both.
    expect(await problems()).toEqual([
      expect.stringContaining('media source'),
      expect.stringContaining('maps no properties'),
    ])
    await db.query(
      `insert into public.object_type_media_sources (datasource_id, property_id)
       values ($1,$2)`, [media, photo])
    expect(await problems()).toEqual([])
  })

  it('and unbinding brings it back — the binding is what the linter reads', async () => {
    await db.query(`delete from public.object_type_media_sources where property_id = $1`, [photo])
    expect(await problems()).toEqual([
      expect.stringContaining('media source'),
      expect.stringContaining('maps no properties'),
    ])
  })
})
