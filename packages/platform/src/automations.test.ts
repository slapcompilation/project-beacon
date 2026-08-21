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
  let ont = ''

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
    ont = (await one(
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
    // The runner's identity comes from owner_id and never scope; scope only
    // widens who reads automation_runs. Since 553 the identity lookup lives in
    // automation_candidates, and the entry takes whatever it hands over.
    const entry = (await one(
      `select pg_get_functiondef('public.run_automations(timestamptz)'::regprocedure) as d`)).d
    expect(entry).toContain('automation_candidates')
    expect(entry).not.toContain('a.scope')
    const candidates = (await one(
      `select pg_get_functiondef('public.automation_candidates()'::regprocedure) as d`)).d
    expect(candidates).toContain('owner_id')
    expect(candidates).not.toContain('scope')
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

  // 521/522: the published numbers, replacing one I invented.
  it('uses the published input caps, per condition type', async () => {
    expect(await count(`select public.automation_input_limit('run_on_all') n`)).toBe(1000000)
    expect(await count(`select public.automation_input_limit('objects_added') n`)).toBe(100000)
    expect(await count(`select public.automation_input_limit('objects_removed') n`)).toBe(100000)
    // And the runner asks for the limit rather than carrying one.
    const d = (await one(
      `select pg_get_functiondef('public.automation_fires(uuid,timestamptz)'::regprocedure) as d`)).d
    expect(d).toContain('automation_input_limit')
    expect(d).not.toContain('10000)')
  })

  it('classifies retryable failures the way the page lists them', async () => {
    for (const e of ['Actions:ObjectVersionChanged — stale', '429 rate limit exceeded',
                     'service outage downstream']) {
      expect(await count(`select (public.automation_error_retryable($1))::int n`, [e])).toBe(1)
    }
    expect(await count(
      `select (public.automation_error_retryable('Actions:MissingParameter'))::int n`)).toBe(0)
  })

  it('bounds retries where the page bounds them, and only where they are allowed', async () => {
    const eff = (await one(
      `select id from public.automation_effects where automation_id=$1 limit 1`, [auto])).id
    // "this must be between 1 and 5"
    expect(await refused(db, () => db.query(
      'update public.automation_effects set retry_count = 6 where id = $1', [eff])))
      .toContain('retry_count')
    // "must be less than 24 hours"
    expect(await refused(db, () => db.query(
      `update public.automation_effects set retry_interval = interval '25 hours' where id=$1`, [eff])))
      .toContain('retry_interval')
    // "can currently only be configured on ... Action effects, Logic effects"
    const fnEff = (await one(
      `insert into public.automation_effects (automation_id, position, kind, function_id)
       values ($1, 9, 'function', (select id from public.functions limit 1)) returning id`, [auto])).id
    expect(await refused(db, () => db.query(
      'update public.automation_effects set retry_count = 2 where id = $1', [fnEff])))
      .toContain('retries_where_allowed')
  })

  // 617/618. The cadence has to gate the EVALUATION, not the firing: the
  // snapshot automation_fires compares against is rewritten on every tick, so
  // a daily automation that still snapshots every minute would fire once a day
  // having seen one minute of additions. Asserted on the `members` KEY, because
  // condition_state is NOT NULL DEFAULT '{}' and 617's own IS NULL version of
  // this assertion could not have failed.
  it('holds the object set snapshot off-cadence and advances it on', async () => {
    // In the fixture's OWN ontology: run_automations evaluates as the owner, so
    // a set borrowed from elsewhere raises ObjectSetNotFound on the tick that
    // actually reads it — which is itself how the off-cadence skip first showed.
    const ot = (await one(
      `insert into public.object_types (ontology_id, api_name, label)
       values ($1,'SchedThing','Sched Thing') returning id`, [ont])).id
    const set = (await one(
      `insert into public.object_sets (name, api_name, subject_type_id, project_id, ontology_id)
       values ('sched-set', 'schedset', $1, $2, $3) returning id`,
      [ot, f.projectId, ont])).id
    const a = (await one(
      `insert into public.automations (project_id, display_name, owner_id, condition, scope)
       values ($1, 'scheduled', $2,
         jsonb_build_object('type','objects_added','object_set_id',$3::uuid,
           'schedule', jsonb_build_object('cron','0 8 * * *','timezone','UTC')), 'project')
       returning id`, [f.projectId, owner, set])).id

    const members = async () => count(
      `select (condition_state ? 'members')::int n from public.automations where id = $1`, [a])

    await db.query(`select public.run_automations(timestamptz '2026-08-21 03:17+00')`)
    expect(await members()).toBe(0)          // off-cadence: nothing was looked at
    await db.query(`select public.run_automations(timestamptz '2026-08-21 08:00+00')`)
    expect(await members()).toBe(1)          // on-cadence: the set was read
  })

  // The grammar it rides on. Automate's cron rule, not the pipeline one —
  // "The minutes field must be a number between 0 and 59, with no special
  // characters" — so */5 is refused here even though a build trigger takes it.
  it('takes an optional schedule on an object set condition, at Automate cron', async () => {
    const ok = async (c: string) => count(
      `select public.automation_condition_valid($1::jsonb)::int n`, [c])
    const base = { type: 'objects_added', object_set_id: '00000000-0000-0000-0000-000000000001' }
    expect(await ok(JSON.stringify(base))).toBe(1)
    expect(await ok(JSON.stringify({ ...base, schedule: { cron: '0 8 * * 1' } }))).toBe(1)
    expect(await ok(JSON.stringify({ ...base, schedule: { cron: '*/5 * * * *' } }))).toBe(0)
    expect(await ok(JSON.stringify({ ...base, schedule: { cron: 'nonsense' } }))).toBe(0)
    // Absent means daily, and a time condition is never gated by this.
    expect((await one(
      `select public.automation_schedule_cron($1::jsonb) c`, [JSON.stringify(base)])).c)
      .toBe('0 0 * * *')
    expect(await count(
      `select public.automation_due('{"type":"time","cron":"0 9 * * *"}'::jsonb,
              timestamptz '2026-08-21 03:17+00')::int n`)).toBe(1)
  })

  // 620. "While paused, scheduled and live triggers do not run, but manual runs
  // and event retries remain available." automation_candidates filters paused;
  // retry_candidates must NOT, and it only happens not to — one `AND NOT
  // a.paused` added for symmetry would break a documented rule with no guard
  // noticing. Both halves, because a runner that ignored `paused` everywhere
  // would pass the retry half alone.
  it('pausing stops the scheduled path and leaves retries alone', async () => {
    const a = (await one(
      `insert into public.automations (project_id, display_name, owner_id, condition, paused)
       values ($1,'paused one',$2,'{"type":"time","cron":"0 3 * * *"}'::jsonb, true)
       returning id`, [f.projectId, owner])).id
    const e = (await one(
      `insert into public.automation_effects (automation_id, position, kind, action_type_id, retry_count)
       values ($1, 0, 'action', $2, 2) returning id`, [a, action])).id
    const run = (await one(
      `select public.record_automation_run($1,$2) as id`, [a, e])).id
    await db.query(
      `select public.settle_automation_run($1,'awaiting_retry','probe',
              timestamptz '2026-08-21 00:00+00', 1)`, [run])

    await db.query(`select public.run_automations(timestamptz '2026-08-21 03:00+00')`)
    expect(await count(
      `select count(*) n from public.automation_runs where automation_id=$1 and id<>$2`,
      [a, run])).toBe(0)

    await db.query(`select public.run_automation_retries(timestamptz '2026-08-21 03:00+00')`)
    const { outcome } = await one(
      `select outcome from public.automation_runs where id=$1`, [run])
    expect(outcome).not.toBe('awaiting_retry')
  })

  it('withholds a fallback only when a retry is actually due', async () => {
    // The rule is a disjunction — "failed non-retryably, OR the maximum number
    // of retries has been reached" — so with no retry config the maximum is
    // zero, trivially reached, and the fallback fires at once.
    const d = (await one(
      `select pg_get_functiondef('public.run_automations(timestamptz)'::regprocedure) as d`)).d
    expect(d).toContain('automation_error_retryable')
    expect(d).toContain('awaiting_retry')
    // And the ledger can say a run is waiting rather than failed. Two
    // constraints now mention it and both are meant: the outcome list admits
    // the value, and 543 ties it to a due time — a run cannot await a retry
    // that nothing will ever claim.
    expect(await count(
      `select count(*) n from pg_constraint
        where conrelid='public.automation_runs'::regclass
          and conname = 'automation_runs_outcome_check'
          and pg_get_constraintdef(oid) like '%awaiting_retry%'`)).toBe(1)
    expect(await count(
      `select count(*) n from pg_constraint
        where conrelid='public.automation_runs'::regclass
          and conname = 'automation_runs_awaiting_has_a_time'`)).toBe(1)
  })
})
