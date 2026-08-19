// "Continue without datasource" — step 1 of the create wizard, the branch we
// never had.
//
// "If you do not have an existing datasource containing data for the object
// type, you can choose to continue without an existing datasource and select a
// location to generate a dataset for permissions... you will be prompted to
// choose a location to which you want to save an empty dataset."
// — object-link-types/create-object-type
//
// The question that matters is not whether the rows appear. It is whether the
// object type is then SAVEABLE: without a datasource its own linter reports "A
// backing datasource is required", and `save_working_state` refuses a save that
// introduces a violation. An empty dataset has to satisfy the linter while
// genuinely holding nothing, which is a narrower target than it sounds.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('an object type may generate its own empty dataset', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let type = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'gen590')
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'gen590','Gen590',false) returning id`, [f.spaceId])).id
    type = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'Ticket','Ticket') returning id`, [ont, f.projectId])).id
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source,
          backing_column, is_primary_key, is_title_key, required)
       values ($1,'ticket_id','ticketId','Ticket id','string','column',
               'ticket_id',true,true,true)`, [type])
  })

  afterAll(async () => { await rollback(db) })

  it('a type with no datasource cannot be saved, which is why the wizard asks', async () => {
    const { rows } = await db.query(
      `select problem from public.ontology_violations() where object_type = 'Ticket'`)
    expect((rows as { problem: string }[]).map((r) => r.problem))
      .toContain('A backing datasource is required')
  })

  it('generates the dataset, its master branch and the datasource in one call', async () => {
    const ds = (await one(
      `select public.generate_backing_dataset($1,'Ticket backing',null) as id`, [type])).id

    const row = await one(
      `select d.name, d.api_name, d.project_id, d.physical_table,
              (select count(*) from public.dataset_branches b
                where b.dataset_id = d.id and b.name = 'master') as branches,
              (select count(*) from public.object_type_datasources s
                where s.dataset_id = d.id and s.object_type_id = $2) as sources
         from public.datasets d where d.id = $1`, [ds, type])
    expect(row.name).toBe('Ticket backing')
    expect(row.api_name).toBe('ticket_backing')
    expect(row.project_id).toBe(f.projectId)
    expect(Number(row.branches)).toBe(1)
    expect(Number(row.sources)).toBe(1)
    // Empty means empty: no transaction, so no physical table behind it yet.
    expect(row.physical_table).toBeNull()
  })

  it('and now the object type is saveable — no violations at all', async () => {
    const { rows } = await db.query(
      `select problem from public.ontology_violations() where object_type = 'Ticket'`)
    expect((rows as { problem: string }[]).map((r) => r.problem)).toEqual([])
  })

  it('a folder decides the location, because permissions come from it', async () => {
    const folder = (await one(
      `insert into public.folders (organization_id, project_id, name)
       values ($1,$2,'Backing') returning id`, [f.orgId, f.projectId])).id
    const other = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'Note','Note') returning id`, [ont, f.projectId])).id
    const ds = (await one(
      `select public.generate_backing_dataset($1,'Note backing',$2) as id`, [other, folder])).id
    const row = await one(`select folder_id, project_id from public.datasets where id=$1`, [ds])
    expect(row.folder_id).toBe(folder)
    expect(row.project_id).toBe(f.projectId)
  })

  it('refuses a name no dataset could carry', async () => {
    const err = await refused(db, () => db.query(
      `select public.generate_backing_dataset($1,'   ',null)`, [type]))
    expect(err).toMatch(/InvalidName/)
  })
})
