// Mandatory control properties (727), through the front door.
//
// The migration's probe EXECUTEs marking_value_allowed's branches and the
// linter arms; what it could not do is ride the exact sequence the UI runs —
// wizard save, datasource attach, declaration, action submit, index build.
// These do, on every CI run:
//
//   "Mandatory control properties must be required."
//   "Mandatory control properties must be mapped to a marking column on a
//    restricted view."
//   "Every datasource that contains a mandatory control property must define
//    a constraint on what values can be added to those properties."
//   "any edits made that try to set an invalid value to the mandatory control
//    property will be rejected and the Action will fail to submit"
//   — object-link-types/mandatory-control-properties.md

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused } from './harness'

describe.skipIf(noDb)('mandatory control properties', () => {
  let db: pg.Client
  let org = ''
  let ont = ''
  let proj = ''
  let ds = ''
  let br = ''
  let rv = ''
  let type = ''
  let plainSrc = ''
  let rvSrc = ''
  let phys = ''
  let mk = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)

  // The wizard's own payload: pk always; the marking property when asked for,
  // bound to whichever datasource the caller names. Only the CREATE names the
  // backing — an edit says nothing about datasources, which is the convention
  // the surfaces follow and the path that resolves through
  // ontology_resource_row.
  const stageType = async (ctrl?: { required: boolean; datasourceId?: string }) => {
    const props: Record<string, unknown>[] = [{
      property_id: 'pk', display_name: 'Id', api_name: 'id', base_type: 'string',
      source: 'column', backing_column: 'pk', is_primary_key: true, is_title_key: true,
      required: true,
    }]
    if (ctrl) {
      props.push({
        property_id: 'ctrl', display_name: 'Control', api_name: 'ctrl',
        base_type: 'marking', source: 'column', backing_column: 'ctrl',
        datasource_id: ctrl.datasourceId, required: ctrl.required, visibility: 'hidden',
      })
    }
    const head: Record<string, unknown> = {
      api_name: 'McThing', label: 'MC thing', ontology_id: ont, project_id: proj,
    }
    if (type) head.id = type
    else head.datasources = [{ dataset_id: ds, branch_id: br }]
    return (await one('select public.save_object_type($1::jsonb, $2::jsonb) as id',
      [JSON.stringify(head), JSON.stringify(props)])).id
  }

  beforeAll(async () => {
    db = await connect()
    org = (await one(`insert into public.organizations (name) values ('mc727') returning id`)).id
    const usr = (await one('select gen_random_uuid() as id')).id
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, `mc727-${Date.now()}@beacon.test`])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, `mc727-${Date.now()}@beacon.test`, org])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: org } })])

    const space = (await one(`select public.create_space('MC727') as id`)).id
    await db.query(`delete from public.ontologies where space_id = '${space}'`)
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'mc727','MC727',false) returning id`, [space])).id
    proj = (await one(
      `insert into public.projects (organization_id, space_id, api_name, name)
       values ($1,$2,'mc727p','MC727') returning id`, [org, space])).id
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [proj, usr, org])

    ds = (await one(`insert into public.datasets (organization_id, project_id, api_name, name)
                     values ($1,$2,'mc727ds','mc727ds') returning id`, [org, proj])).id
    br = (await one(`insert into public.dataset_branches (dataset_id, name)
                     values ($1,'master') returning id`, [ds])).id
    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [ds, br])).id
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      // "Add a nullable string array property … Change the property's base
      // type to Mandatory Control" — a marking column is a string array.
      [ds, txn, JSON.stringify([
        { name: 'pk', type: 'STRING' },
        { name: 'ctrl', type: 'ARRAY', arraySubType: { type: 'STRING' } },
        { name: 'owner_id', type: 'STRING' }])])
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'rows.parquet',2) returning id`, [ds, txn])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [txn])
    phys = (await one('select public.dataset_materialize($1,$2) as t', [ds, txn])).t
    mk = (await one('select gen_random_uuid() as id')).id
    // One row carries the allowed marking; one carries the page's empty array,
    // where "all users will meet the marking requirements".
    await db.query(`insert into datasets.${phys} (_file, pk, ctrl, owner_id)
                    values ($1,'R1',$2::text[],$3), ($1,'R2','{}'::text[],$3)`,
      [file, [mk], usr])

    rv = (await one(
      `insert into public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
       values ($1,$2,'mc727rv','mc727rv',
         '{"match":"all","rules":[{"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}')
       returning id`, [proj, ds])).id

    // Step 1 of the arc: the wizard lands the type with its key property.
    type = await stageType()
    await db.query('select public.save_working_state()')
    await db.query('update public.object_types set edits_enabled = true where id = $1', [type])
    plainSrc = (await one(
      `select id from public.object_type_datasources where object_type_id = $1`, [type])).id
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('refuses an optional marking property at the row itself', async () => {
    await stageType({ required: false, datasourceId: plainSrc })
    const why = await refused(db, () => db.query('select public.save_working_state()'))
    expect(why).toMatch(/marking_property_is_required/)
  })

  it('walks the save to a restricted view, then to a declaration', async () => {
    // On a plain dataset the save is refused — the linter's first arm.
    await stageType({ required: true, datasourceId: plainSrc })
    const notRv = await refused(db, () => db.query('select public.save_working_state()'))
    expect(notRv).toMatch(/restricted view/)

    // The DatasourcesTab arc: a restricted view backs ALONE, so attaching one
    // beside the dataset is refused, and the swap is remove-then-add.
    const beside = await refused(db, () => db.query(
      `insert into public.object_type_datasources (object_type_id, restricted_view_id)
       values ($1,$2)`, [type, rv]))
    expect(beside).toMatch(/RestrictedViewBacksAlone/)
    await db.query('delete from public.object_type_datasources where id = $1', [plainSrc])
    rvSrc = (await one(
      `insert into public.object_type_datasources (object_type_id, restricted_view_id)
       values ($1,$2) returning id`, [type, rv])).id
    await stageType({ required: true, datasourceId: rvSrc })
    const undeclared = await refused(db, () => db.query('select public.save_working_state()'))
    expect(undeclared).toMatch(/declare its allowed markings/)

    // The declaration — the tab's picker writes the column — and the save lands.
    await db.query(
      `update public.object_type_datasources set allowed_markings = array[$1]::uuid[] where id = $2`,
      [mk, rvSrc])
    await db.query('select public.save_working_state()')
    expect(await count(
      `select count(*) n from public.object_type_properties
        where object_type_id = $1 and property_id = 'ctrl' and base_type = 'marking'`, [type])).toBe(1)
  })

  it('rejects an action edit outside the allowed sets, by name', async () => {
    const pkProp = (await one(`select id from public.object_type_properties
                                where object_type_id = $1 and property_id = 'pk'`, [type])).id
    const ctrlProp = (await one(`select id from public.object_type_properties
                                  where object_type_id = $1 and property_id = 'ctrl'`, [type])).id
    const action = (await one('select public.save_action_type($1::jsonb) as id', [JSON.stringify({
      api_name: 'mark-thing', label: 'Mark thing', ontology_id: ont,
      parameters: [
        { api_name: 'id', display_name: 'Id', base_type: 'string', required: true, position: 0 },
        { api_name: 'ctrl', display_name: 'Control', base_type: 'marking', required: true, position: 1 },
      ],
      rules: [{
        kind: 'create_object', position: 0, object_type_id: type,
        properties: [
          { property_id: pkProp, value_source: 'parameter', parameter_api_name: 'id' },
          { property_id: ctrlProp, value_source: 'parameter', parameter_api_name: 'ctrl' },
        ],
      }],
    })])).id
    await db.query('select public.save_working_state()')

    const why = await refused(db, () => db.query('select public.apply_action($1, $2::jsonb)',
      [action, JSON.stringify({ id: 'A1', ctrl: [crypto.randomUUID()] })]))
    expect(why).toMatch(/Actions:MandatoryControlValueNotAllowed/)

    await db.query('select public.apply_action($1, $2::jsonb)',
      [action, JSON.stringify({ id: 'A1', ctrl: [mk] })])
    expect(await count(
      `select count(*) n from public.object_edits where object_type_id = $1`, [type])).toBe(1)
  })

  it('fails the build when the dataset holds a value outside the sets', async () => {
    // "the object type will fail to index if … the values in the dataset are
    // updated to include invalid values for the mandatory controls"
    await db.query(
      `update datasets.${phys} set ctrl = array[gen_random_uuid()::text] where pk = 'R1'`)
    const failed = (await one('select public.run_index_build(array[$1]::uuid[], true) as b', [type])).b
    const job = await one('select state, error from public.build_jobs where build_id = $1', [failed])
    expect(job.state).toBe('FAILED')
    expect(job.error).toMatch(/mandatory control/)

    // Repaired, the build completes and the edit-born object joins the merge.
    await db.query(`update datasets.${phys} set ctrl = $1::text[] where pk = 'R1'`, [[mk]])
    const ok = (await one('select public.run_index_build(array[$1]::uuid[], true) as b', [type])).b
    const done = await one('select state, error from public.build_jobs where build_id = $1', [ok])
    expect(done.state, done.error ?? '').toBe('COMPLETED')
    expect(await count(
      'select object_count n from public.object_type_indexes where object_type_id = $1', [type])).toBe(3)
  })

  // 734: the upsert's UPDATE arm dropped three columns the INSERT arm carried,
  // so `allow_empty_arrays` never reached an existing property and 729's CHECK
  // refused the page's own three-step workaround at its last step:
  // "Change the property's base type to **Mandatory Control**."
  it('turns an existing string array into a mandatory control', async () => {
    const pkProp = {
      property_id: 'pk', display_name: 'Id', api_name: 'id', base_type: 'string',
      source: 'column', backing_column: 'pk', is_primary_key: true,
      is_title_key: true, required: true,
    }
    const save = async (note: Record<string, unknown>) => {
      await db.query('select public.save_object_type($1::jsonb, $2::jsonb)', [
        JSON.stringify({ id: type, api_name: 'McThing', label: 'MC thing', ontology_id: ont }),
        JSON.stringify([pkProp, {
          property_id: 'ctrl', display_name: 'Control', api_name: 'ctrl',
          source: 'column', backing_column: 'ctrl', datasource_id: rvSrc, ...note,
        }]),
      ])
      await db.query('select public.save_working_state()')
    }
    // Step 1 of the page's workaround, over the marking property already there.
    await save({ base_type: 'array', array_element_type: 'string' })
    expect(await count(
      `select count(*) n from public.object_type_properties
        where object_type_id = $1 and property_id = 'ctrl' and base_type = 'array'`, [type])).toBe(1)

    // Step 3 — refused before 734, because the settled flag never reached it.
    await save({ base_type: 'marking', required: true, visibility: 'hidden' })
    const back = await one(
      `select base_type, allow_empty_arrays from public.object_type_properties
        where object_type_id = $1 and property_id = 'ctrl'`, [type])
    expect(back.base_type).toBe('marking')
    expect(back.allow_empty_arrays).toBe(true)
  })

  // 735: 734 carried the three columns unconditionally, and EXCLUDED for an
  // unmentioned key is the INSERT list's DEFAULT rather than the stored value —
  // so an ordinary rename erased them. The web sends none of the three.
  it('keeps formatting through an edit that never mentions it', async () => {
    const pkProp = {
      property_id: 'pk', display_name: 'Id', api_name: 'id', base_type: 'string',
      source: 'column', backing_column: 'pk', is_primary_key: true,
      is_title_key: true, required: true,
    }
    const ctrl = {
      property_id: 'ctrl', display_name: 'Control', api_name: 'ctrl',
      base_type: 'marking', source: 'column', backing_column: 'ctrl',
      datasource_id: rvSrc, required: true, visibility: 'hidden',
    }
    const save = async (extra: Record<string, unknown>) => {
      await db.query('select public.save_object_type($1::jsonb, $2::jsonb)', [
        JSON.stringify({ id: type, api_name: 'McThing', label: 'MC thing', ontology_id: ont }),
        JSON.stringify([pkProp, { ...ctrl, ...extra }]),
      ])
      await db.query('select public.save_working_state()')
    }
    await save({ format_rules: [{ kind: 'always_true', formatting: { type: 'intent', intent: 'warning' } }] })
    expect(await count(
      `select count(*) n from public.object_type_properties
        where object_type_id = $1 and property_id = 'ctrl' and format_rules <> '[]'::jsonb`,
      [type])).toBe(1)

    // A rename, mentioning neither key — this erased them before 735.
    await save({ display_name: 'Control renamed' })
    const kept = await one(
      `select display_name, format_rules, allow_empty_arrays from public.object_type_properties
        where object_type_id = $1 and property_id = 'ctrl'`, [type])
    expect(kept.display_name).toBe('Control renamed')
    expect(kept.format_rules).not.toEqual([])
    expect(kept.allow_empty_arrays).toBe(true)

    // A spoken empty still clears: "Adding/removing value formatting".
    await save({ format_rules: [] })
    expect(await count(
      `select count(*) n from public.object_type_properties
        where object_type_id = $1 and property_id = 'ctrl' and format_rules = '[]'::jsonb`,
      [type])).toBe(1)
  })
})
