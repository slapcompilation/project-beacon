// The Object set effect input, and the three execution modes it brings.
//
// `automate/effect-actions` enumerates the four effect input kinds and the three
// grouping options, states that the two input families cannot be combined, and
// says a batch size is a maximum rather than a minimum. `automate/limits` caps
// that size at 1,000. Each of those is a printed answer, so the test runs the
// engine and compares.
//
// Reading: docs/foundry-reference/readings/object-set-parameters.md.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('the object set effect input', () => {
  let db: pg.Client
  let f: Fixture
  let ont: string
  let ot: string
  let oset: string
  let auto: string
  let owner: string
  let act: string
  let setPar: string
  let objPar: string
  let seq = 0

  const effect = async (over: Record<string, unknown> = {}): Promise<string> => {
    seq += 1
    const base: Record<string, unknown> = {
      automation_id: auto, position: seq, kind: 'action', action_type_id: act,
      object_set_parameter_id: setPar, execution_mode: 'once_for_all',
      ...over,
    }
    const cols = Object.keys(base)
    const { rows } = await db.query(
      `insert into public.automation_effects (${cols.join(', ')})
       values (${cols.map((_, i) => '$' + String(i + 1)).join(', ')}) returning id`,
      Object.values(base))
    return rows[0].id as string
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'platform_objsetinput')
    const { rows: o } = await db.query(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'osiont','Obj set input', false) returning id`, [f.spaceId])
    ont = o[0].id as string
    const { rows: t } = await db.query(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'OsiTicket','Ticket') returning id`, [ont, f.projectId])
    ot = t[0].id as string
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source,
          backing_column, is_primary_key, is_title_key, required)
       values ($1,'pk','Pk','pk','string','column','pk',true,true,true)`, [ot])
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, position)
       values ($1,'category','Category','category','string','column','category',1)`, [ot])
    const { rows: s } = await db.query(
      `insert into public.object_sets (name, api_name, subject_type_id, project_id, ontology_id, filters)
       values ('Set','osi_set',$1,$2,$3,'[]'::jsonb) returning id`, [ot, f.projectId, ont])
    oset = s[0].id as string
    // An automation names an owner, and the harness's claims carry no subject.
    const { rows: u } = await db.query('select gen_random_uuid() as id')
    owner = u[0].id as string
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [owner, `osi-${owner}@beacon.test`])
    await db.query(
      `insert into public.users (id, email, role, organization_id) values ($1,$2,'admin',$3)`,
      [owner, `osi-${owner}@beacon.test`, f.orgId])
    // Editing an automation's effects needs ownership, so the caller becomes
    // the owner rather than the harness's subject-less admin.
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: owner, app_metadata: { role: 'admin', org_id: f.orgId } })])
    const { rows: a } = await db.query(
      `insert into public.automations (project_id, display_name, owner_id, condition)
       values ($1,'Watch',$2,$3::jsonb) returning id`,
      [f.projectId, owner, JSON.stringify({ type: 'objects_added', object_set_id: oset })])
    auto = a[0].id as string
    const { rows: at } = await db.query(
      `insert into public.action_types (ontology_id, project_id, api_name, label, automate_can_submit)
       values ($1,$2,'osi-act','Act',true) returning id`, [ont, f.projectId])
    act = at[0].id as string
    const { rows: p1 } = await db.query(
      `insert into public.action_type_parameters
         (action_type_id, api_name, display_name, data_kind, object_type_id, position)
       values ($1,'targets','Targets','objectSet',$2,0) returning id`, [act, ot])
    setPar = p1[0].id as string
    const { rows: p2 } = await db.query(
      `insert into public.action_type_parameters
         (action_type_id, api_name, display_name, data_kind, object_type_id, position)
       values ($1,'one','One','object',$2,1) returning id`, [act, ot])
    objPar = p2[0].id as string
  })
  afterAll(async () => { await rollback(db) })

  describe('the binding', () => {
    it('takes an object set parameter with a mode', async () => {
      await expect(effect()).resolves.toBeTruthy()
    })

    it('refuses a single object parameter as an object set input', async () => {
      expect(await refused(db, () => effect({ object_set_parameter_id: objPar })))
        .toContain('Automate:InputTypeMismatch')
    })

    it('refuses combining the two input families', async () => {
      // "object set and object list inputs cannot be combined with single
      //  object and property reference inputs"
      expect(await refused(db, () => effect({ object_input_parameter_id: objPar })))
        .toContain('one_input_family')
    })

    it('refuses a set input on a condition that exposes none', async () => {
      const { rows } = await db.query(
        `insert into public.automations (project_id, display_name, owner_id, condition)
         values ($1,'Timed',$2,$3::jsonb) returning id`,
        [f.projectId, owner, JSON.stringify({ type: 'time', cron: '0 2 * * *' })])
      expect(await refused(db, () => effect({ automation_id: rows[0].id })))
        .toContain('Automate:ConditionExposesNoInput')
    })
  })

  describe('the execution mode, which only the multi-object family has', () => {
    it('requires a mode when a set is bound, and none when it is not', async () => {
      expect(await refused(db, () => effect({ execution_mode: null })))
        .toContain('mode_needs_a_set')
      expect(await refused(db, () => effect({
        object_set_parameter_id: null, execution_mode: 'once_for_all',
      }))).toContain('mode_needs_a_set')
    })

    it('holds the three the page enumerates and nothing else', async () => {
      await expect(effect({ execution_mode: 'once_for_all' })).resolves.toBeTruthy()
      await expect(effect({ execution_mode: 'once_for_each_batch', batch_size: 10 })).resolves.toBeTruthy()
      await expect(effect({
        execution_mode: 'once_for_each_group', group_by_properties: ['category'],
      })).resolves.toBeTruthy()
      expect(await refused(db, () => effect({ execution_mode: 'once_per_thing' })))
        .toContain('execution_mode_known')
    })

    it('ties a batch size to the batch mode, and caps it where the limits page does', async () => {
      expect(await refused(db, () => effect({ execution_mode: 'once_for_each_batch' })))
        .toContain('batch_size_shape')
      expect(await refused(db, () => effect({ execution_mode: 'once_for_all', batch_size: 10 })))
        .toContain('batch_size_shape')
      expect(await refused(db, () => effect({ execution_mode: 'once_for_each_batch', batch_size: 1001 })))
        .toContain('batch_size_bounded')
      expect(await refused(db, () => effect({ execution_mode: 'once_for_each_batch', batch_size: 0 })))
        .toContain('batch_size_bounded')
    })

    it('ties grouping properties to the group mode, and checks they exist', async () => {
      expect(await refused(db, () => effect({ execution_mode: 'once_for_each_group' })))
        .toContain('group_properties_shape')
      expect(await refused(db, () => effect({
        execution_mode: 'once_for_each_group', group_by_properties: [],
      }))).toContain('group_properties')
      expect(await refused(db, () => effect({
        execution_mode: 'once_for_each_group', group_by_properties: ['nosuch'],
      }))).toContain('Automate:GroupPropertyNotOnType')
    })
  })

  describe('the value an effect receives', () => {
    it('is the inline definition the api gives equal standing', async () => {
      const { rows } = await db.query(
        `select public.fired_object_set_value($1, array['T1','T2']) as v`, [ot])
      const v = rows[0].v as {
        objectType: string
        filters: { type: string; propertyType: string; value: { type: string; values: string[] } }[]
      }
      expect(v.objectType).toBe('OsiTicket')
      expect(v.filters).toHaveLength(1)
      expect(v.filters[0].propertyType).toBe('pk')
      expect(v.filters[0].value.type).toBe('valuesFilter')
      expect(v.filters[0].value.values).toEqual(['T1', 'T2'])
    })

    it('satisfies the validator the parameter type carries', async () => {
      // 797 decides what an object set parameter value may be; this is the
      // thing that produces one, so the two must agree.
      const { rows } = await db.query(
        `select public.object_set_parameter_value_valid(
           public.fired_object_set_value($1, array['T1'])) as ok`, [ot])
      expect(rows[0].ok).toBe(true)
    })

    it('leaves nothing behind, because it stores no set', async () => {
      const before = await db.query(`select count(*)::int as k from public.object_sets`)
      await db.query(`select public.fired_object_set_value($1, array['T1','T2','T3'])`, [ot])
      const after = await db.query(`select count(*)::int as k from public.object_sets`)
      expect(after.rows[0].k).toBe(before.rows[0].k)
    })
  })

  describe('running one', () => {
    it('runs nothing when nothing fired', async () => {
      const e = await effect()
      const { rows } = await db.query(
        `select public.run_effect_for_set($1,$2,null,array[]::text[]) as n`, [auto, e])
      expect(rows[0].n).toBe(0)
    })

    it('leaves the single-object path alone', async () => {
      // 630's per-object executor is the other family and is untouched.
      const { rows } = await db.query(
        `select count(*)::int as k from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'run_effect_per_object'`)
      expect(rows[0].k).toBe(1)
    })
  })
})
