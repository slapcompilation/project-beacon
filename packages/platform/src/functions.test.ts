// Functions as versioned artifacts, re-asked on every CI run.
//
// Migration 501 asserts this once at landing. The durable questions: the
// four documented api-name rules, immutability after release, the published
// list of breaking changes each taking a major, widening and optional inputs
// staying compatible, latest-STABLE resolution, and the repository-Viewer
// gate that placement stands in for.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

const SIG = {
  parameters: [{ name: 'minimumMinutes', type: 'Integer', required: true }],
  returns: 'Double',
}

describe.skipIf(noDb)('functions as versioned code', () => {
  let db: pg.Client
  let f: Fixture
  let usr = ''
  let ont = ''
  let fn = ''
  let objectType = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const publish = async (v: [number, number, number], sig: unknown, pre: string | null = null) =>
    db.query(
      `insert into public.function_versions
         (function_id, major, minor, patch, prerelease, source, signature)
       values ($1,$2,$3,$4,$5,'async function run(client, inputs) { return 0 }',$6::jsonb)`,
      [fn, v[0], v[1], v[2], pre, JSON.stringify(sig)])

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'fns501')
    usr = (await one('select gen_random_uuid() as id')).id
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, `fns501-${Date.now()}@beacon.test`])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, `fns501-${Date.now()}@beacon.test`, f.orgId])
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, usr, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])

    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'fns501','FNS',false) returning id`, [f.spaceId])).id
    objectType = (await one(
      `insert into public.object_types (ontology_id, api_name, label)
       values ($1,'Aircraft501T','Aircraft') returning id`, [ont])).id
    fn = (await one(
      `insert into public.functions (ontology_id, project_id, api_name, display_name)
       values ($1,$2,'getReschedulableAircraftCount','Reschedulable') returning id`,
      [ont, f.projectId])).id
    await publish([1, 0, 0], SIG)
  })
  afterAll(async () => { await rollback(db) })

  it('the api name follows the four documented rules', async () => {
    for (const bad of ['NotCamel', '2fast', 'has_underscore']) {
      const err = await refused(db, () => db.query(
        `insert into public.functions (ontology_id, project_id, api_name, display_name)
         values ($1,$2,$3,'Bad')`, [ont, f.projectId, bad]))
      expect(err, bad).toContain('api_name')
    }
  })

  it('a released version is immutable', async () => {
    const err = await refused(db, () =>
      db.query(`update public.function_versions set source='tampered' where function_id=$1`, [fn]))
    expect(err).toContain('Functions:VersionsAreImmutable')
  })

  it('each documented breaking change takes a major', async () => {
    // Adding a required input.
    expect(await refused(db, () => publish([1, 1, 0], {
      parameters: [...SIG.parameters, { name: 'extra', type: 'string', required: true }],
      returns: 'Double',
    }))).toContain('Functions:BreakingChangeNeedsMajor')
    // Dropping an input.
    expect(await refused(db, () => publish([1, 1, 0], { parameters: [], returns: 'Double' })))
      .toContain('Functions:BreakingChangeNeedsMajor')
    // A bad input type change.
    expect(await refused(db, () => publish([1, 1, 0], {
      parameters: [{ name: 'minimumMinutes', type: 'string', required: true }], returns: 'Double',
    }))).toContain('Functions:BreakingChangeNeedsMajor')
    // An output change.
    expect(await refused(db, () => publish([1, 1, 0], { ...SIG, returns: 'string' })))
      .toContain('Functions:BreakingChangeNeedsMajor')
  })

  it('widening a numeric input and adding an optional one stay compatible', async () => {
    await publish([1, 1, 0], {
      parameters: [
        { name: 'minimumMinutes', type: 'Long', required: true },
        { name: 'note', type: 'string', required: false },
      ],
      returns: 'Double',
    })
    const n = Number((await one(
      `select count(*) as n from public.function_versions where function_id=$1`, [fn])).n)
    expect(n).toBe(2)
  })

  it('an api-named query resolves to its latest STABLE version', async () => {
    await publish([2, 0, 0], SIG, 'rc1')
    const payload = (await one(
      `select public.function_to_run($1,'getReschedulableAircraftCount') as p`, [ont])).p as unknown as
      { version: string; object_types: string[] }
    expect(payload.version).toBe('1.1.0')
  })

  it('the declared imports travel with the version', async () => {
    const withImports = (await one(
      `insert into public.functions (ontology_id, project_id, api_name, display_name)
       values ($1,$2,'countByModel','Count by model') returning id`, [ont, f.projectId])).id
    await db.query(
      `insert into public.function_versions (function_id, major, minor, patch, source, signature, imports)
       values ($1,1,0,0,'async function run(){return 0}',$2::jsonb,$3::jsonb)`,
      [withImports, JSON.stringify({ parameters: [], returns: 'Integer' }),
       JSON.stringify({ object_types: [objectType], link_types: [] })])
    const payload = (await one(
      `select public.function_to_run($1,'countByModel') as p`, [ont])).p as unknown as
      { object_types: string[] }
    expect(payload.object_types).toEqual(['Aircraft501T'])
  })

  it('reading a placed function takes a role on its project', async () => {
    await db.query(`delete from public.project_role_grants where project_id=$1 and user_id=$2`,
      [f.projectId, usr])
    const err = await refused(db, () =>
      db.query(`select public.function_to_run($1,'getReschedulableAircraftCount')`, [ont]))
    expect(err).toContain('Functions:ReadFunctionsPermissionDenied')
  })
})
