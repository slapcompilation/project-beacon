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

  // 622. An event is one FIRING; the runs are its effect half. The vocabulary
  // is history's Event table, snake-cased, minus the three nothing here can
  // produce (Automation recovered needs a threshold condition; Subscribed and
  // Unsubscribed need a subscriber).
  //
  // The assertion is deliberately an ENUMERATION rather than a spot check: a
  // CHECK value with no writer is the `skipped` situation in reverse, and the
  // only way to know is to make each one happen through its real path.
  it('produces every event type it admits, through the path that produces it', async () => {
    const a = (await one(
      `insert into public.automations (project_id, display_name, owner_id, condition)
       values ($1,'evented',$2,'{"type":"time","cron":"0 4 * * *"}'::jsonb) returning id`,
      [f.projectId, owner])).id
    await db.query(
      `insert into public.automation_effects (automation_id, position, kind, action_type_id)
       values ($1, 0, 'action', $2)`, [a, action])

    // four metadata events, through the trigger
    for (const sql of [
      `update public.automations set paused = true where id = $1`,
      `update public.automations set paused = false where id = $1`,
      `update public.automations set muted = true where id = $1`,
      `update public.automations set muted = false where id = $1`,
      `update public.automations set condition = '{"type":"time","cron":"0 6 * * *"}'::jsonb where id = $1`,
    ]) await db.query(sql, [a])

    // a firing, and then a failure, through the runner
    await db.query(`select public.run_automations(timestamptz '2026-08-22 06:00+00')`)
    await db.query(
      `update public.automations set condition = jsonb_build_object(
         'type','objects_added','object_set_id',gen_random_uuid(),
         'schedule', jsonb_build_object('cron','0 7 * * *','timezone','UTC'))
        where id = $1`, [a])
    await db.query(`select public.run_automations(timestamptz '2026-08-22 07:00+00')`)

    const { rows } = await db.query(
      `select distinct event_type from public.automation_events
        where automation_id = $1 order by 1`, [a])
    expect((rows as { event_type: string }[]).map((r) => r.event_type)).toEqual([
      'automation_triggered', 'condition_edited', 'evaluation_failed',
      'muted', 'paused', 'resumed', 'unmuted',
    ])

    // the effect half hangs off the firing
    expect(await count(
      `select count(*) n from public.automation_runs r
         join public.automation_events e on e.id = r.event_id
        where e.automation_id = $1 and e.event_type = 'automation_triggered'`, [a]))
      .toBeGreaterThan(0)
  })

  // The defect 622's probe turned up, which is the reason it touched the
  // snapshot at all: run_automations caught automation_fires but then called
  // object_set_keys AGAIN, unwrapped, to remember membership. An object set the
  // owner cannot read raised there and ended the whole pass — one broken
  // automation taking every other one down with it, and nothing recording why.
  it('one unreadable object set does not end the pass for the others', async () => {
    const broken = (await one(
      `insert into public.automations (project_id, display_name, owner_id, condition)
       values ($1,'broken',$2, jsonb_build_object(
         'type','objects_added','object_set_id',gen_random_uuid(),
         'schedule', jsonb_build_object('cron','0 8 * * *','timezone','UTC')))
       returning id`, [f.projectId, owner])).id
    const ok = (await one(
      `insert into public.automations (project_id, display_name, owner_id, condition)
       values ($1,'healthy',$2,'{"type":"time","cron":"0 8 * * *"}'::jsonb) returning id`,
      [f.projectId, owner])).id
    await db.query(
      `insert into public.automation_effects (automation_id, position, kind, action_type_id)
       values ($1, 0, 'action', $2)`, [ok, action])

    // Does not throw — that is the regression.
    await db.query(`select public.run_automations(timestamptz '2026-08-22 08:00+00')`)

    // the healthy one still fired, and the broken one recorded why it did not
    expect(await count(
      `select count(*) n from public.automation_events
        where automation_id = $1 and event_type = 'automation_triggered'`, [ok]))
      .toBeGreaterThan(0)
    expect(await count(
      `select count(*) n from public.automation_events
        where automation_id = $1 and event_type = 'evaluation_failed'`, [broken]))
      .toBeGreaterThan(0)
  })

  // Composed, not restated: both history policies call one function, so the
  // scope rule from history-visibility-and-scope has a single statement.
  it('run and event history share one visibility predicate', async () => {
    const { rows } = await db.query(
      `select policyname, qual from pg_policies
        where tablename in ('automation_runs','automation_events')
          and policyname like '%history follows the scope%' order by 1`)
    const quals = (rows as { qual: string }[]).map((r) => r.qual)
    expect(quals).toHaveLength(2)
    for (const q of quals) expect(q).toContain('can_read_automation_history')
  })

  // 624. "the automation will automatically mute when all effects fail for at
  // least 80% of the past 30 events" — the one fully specified threshold in the
  // section, and uncountable until 622 made an event a thing.
  //
  // The boundary is what these assert. 24 is 80% of 30, and "at least" means 24
  // qualifies while 23 does not.
  describe('auto-mute', () => {
    /** n events on a fresh automation, the first `ok` of them succeeding. The
     *  successes go first because the window SLIDES: a 31st event drops the
     *  oldest, so putting failures at the old end hides a moving count. */
    const seed = async (auto: boolean, n: number, ok: number) => {
      const a = (await one(
        `insert into public.automations
           (project_id, display_name, owner_id, condition, auto_mute)
         values ($1,'automuted',$2,'{"type":"time","cron":"0 3 * * *"}'::jsonb,$3)
         returning id`, [f.projectId, owner, auto])).id
      const e = (await one(
        `insert into public.automation_effects (automation_id, position, kind, action_type_id)
         values ($1, 0, 'action', $2) returning id`, [a, action])).id
      for (let k = 1; k <= n; k++) {
        const ev = (await one(
          `select public.record_automation_event($1,'automation_triggered') as id`, [a])).id
        const run = (await one(
          `select public.record_automation_run($1,$2,$3) as id`, [a, e, ev])).id
        await db.query(`select public.settle_automation_run($1,$2,'probe',null)`,
          [run, k <= ok ? 'succeeded' : 'failed'])
      }
      return a
    }
    const due = async (a: string) => count(
      `select public.automation_should_auto_mute($1)::int n`, [a])

    it('needs a full window: twenty-nine all-failed events is not thirty', async () => {
      expect(await due(await seed(true, 29, 0))).toBe(0)
    })

    it('is silent at 23 of 30 and fires at exactly 24', async () => {
      const a = await seed(true, 30, 7)          // 23 failed
      expect(await due(a)).toBe(0)
      // one more failure slides a SUCCESS out of the window, so 24 of 30
      const ev = (await one(
        `select public.record_automation_event($1,'automation_triggered') as id`, [a])).id
      const e = (await one(
        `select id from public.automation_effects where automation_id = $1`, [a])).id
      const run = (await one(
        `select public.record_automation_run($1,$2,$3) as id`, [a, e, ev])).id
      await db.query(`select public.settle_automation_run($1,'failed','probe',null)`, [run])
      expect(await due(a)).toBe(1)
    })

    it('does nothing when the setting is off, however bad the window', async () => {
      const a = await seed(false, 30, 0)         // every event all-failed
      expect(await due(a)).toBe(1)               // the window qualifies
      expect(await count(`select public.auto_mute_if_due($1)::int n`, [a])).toBe(0)
      expect(await count(
        `select (muted)::int n from public.automations where id = $1`, [a])).toBe(0)
    })

    it('mutes through the runner, and the mute lands in the event log', async () => {
      const a = await seed(true, 30, 0)
      await db.query(`select public.run_automations(timestamptz '2026-08-22 03:00+00')`)
      expect(await count(
        `select (muted)::int n from public.automations where id = $1`, [a])).toBe(1)
      // 622's AFTER UPDATE trigger, not a second write path.
      expect(await count(
        `select count(*) n from public.automation_events
          where automation_id = $1 and event_type = 'muted'`, [a])).toBe(1)
    })

    // 622 shipped occurred_at defaulting to now(), which is the TRANSACTION's
    // start time — so every event of one runner pass shared a timestamp and
    // "the past 30" ordered by it was an arbitrary 30. 624 moved it to
    // clock_timestamp().
    it('orders a burst of events, because now() is frozen and clock_timestamp is not', async () => {
      const a = await seed(true, 5, 0)
      expect(await count(
        `select count(distinct occurred_at) n from public.automation_events
          where automation_id = $1`, [a])).toBe(5)
    })
  })

  // 625. A manual run is an EVENT the queue drains, not a second writer of the
  // ledger — which is what 620 tried and could not do without undoing 553.
  describe('manual execution', () => {
    const mk = async (paused = false) => {
      const a = (await one(
        `insert into public.automations
           (project_id, display_name, owner_id, condition, paused)
         values ($1,'manual',$2,'{"type":"time","cron":"0 3 * * *"}'::jsonb,$3)
         returning id`, [f.projectId, owner, paused])).id
      await db.query(
        `insert into public.automation_effects (automation_id, position, kind, action_type_id)
         values ($1, 0, 'action', $2)`, [a, action])
      return a
    }

    it('queues rather than executing, so the ledger keeps one writer', async () => {
      const a = await mk()
      const ev = (await one(`select public.execute_automation_now($1) as id`, [a])).id
      // Queued: no effect has run yet.
      expect(await count(
        `select count(*) n from public.automation_events
          where id = $1 and executed_at is null and requested_by is not null`, [ev])).toBe(1)
      expect(await count(
        `select count(*) n from public.automation_runs where event_id = $1`, [ev])).toBe(0)
    })

    it('runs while PAUSED, which is the state the page names by hand', async () => {
      const a = await mk(true)
      const ev = (await one(`select public.execute_automation_now($1) as id`, [a])).id
      await db.query(`select public.run_automations(timestamptz '2026-08-22 10:00+00')`)
      expect(await count(
        `select count(*) n from public.automation_events
          where id = $1 and executed_at is not null`, [ev])).toBe(1)
      expect(await count(
        `select count(*) n from public.automation_runs where event_id = $1`, [ev]))
        .toBeGreaterThan(0)
    })

    it('is refused on an EXPIRED automation, which is the other half', async () => {
      const a = await mk()
      await db.query(
        `update public.automations set expires_at = now() - interval '1 day' where id = $1`, [a])
      expect(await refused(db, () => db.query(
        `select public.execute_automation_now($1)`, [a])))
        .toContain('Automate:AutomationExpired')
    })

    // "Max time an automation event can wait in execution queue | 45 mins |
    // The event is terminated and none of the effects execute."
    it('terminates an event that waited past 45 minutes, executing nothing', async () => {
      const a = await mk()
      const ev = (await one(
        `insert into public.automation_events
           (automation_id, event_type, requested_by, occurred_at)
         values ($1,'automation_triggered',$2, timestamptz '2026-08-22 09:00+00')
         returning id`, [a, owner])).id
      await db.query(`select public.run_automations(timestamptz '2026-08-22 09:46+00')`)
      expect(await count(
        `select count(*) n from public.automation_runs where event_id = $1`, [ev])).toBe(0)
      const { detail } = await one(
        `select detail from public.automation_events where id = $1`, [ev])
      expect(detail).toContain('Terminated')
    })

    // 627. 625 defined the queue as "any unexecuted event", so 622's metadata
    // trigger fed it: PAUSING an automation executed its effects. Measured at
    // one effect run from a single `set paused = true`. The queue holds manual
    // runs, and the two writers now say which is which.
    it('pausing, muting or editing a condition executes nothing', async () => {
      const a = await mk()
      await db.query(`update public.automations set paused = true where id = $1`, [a])
      await db.query(`update public.automations set muted = true where id = $1`, [a])
      await db.query(
        `update public.automations set condition = '{"type":"time","cron":"0 9 * * *"}'::jsonb
          where id = $1`, [a])
      await db.query(`select public.run_automations(clock_timestamp())`)
      expect(await count(
        `select count(*) n from public.automation_runs where automation_id = $1`, [a])).toBe(0)
      // and none of them is left looking like pending work
      expect(await count(
        `select count(*) n from public.automation_events
          where automation_id = $1 and executed_at is null`, [a])).toBe(0)
    })

    // The scheduled path opens its own events and executes them on the same
    // tick, so it must not leave them sitting in the queue it just joined.
    it('leaves nothing of its own queued', async () => {
      const a = await mk()
      await db.query(`select public.run_automations(timestamptz '2026-08-22 03:00+00')`)
      expect(await count(
        `select count(*) n from public.automation_events
          where automation_id = $1 and executed_at is null`, [a])).toBe(0)
    })
  })

  // 630. automation_fires has returned the triggering object keys since 517 and
  // run_automations discarded them. Now an effect can bind one action parameter
  // to receive each object, which IS per-object execution: "each action is
  // executed once for each object from the condition".
  describe('effect inputs', () => {
    let ot = ''; let other = ''; let set = ''; let at = ''
    let pObj = ''; let pStr = ''

    const bind = async (automation: string, param: string | null) => db.query(
      `insert into public.automation_effects
         (automation_id, position, kind, action_type_id, object_input_parameter_id)
       values ($1, 0, 'action', $2, $3)`, [automation, at, param])

    const withCondition = async (cond: object) => (await one(
      `insert into public.automations (project_id, display_name, owner_id, condition)
       values ($1,'bound',$2,$3::jsonb) returning id`,
      [f.projectId, owner, JSON.stringify(cond)])).id

    beforeAll(async () => {
      const ont = (await one(
        `select ontology_id from public.action_types where id = $1`, [action])).ontology_id
      ot = (await one(
        `insert into public.object_types (ontology_id, api_name, label)
         values ($1,'Bound630','Bound') returning id`, [ont])).id
      other = (await one(
        `insert into public.object_types (ontology_id, api_name, label)
         values ($1,'Unbound630','Unbound') returning id`, [ont])).id
      set = (await one(
        `insert into public.object_sets (name, api_name, subject_type_id, project_id, ontology_id)
         values ('bound','bound630',$1,$2,$3) returning id`, [ot, f.projectId, ont])).id
      at = (await one(
        `insert into public.action_types (ontology_id, api_name, label)
         values ($1,'bound-630','Bound 630') returning id`, [ont])).id
      pObj = (await one(
        `insert into public.action_type_parameters
           (action_type_id, api_name, display_name, data_kind, object_type_id)
         values ($1,'theObject','The object','object',$2) returning id`, [at, ot])).id
      pStr = (await one(
        `insert into public.action_type_parameters
           (action_type_id, api_name, display_name, data_kind, base_type)
         values ($1,'aString','A string','base_type','string') returning id`, [at])).id
    }, 60_000)

    // effect-actions ENUMERATES three conditions that expose an input, and
    // Run on all objects is not one — whatever its picker chip says.
    it('refuses a binding on a condition that exposes no input', async () => {
      for (const cond of [
        { type: 'time', cron: '0 3 * * *' },
        { type: 'run_on_all', object_set_id: set, schedule: { cron: '0 3 * * *' } },
      ]) {
        const a = await withCondition(cond)
        expect(await refused(db, () => bind(a, pObj)))
          .toContain('Automate:ConditionExposesNoInput')
      }
    })

    it('refuses a parameter that cannot hold an object, or holds the wrong one', async () => {
      const a = await withCondition(
        { type: 'objects_added', object_set_id: set, schedule: { cron: '0 3 * * *' } })
      expect(await refused(db, () => bind(a, pStr)))
        .toContain('Automate:InputTypeMismatch')
      const wrong = (await one(
        `insert into public.action_type_parameters
           (action_type_id, api_name, display_name, data_kind, object_type_id)
         values ($1,'wrongType','Wrong','object',$2) returning id`, [at, other])).id
      expect(await refused(db, () => bind(a, wrong)))
        .toContain('Automate:InputTypeMismatch')
    })

    it('accepts the aligned parameter, and locks the condition behind it', async () => {
      const a = await withCondition(
        { type: 'objects_added', object_set_id: set, schedule: { cron: '0 3 * * *' } })
      await bind(a, pObj)                       // not blanket: this one is fine
      expect(await refused(db, () => db.query(
        `update public.automations set condition = '{"type":"time","cron":"0 3 * * *"}'::jsonb
          where id = $1`, [a])))
        .toContain('Automate:ConditionExposesNoInput')
    })

    // The point of the whole change: one run row per object, each naming its
    // own, and a failure on one not stopping the next.
    it('runs once per object, and isolates their failures', async () => {
      const a = await withCondition(
        { type: 'objects_added', object_set_id: set, schedule: { cron: '0 3 * * *' } })
      await bind(a, pObj)
      const e = (await one(
        `select id from public.automation_effects where automation_id = $1`, [a])).id
      await db.query(
        `select public.run_effect_per_object($1,$2,null,array['k1','k2','k3'])`, [a, e])
      expect(await count(
        `select count(*) n from public.automation_runs
          where effect_id = $1 and object_key in ('k1','k2','k3')`, [e])).toBe(3)
      // every one settled rather than one aborting the loop
      expect(await count(
        `select count(*) n from public.automation_runs
          where effect_id = $1 and object_key is not null and outcome = 'started'`, [e])).toBe(0)
    })

    // "Max number of objects per automation evaluation ... when per-object
    // execution is enabled | 10,000 | ... before any effects are executed"
    it('caps per-object execution at the published ten thousand', async () => {
      expect(await count(`select public.automation_per_object_limit() n`)).toBe(10000)
      const d = (await one(
        `select pg_get_functiondef('public.run_automations(timestamptz)'::regprocedure) as d`)).d
      // the cap is checked where the page puts it: at evaluation, ahead of the
      // effects loop, so nothing is processed rather than 10,000 things.
      expect(d.indexOf('automation_per_object_limit'))
        .toBeLessThan(d.indexOf('run_effect_per_object'))
    })
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
