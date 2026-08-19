// A derived property, created the way the product creates one.
//
// 576 built the engine — nine aggregations, a three-hop cap, `derived_chain()`,
// `derived_property_problems()` — and `apply_object_type` never learned any of
// it. Every derived property that has ever existed here was a hand-written
// INSERT in a test, which is precisely the shape of "built but unreachable":
// the tests passed and the product could not do it.
//
// So this file goes through the save path and nothing else. If it can be made
// to pass by inserting rows directly, it is testing the wrong thing.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('the save path carries a derived property', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let dept = ''
  let employee = ''
  let project = ''
  let deptEmployee = ''
  let employeeProject = ''
  let salary = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  /** An object type with a dataset behind it and one string key. */
  const mkType = async (name: string, key: string, camel: string) => {
    const ds = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,$3,$3) returning id`, [f.orgId, f.projectId, name.toLowerCase()])).id
    const br = (await one(
      `insert into public.dataset_branches (dataset_id, name)
       values ($1,'master') returning id`, [ds])).id
    const id = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,$3,$3) returning id`, [ont, f.projectId, name])).id
    await db.query(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3)`, [id, ds, br])
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source,
          backing_column, is_primary_key, is_title_key, required)
       values ($1,$2,$3,$3,'string','column',$2,true,true,true)`, [id, key, camel])
    return id
  }

  const link = async (name: string, src: string, tgt: string) =>
    (await one(
      `insert into public.link_types
         (ontology_id, api_name, label, source_object_type_id, target_object_type_id, cardinality)
       values ($1,$2,$2,$3,$4,'one_to_many') returning id`, [ont, name, src, tgt])).id

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'derv591')
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'derv591','Derv591',false) returning id`, [f.spaceId])).id

    // The page's own worked example: Department → Employee → Project.
    dept = await mkType('Department', 'dept_id', 'deptId')
    employee = await mkType('Employee', 'emp_id', 'empId')
    project = await mkType('Project', 'proj_id', 'projId')
    deptEmployee = await link('deptEmployee', dept, employee)
    employeeProject = await link('employeeProject', employee, project)

    // Something to aggregate at the far end.
    salary = (await one(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source, backing_column)
       values ($1,'salary','salary','Salary','integer','column','salary') returning id`,
      [employee])).id
  })

  afterAll(async () => { await rollback(db) })

  /** The payload the web app sends: properties as jsonb, hops as link ids. */
  const save = (props: unknown[]) => db.query(
    `select public.apply_object_type($1::jsonb, $2::jsonb, '[]'::jsonb)`,
    [JSON.stringify({ id: dept, ontology_id: ont, api_name: 'Department', label: 'Department' }),
     JSON.stringify(props)])

  const key = {
    property_id: 'dept_id', api_name: 'deptId', display_name: 'Department id',
    base_type: 'string', source: 'column', backing_column: 'dept_id',
    is_primary_key: true, is_title_key: true, required: true,
  }

  it('writes the aggregation, the target property and the chain', async () => {
    await save([key, {
      property_id: 'avg_salary', api_name: 'avgSalary', display_name: 'Average salary',
      base_type: 'double', source: 'linked_objects',
      derived_aggregation: 'average', derived_from_property_id: salary,
      hops: [deptEmployee],
    }])

    const row = await one(
      `select p.source, p.derived_aggregation, p.derived_from_property_id, p.backing_column,
              p.datasource_id,
              (select count(*) from public.derived_property_hops h where h.property_id = p.id) as hops
         from public.object_type_properties p
        where p.object_type_id = $1 and p.property_id = 'avg_salary'`, [dept])
    expect(row.source).toBe('linked_objects')
    expect(row.derived_aggregation).toBe('average')
    expect(row.derived_from_property_id).toBe(salary)
    // "the hops carry the meaning" — a derived property names neither a column
    // nor a datasource, and the CHECK refuses it if it does.
    expect(row.backing_column).toBeNull()
    expect(row.datasource_id).toBeNull()
    expect(Number(row.hops)).toBe(1)
  })

  it('replaces the chain rather than appending to it', async () => {
    await save([key, {
      property_id: 'avg_salary', api_name: 'avgSalary', display_name: 'Average salary',
      base_type: 'double', source: 'linked_objects',
      derived_aggregation: 'count',
      hops: [deptEmployee, employeeProject],
    }])
    const row = await one(
      `select string_agg(h.link_type_id::text, ',' order by h.position) as chain
         from public.derived_property_hops h
         join public.object_type_properties p on p.id = h.property_id
        where p.object_type_id = $1 and p.property_id = 'avg_salary'`, [dept])
    expect(row.chain).toBe(`${deptEmployee},${employeeProject}`)
  })

  it('and drops the chain when the property stops being derived', async () => {
    await save([key, {
      property_id: 'avg_salary', api_name: 'avgSalary', display_name: 'Average salary',
      base_type: 'double', source: 'column', backing_column: 'avg_salary',
    }])
    const row = await one(
      `select count(*) as n
         from public.derived_property_hops h
         join public.object_type_properties p on p.id = h.property_id
        where p.object_type_id = $1`, [dept])
    expect(Number(row.n)).toBe(0)
  })

  it('the linter still refuses a chain that needs an aggregation and has none', async () => {
    // A one-to-many hop with no aggregation is the documented failure:
    // "you must select an Aggregation" once any link in the chain is many.
    await save([key, {
      property_id: 'emp_name', api_name: 'empName', display_name: 'Employee name',
      base_type: 'string', source: 'linked_objects',
      derived_from_property_id: salary, hops: [deptEmployee],
    }])
    const { rows } = await db.query(
      `select problem from public.derived_property_problems() where object_type = 'Department'`)
    expect((rows as { problem: string }[]).map((r) => r.problem).join(' '))
      .toMatch(/aggregation/i)
  })
})
