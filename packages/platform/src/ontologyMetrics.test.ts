// Ontology metrics — the ledger 578 named and could not compute against.
//
// The load-bearing case is the last one: an ontology that never switched
// metrics on must report NO DATA, not NO USAGE. `view-usage` warns that when
// the toggle is off you see "No usage for the last 30 days" for everything, so
// a cleanup flag reading absence-of-rows as absence-of-usage would propose
// deleting an entire ontology.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('usage is a request counted once', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let user = ''
  let config = ''
  let busy = ''
  let quiet = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'metrics579')
    user = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(),'00000000-0000-0000-0000-000000000000',
               'authenticated','authenticated','metrics579@beacon.test') returning id`)).id
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'metrics579','Metrics579',false) returning id`, [f.spaceId])).id
    const mk = async (name: string) => (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label, description)
       values ($1,$2,$3,$3,'described') returning id`, [ont, f.projectId, name])).id
    busy = await mk('Aircraft')
    quiet = await mk('Quiet')
    config = (await one(
      `insert into public.cleanup_configurations (user_id, ontology_id)
       values ($1,$2) returning id`, [user, ont])).id
  })
  afterAll(async () => { await rollback(db) })

  // Usage is attributed to whoever made the request, so the recording calls run
  // under a caller. Without a `sub` the rows still count as reads and writes but
  // contribute nothing to Active users, which is faithful — "the number of
  // unique user IDs" cannot count an absent one — and not what we want to test.
  const record = async (app: string, reads = 0, writes = 0, target = busy) => {
    await db.query(
      `select set_config('request.jwt.claims', json_build_object('sub',$1::text)::text, true)`,
      [user])
    await db.query(
      `select public.record_ontology_usage($1,null,$2,$3,$4)`, [target, app, reads, writes])
    await db.query(`select set_config('request.jwt.claims','',true)`)
  }
  const flags = async (t: string) => (await one(
    `select public.object_type_cleanup_flags($1,$2) as f`, [t, config])).f

  it('ships the toggle off, and records nothing until it is on', async () => {
    const o = await one(`select metrics_enabled from public.ontologies where id = $1`, [ont])
    expect(o.metrics_enabled).toBe(false)

    await record('quiver', 1)
    const n = await one(
      `select count(*)::int as n from public.ontology_usage where object_type_id = $1`, [busy])
    expect(Number(n.n), 'the toggle being off means nothing is written').toBe(0)
  })

  it('accumulates repeat requests at the grain, one row per application', async () => {
    await db.query(
      `update public.ontologies set metrics_enabled = true,
              metrics_enabled_at = now() - interval '90 days' where id = $1`, [ont])

    await record('quiver', 1)
    await record('quiver', 1)
    await record('actions', 0, 1)

    const rows = await db.query(
      `select application, reads, writes from public.ontology_usage
        where object_type_id = $1 order by application`, [busy])
    expect(rows.rows).toEqual([
      { application: 'actions', reads: 0, writes: 1 },
      { application: 'quiver', reads: 2, writes: 0 },
    ])
  })

  it('derives Interactions, Reads, Writes and Active users rather than storing them', async () => {
    const s = await one(`select * from public.ontology_usage_summary($1, 30)`, [busy])
    expect(Number(s.reads)).toBe(2)
    expect(Number(s.writes)).toBe(1)
    expect(Number(s.interactions), 'interactions is reads + writes').toBe(3)
    expect(Number(s.active_users), 'one caller made all of them').toBe(1)
    expect(s.last_interaction).not.toBeNull()
  })

  it('breaks usage down by application, as the Usage tab does', async () => {
    const { rows } = await db.query(
      `select application, reads, writes from public.ontology_usage_by_application($1,30)`, [busy])
    expect(rows.map((r) => (r as { application: string }).application).sort())
      .toEqual(['actions', 'quiver'])
  })

  it('excludes Ontology Manager\'s own traffic', async () => {
    // "any object type or link type usage happening in Ontology Manager is not
    // included" — otherwise browsing the cleanup queue keeps everything alive.
    await record('ontology-manager', 99)
    const s = await one(`select reads from public.ontology_usage_summary($1, 30)`, [busy])
    expect(Number(s.reads)).toBe(2)
  })

  it('names one resource, never two', async () => {
    const err = await refused(db, () => db.query(
      `select public.record_ontology_usage($1,$2,'quiver',1,0)`, [busy, busy]))
    expect(err).toContain('Ontology:UsageNamesOneResource')
  })

  it('flags a type with no usage, once the window is covered', async () => {
    expect(await flags(busy), 'a type with reads is not unused').not.toContain('no_registered_usage')
    expect(await flags(quiet), 'a type with none is').toContain('no_registered_usage')
  })

  it('reports NO DATA rather than NO USAGE when metrics did not cover the window', async () => {
    // The hazard the page warns about, and the reason 578 could not compute
    // this flag at all. Switching metrics on today does not make the last 30
    // days empty — it makes them unknown.
    await db.query('savepoint w')
    await db.query(`update public.ontologies set metrics_enabled_at = now() where id = $1`, [ont])

    const covered = await one(
      `select public.ontology_usage_window_covered($1,30) as c`, [ont])
    expect(covered.c).toBe(false)
    expect(await flags(quiet), 'no data is not no usage').not.toContain('no_registered_usage')

    // And with the toggle off entirely, likewise.
    await db.query(`update public.ontologies set metrics_enabled = false where id = $1`, [ont])
    const off = await one(`select public.ontology_usage_window_covered($1,30) as c`, [ont])
    expect(off.c).toBe(false)
    expect(await flags(quiet)).not.toContain('no_registered_usage')
    await db.query('rollback to savepoint w')
  })

  it('leaves the other cleanup flags exactly as 578 built them', async () => {
    // 579 rewrites `cleanup_flags()` and `object_type_cleanup_flags()`; the
    // regression to fear is losing an arm while adding one.
    const { rows } = await db.query(
      `select flag, computable from public.cleanup_flags() order by flag`)
    expect(rows.length).toBe(7)
    const un = (rows as { flag: string; computable: boolean }[])
      .filter((r) => !r.computable).map((r) => r.flag)
    expect(un, 'only phonograph_deindexed stays uncomputable').toEqual(['phonograph_deindexed'])

    await db.query('savepoint d')
    await db.query(
      `update public.object_types set status = 'deprecated', deprecation_reason = 'x',
              deprecation_deadline = current_date - 1 where id = $1`, [busy])
    expect(await flags(busy)).toContain('past_deprecation_date')
    await db.query('rollback to savepoint d')
  })
})
