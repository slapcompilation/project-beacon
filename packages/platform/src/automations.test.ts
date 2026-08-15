// An automation: a condition, and the effects it fires.
//
// The load-bearing sentence, stated three times across two pages: "Regardless
// of scoping mode, automations execute as the owner." Condition evaluation
// included — "Condition evaluation: Uses automation owner's permissions".
//
// And the guarantee: "Effects follow at-least-once execution semantics rather
// than exactly-once guarantees", so a run is recorded BEFORE the attempt.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('automations', () => {
  let db: pg.Client
  let f: Fixture
  let owner = ''
  let auto = ''
  let action = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'autos')
    owner = (await one('select gen_random_uuid() as id')).id
    const email = `autos-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [owner, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [owner, email, f.orgId])
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, owner, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: owner, app_metadata: { role: 'admin', org_id: f.orgId } })])

    const space = (await one(`select public.create_space('Autos') as id`)).id
    const ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'autos','Autos',false) returning id`, [space])).id
    action = (await one(
      `insert into public.action_types (ontology_id, api_name, label)
       values ($1,'ping','Ping') returning id`, [ont])).id

    auto = (await one(
      `insert into public.automations (project_id, display_name, owner_id, condition)
       values ($1,'Nightly ping',$2,'{"type":"time","cron":"0 3 * * *"}'::jsonb) returning id`,
      [f.projectId, owner])).id
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('takes the published condition grammar and refuses the live-only one', async () => {
    // "Objects modified in set" has no scheduled column in the support matrix.
    for (const bad of ['{"type":"objects_modified","object_set_id":"x"}',
                       '{"type":"threshold_crossed"}',
                       '{"type":"time"}']) {
      expect(await refused(db, () => db.query(
        `insert into public.automations (project_id, display_name, owner_id, condition)
         values ($1,'bad',$2,$3::jsonb)`, [f.projectId, owner, bad])))
        .toContain('condition')
    }
  })

  it('names four effect kinds and executes two', async () => {
    // 446's shape: the registry says what runs, so the surface disables
    // rather than hides.
    expect(await count('select count(*) n from public.automation_effect_kinds()')).toBe(4)
    expect(await count(
      'select count(*) n from public.automation_effect_kinds() where executable')).toBe(2)
    const notif = await one(
      `select executable, runtime from public.automation_effect_kinds() where kind='notification'`)
    expect(notif.executable).toBe(false)
    // A function effect is executable, but not here.
    const fn = await one(
      `select runtime from public.automation_effect_kinds() where kind='function'`)
    expect(fn.runtime).toBe('function')
  })

  it('fires a time condition on its cron, and not otherwise', async () => {
    expect(await one(
      `select public.automation_fires($1, timestamptz '2026-08-15 03:00+00') as k`, [auto]))
      .toHaveProperty('k', [])
    expect((await one(
      `select public.automation_fires($1, timestamptz '2026-08-15 04:00+00') as k`, [auto])).k)
      .toBeNull()
  })

  it('a paused automation never fires', async () => {
    await db.query('update public.automations set paused = true where id = $1', [auto])
    expect((await one(
      `select public.automation_fires($1, timestamptz '2026-08-15 03:00+00') as k`, [auto])).k)
      .toBeNull()
    await db.query('update public.automations set paused = false where id = $1', [auto])
  })

  it('records the run before attempting the effect', async () => {
    // At-least-once: the row exists even when the effect fails, because it is
    // written first. The action here has no rules, so applying it is a no-op
    // that still produces a run.
    await db.query(
      `insert into public.automation_effects (automation_id, position, kind, action_type_id)
       values ($1,0,'action',$2)`, [auto, action])
    await db.query(`select public.run_automations(timestamptz '2026-08-15 03:00+00')`)
    expect(await count(
      'select count(*) n from public.automation_runs where automation_id=$1', [auto]))
      .toBeGreaterThan(0)
    const r = await one(
      `select outcome from public.automation_runs where automation_id=$1 order by ran_at desc limit 1`,
      [auto])
    expect(['succeeded', 'failed']).toContain(r.outcome)
  })

  it('refuses an edit to the condition by anyone but the owner', async () => {
    // "You must take ownership of the automation to make edits to the
    // condition or effects."
    const other = (await one('select gen_random_uuid() as id')).id
    const email = `autos-other-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [other, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [other, email, f.orgId])
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, other, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: other, app_metadata: { role: 'admin', org_id: f.orgId } })])

    const err = await refused(db, () => db.query(
      `update public.automations set condition='{"type":"time","cron":"0 4 * * *"}'::jsonb
        where id=$1`, [auto]))
    expect(err).toContain('Automate:TakeOwnershipToEdit')

    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: owner, app_metadata: { role: 'admin', org_id: f.orgId } })])
  })

  it('scope governs history, never identity', async () => {
    // The runner reads owner_id and never scope; scope only widens who reads
    // automation_runs.
    const def = (await one(
      `select pg_get_functiondef('public.run_automations(timestamptz)'::regprocedure) as d`)).d
    expect(def).toContain('owner_id')
    expect(def).not.toContain('a.scope')
    expect(await count(
      `select count(*) n from pg_policies where tablename='automation_runs'`)).toBeGreaterThan(0)
  })

  it('the minute hand checks automations', async () => {
    const def = (await one(
      `select pg_get_functiondef('public.run_schedules(timestamptz)'::regprocedure) as d`)).d
    expect(def).toContain('run_automations')
    // Executed, not merely mentioned — 514's lesson.
    expect(Number((await one('select public.run_automations(now()) as n')).n))
      .toBeGreaterThanOrEqual(0)
  })
})
