// An object set as an action parameter.
//
// The api publishes the type on the action type endpoint and the value encoding
// on the apply endpoint; `action-types/submission-criteria` publishes the one
// refusal. Nothing in `action-types/rules` consumes a set, so the consumer is a
// function-backed action and the host read is what makes the parameter reach it.
//
// Reading: docs/foundry-reference/readings/object-set-parameters.md.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('an object set as an action parameter', () => {
  let db: pg.Client
  let f: Fixture
  let ont: string
  let ot: string
  let act: string
  let seq = 0

  const param = async (
    apiName: string, kind: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> => {
    seq += 1
    const cols = ['action_type_id', 'api_name', 'display_name', 'data_kind', 'position']
    const vals: unknown[] = [act, apiName, apiName, kind, seq]
    for (const [k, v] of Object.entries(extra)) { cols.push(k); vals.push(v) }
    const { rows } = await db.query(
      `insert into public.action_type_parameters (${cols.join(', ')})
       values (${cols.map((_, i) => '$' + String(i + 1)).join(', ')}) returning id`, vals)
    return rows[0].id as string
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'platform_objset')
    const { rows: o } = await db.query(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'objsetont','Obj set', false) returning id`, [f.spaceId])
    ont = o[0].id as string
    const { rows: t } = await db.query(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'ObjSetThing','Thing') returning id`, [ont, f.projectId])
    ot = t[0].id as string
    const { rows: a } = await db.query(
      `insert into public.action_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'objset-act','Act') returning id`, [ont, f.projectId])
    act = a[0].id as string
  })
  afterAll(async () => { await rollback(db) })

  describe('the kind, in the api spelling', () => {
    it('accepts an object set parameter with no object type', async () => {
      // The api marks objectApiName and objectTypeApiName optional on the
      // objectSet member, where the object member marks both required.
      await expect(param('untyped', 'objectSet')).resolves.toBeTruthy()
    })

    it('accepts one that names its object type', async () => {
      await expect(param('typed', 'objectSet', { object_type_id: ot })).resolves.toBeTruthy()
    })

    it('refuses a base type on it', async () => {
      expect(await refused(db, () => param('withBase', 'objectSet', { base_type: 'string' })))
        .toContain('payload_matches_kind')
    })

    it('refuses a kind outside the union, which the old ELSE let through', async () => {
      // A CHECK passes on NULL, and the previous ELSE returned NULL — so a new
      // kind with no arm would have carried any payload at all.
      expect(await refused(db, () => param('nope', 'somethingElse')))
        .toContain('data_kind_check')
    })

    it('leaves the four earlier kinds working', async () => {
      await expect(param('aString', 'base_type', { base_type: 'string' })).resolves.toBeTruthy()
      await expect(param('anObject', 'object', { object_type_id: ot })).resolves.toBeTruthy()
      await expect(param('aType', 'objectType')).resolves.toBeTruthy()
      expect(await refused(db, () => param('badObject', 'object')))
        .toContain('payload_matches_kind')
    })
  })

  describe('the value, in both published forms', () => {
    const valid = async (j: string): Promise<boolean> => {
      const { rows } = await db.query(
        `select public.object_set_parameter_value_valid($1::jsonb) as v`, [j])
      return rows[0].v as boolean
    }

    it('takes a stored set rid or an inline definition', async () => {
      // "string OR the object set definition"
      expect(await valid('"ri.object-set.main.object-set.7b7f1d1e-0000-4000-8000-000000000001"')).toBe(true)
      expect(await valid('{"objectType":"ObjSetThing","filters":[]}')).toBe(true)
      expect(await valid('{"objectType":"ObjSetThing"}')).toBe(true)
    })

    it('takes neither a foreign rid nor a nameless definition nor a scalar', async () => {
      expect(await valid('"ri.foundry.main.dataset.d1"')).toBe(false)
      expect(await valid('{"filters":[]}')).toBe(false)
      expect(await valid('42')).toBe(false)
      expect(await valid('null')).toBe(false)
    })
  })

  describe('the one published refusal', () => {
    it('keeps an object set parameter out of submission criteria', async () => {
      const p = await param('criterionTarget', 'objectSet')
      expect(await refused(db, () => db.query(
        `insert into public.action_type_submission_criteria
           (action_type_id, node_type, position, template, parameter_id, operator, value_source, static_value)
         values ($1,'condition',0,'parameter',$2,'is','static','"x"'::jsonb)`, [act, p])))
        .toContain('Actions:CriterionParameterKind')
    })

    it('still allows a criterion on an ordinary parameter', async () => {
      const p = await param('okTarget', 'base_type', { base_type: 'string' })
      await expect(db.query(
        `insert into public.action_type_submission_criteria
           (action_type_id, node_type, position, template, parameter_id, operator, value_source, static_value)
         values ($1,'condition',1,'parameter',$2,'is','static','"x"'::jsonb)`, [act, p]))
        .resolves.toBeTruthy()
    })
  })

  describe('the read that makes it reachable', () => {
    let setRid: string

    beforeAll(async () => {
      const { rows } = await db.query(
        `insert into public.object_sets (name, api_name, subject_type_id, project_id, ontology_id, filters)
         values ('Set','objset_set',$1,$2,$3,'[]'::jsonb) returning rid`, [ot, f.projectId, ont])
      setRid = rows[0].rid as string
    })

    it('names the object type a set is over, so the host can gate on it', async () => {
      const { rows } = await db.query(
        `select public.object_set_subject_api_name($1) as n`, [setRid])
      expect(rows[0].n).toBe('ObjSetThing')
    })

    it('evaluates a stored set by its rid', async () => {
      const { rows } = await db.query(
        `select count(*)::int as k from public.evaluate_object_set_by_rid($1, 10)`, [setRid])
      expect(rows[0].k).toBe(0)
    })

    it('refuses a rid that names no set it can see', async () => {
      const ghost = 'ri.object-set.main.object-set.7b7f1d1e-0000-4000-8000-0000000000ff'
      for (const fn of ['object_set_subject_api_name($1)', 'evaluate_object_set_by_rid($1, 10)']) {
        expect(await refused(db, () => db.query(`select public.${fn}`, [ghost])))
          .toContain('Ontology:ObjectSetNotFound')
      }
    })

    it('reads as the caller rather than the owner', async () => {
      // functions/permissions: the permissions of the end user running the
      // function determine which objects are loaded — so a definer here would
      // quietly widen every guest.
      const { rows } = await db.query(
        `select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname in ('evaluate_object_set_by_rid','object_set_subject_api_name')`)
      expect(rows.map((r) => r.prosecdef)).toEqual([false, false])
    })
  })

  it('added no rule kind, because no documented rule consumes a set', async () => {
    const { rows } = await db.query(`select count(*)::int as k from public.action_rule_kinds()`)
    expect(rows[0].k).toBe(13)
  })
})
