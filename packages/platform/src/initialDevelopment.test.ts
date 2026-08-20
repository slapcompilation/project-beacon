// Major version 0, and what it is allowed to do.
//
// `guard_function_version` refuses a breaking signature change without a major
// bump. That is a DELIBERATE divergence, recorded in the functions reading's
// Decision 5: Foundry warns, we refuse, on the grounds that we have no human
// release-review step. This file does not test that away — it pins it.
//
// What the decision never considered is initial development, which the
// versioning page exempts by name: "this does not apply if you are still in the
// initial development phase (that is, you are still at major version 0)", and
// "During initial development, the function may change at any time". We refused
// there too, which made the phase impossible to be in: the only way to change a
// signature at 0.1.0 was to release 1.0.0, ending the phase the exemption is for.
//
// So the shape this file holds is a pair. Below 1.0.0 the check records and
// permits; at and above it, the check records and refuses.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

const SIG = { parameters: [{ name: 'minutes', type: 'Integer', required: true }], returns: 'Double' }
const DROPPED = { parameters: [], returns: 'Double' }

describe.skipIf(noDb)('initial development may break its own signature', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let early = ''
  let stable = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const publish = (fn: string, v: [number, number, number], sig: unknown) => db.query(
    `insert into public.function_versions
       (function_id, major, minor, patch, source, signature, imports)
     values ($1,$2,$3,$4,'export function f(){}',$5::jsonb,'[]'::jsonb)`,
    [fn, v[0], v[1], v[2], JSON.stringify(sig)])

  const breaksOf = async (fn: string, v: string) =>
    (await one(
      `select v.breaking_changes from public.function_versions v
        where v.function_id = $1
          and public.function_version_string(v.major, v.minor, v.patch, v.prerelease) = $2`,
      [fn, v])).breaking_changes

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'initdev597')
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'initdev597','InitDev597',false) returning id`, [f.spaceId])).id
    const mk = async (name: string) => (await one(
      `insert into public.functions (ontology_id, project_id, api_name, display_name)
       values ($1,$2,$3,$3) returning id`, [ont, f.projectId, name])).id
    early = await mk('earlyFn')
    stable = await mk('stableFn')
  })

  afterAll(async () => { await rollback(db) })

  it('below 1.0.0 a breaking change is published, not refused', async () => {
    await publish(early, [0, 1, 0], SIG)
    // Dropping an input is one of the six documented breaking changes.
    await publish(early, [0, 2, 0], DROPPED)
    const row = await one(
      `select count(*)::int as n from public.function_versions where function_id = $1`, [early])
    expect(Number(row.n)).toBe(2)
  })

  it('and the check still ran — the finding is recorded, not discarded', async () => {
    // "you will be warned about any of the following breaking changes": at 0.x
    // the warning is all there is, so it has to survive the insert.
    expect(await breaksOf(early, '0.2.0')).toEqual(['dropped input "minutes"'])
    expect(await breaksOf(early, '0.1.0')).toEqual([])
  })

  it('so it surfaces as a warning, which by construction does not block a save', async () => {
    const { rows } = await db.query(
      `select problem from public.ontology_warnings() where object_type = 'earlyFn'`)
    expect((rows as { problem: string }[]).map((r) => r.problem)).toEqual([
      expect.stringContaining('initial development'),
    ])
    // And it is NOT in the blocking list, which is the whole point of 589.
    const errs = await db.query(
      `select problem from public.ontology_violations() where object_type = 'earlyFn'`)
    expect(errs.rows).toEqual([])
  })

  it('at 1.0.0 and above the refusal stands, because that divergence is deliberate', async () => {
    await publish(stable, [1, 0, 0], SIG)
    const err = await refused(db, () => publish(stable, [1, 1, 0], DROPPED))
    expect(err).toMatch(/BreakingChangeNeedsMajor/)
    // The major bump is the documented way through, and it records the break.
    await publish(stable, [2, 0, 0], DROPPED)
    expect(await breaksOf(stable, '2.0.0')).toEqual(['dropped input "minutes"'])
  })

  it('leaving 0.x for 1.0.0 is allowed even while breaking, as it must be', async () => {
    // Otherwise initial development would be a phase with no exit.
    const leaving = (await one(
      `insert into public.functions (ontology_id, project_id, api_name, display_name)
       values ($1,$2,'leavingFn','leavingFn') returning id`, [ont, f.projectId])).id
    await publish(leaving, [0, 3, 0], SIG)
    await publish(leaving, [1, 0, 0], DROPPED)
    expect(await breaksOf(leaving, '1.0.0')).toEqual(['dropped input "minutes"'])
  })
})
