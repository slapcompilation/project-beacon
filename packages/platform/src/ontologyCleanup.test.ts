// Phase F2. The second list, asking whether an object type is dead rather than
// whether it is malformed.
//
// The page gives six flags and warns the list "is aimed at answering common
// issues, but is not exhaustive:". `cleanup-configuration-view.png` shows seven
// toggles — the extra one, `No registered usage in 30 days`, appears in no
// sentence anywhere and is the strongest signal in the tool.
//
// Two of the seven are registered and not computable, each for a documented
// reason. Getting that pair wrong in either direction is the failure this file
// exists to catch: computing `phonograph_deindexed` would invent a check the
// page says has no v2 equivalent, and computing `no_registered_usage` without a
// metrics ledger would report every object type as unused.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('cleanup asks whether an object type is dead', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let user = ''
  let config = ''
  const ot: Record<string, string> = {}

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'cleanup578')
    user = (await one(
      `insert into auth.users (id, instance_id, aud, role, email)
       values (gen_random_uuid(),'00000000-0000-0000-0000-000000000000',
               'authenticated','authenticated','cleanup578@beacon.test') returning id`)).id
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'cleanup578','Cleanup578',false) returning id`, [f.spaceId])).id
    config = (await one(
      `insert into public.cleanup_configurations (user_id, ontology_id)
       values ($1,$2) returning id`, [user, ont])).id

    const mkType = async (key: string, cols: string, vals: string, params: unknown[] = []) => {
      ot[key] = (await one(
        `insert into public.object_types (ontology_id, project_id, api_name, label${cols})
         values ($1,$2,$3,$4${vals}) returning id`,
        [ont, f.projectId, key, key, ...params])).id
    }
    await mkType('Fine', ', description', ',$5', ['described'])
    await mkType('Dead', ', description, status, deprecation_reason, deprecation_deadline',
      ",$5,'deprecated','gone',current_date - 1", ['described'])
    await mkType('Blank', ', description', ',$5', [''])

    // A backing dataset that Compass has trashed, and one nobody has touched.
    const backing = async (key: string, extra: string, params: unknown[]) => {
      const ds = (await one(
        `insert into public.datasets (organization_id, project_id, api_name, name${extra})
         values ($1,$2,$3,$3${params.length ? ',$4' : ''}) returning id`,
        [f.orgId, f.projectId, `${key.toLowerCase()}_578`, ...params])).id
      const br = (await one(
        `insert into public.dataset_branches (dataset_id, name)
         values ($1,'master') returning id`, [ds])).id
      await db.query(
        `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
         values ($1,$2,$3)`, [ot[key], ds, br])
      return ds
    }
    await mkType('Trashed', ', description', ',$5', ['described'])
    await backing('Trashed', ', trashed_at', [new Date().toISOString()])
    await mkType('Stale', ', description', ',$5', ['described'])
    const old = await backing('Stale', '', [])
    await db.query(
      `update public.datasets set updated_at = now() - interval '200 days' where id = $1`, [old])
  })
  afterAll(async () => { await rollback(db) })

  const flagsFor = async (key: string) => (await one(
    `select public.object_type_cleanup_flags($1,$2) as f`, [ot[key], config])).f

  it('registers seven flags, and refuses two of them with a stated reason', async () => {
    const { rows } = await db.query(`select flag, computable, note from public.cleanup_flags()`)
    expect(rows.length).toBe(7)
    const un = (rows as { flag: string; computable: boolean; note: string }[])
      .filter((r) => !r.computable)
    expect(un.map((r) => r.flag).sort()).toEqual(['no_registered_usage', 'phonograph_deindexed'])
    for (const r of un) expect(r.note.length, `${r.flag} says why`).toBeGreaterThan(40)
  })

  it('ships five flags on and two off, the two the filter panel omits', async () => {
    const { rows } = await db.query(
      `select flag from public.cleanup_flags() where not default_on order by flag`)
    expect(rows.map((r) => (r as { flag: string }).flag))
      .toEqual(['description_missing', 'display_name_regex'])
    const on = await one(
      `select count(*)::int as n from public.cleanup_effective_flags($1) where enabled`, [config])
    expect(Number(on.n)).toBe(5)
  })

  it('carries the published parameter defaults', async () => {
    const { rows } = await db.query(
      `select flag, days from public.cleanup_effective_flags($1)
        where days is not null order by flag`, [config])
    expect(rows).toEqual([
      { flag: 'datasource_not_updated', days: 90 },
      { flag: 'no_registered_usage', days: 30 },
    ])
  })

  it('computes each of the five, and leaves a healthy type alone', async () => {
    expect(await flagsFor('Dead')).toContain('past_deprecation_date')
    expect(await flagsFor('Trashed')).toContain('trashed_datasource')
    expect(await flagsFor('Stale')).toContain('datasource_not_updated')
    expect(await flagsFor('Fine')).toEqual([])
  })

  it('does not fire a flag that ships off, even when the type trips it', async () => {
    // `Blank` has an empty description AND a display name the default regex
    // would match. In default mode neither flag is enabled, so neither fires.
    expect(await flagsFor('Blank')).toEqual([])
  })

  it('takes the highest priority among the flags a type triggers', async () => {
    const n = await one(`select public.run_cleanup($1) as n`, [config])
    expect(Number(n.n)).toBe(3)

    const rows = await db.query(
      `select t.api_name, c.priority from public.cleanup_candidates c
         join public.object_types t on t.id = c.object_type_id
        where c.configuration_id = $1 order by t.api_name`, [config])
    expect(rows.rows).toEqual([
      { api_name: 'Dead', priority: 'high' },      // past_deprecation_date
      { api_name: 'Stale', priority: 'medium' },   // datasource_not_updated
      { api_name: 'Trashed', priority: 'high' },   // trashed_datasource
    ])

    const c = await one(
      `select computed_at from public.cleanup_configurations where id = $1`, [config])
    expect(c.computed_at, 'running the queue stamps when').not.toBeNull()
  })

  it('resets stored results when the settings change, rather than recomputing', async () => {
    // "Saving changes to flag settings will reset previous Cleanup results",
    // and Foundry prompts rather than recalculating silently — so the results
    // go and computed_at goes with them.
    await db.query(
      `update public.cleanup_configurations set mode = 'custom' where id = $1`, [config])
    const after = await one(
      `select computed_at,
              (select count(*)::int from public.cleanup_candidates where configuration_id = $1) as n
         from public.cleanup_configurations where id = $1`, [config])
    expect(after.computed_at).toBeNull()
    expect(Number(after.n)).toBe(0)
  })

  it('keeps custom mode on the published defaults until something is overridden', async () => {
    // The sentence that forces (mode, overrides) rather than a row per flag:
    // "new flags that get added in the future will not be automatically turned
    // on" for custom users — so absence of an override must still mean
    // "as published", or switching to Custom would silently change the set.
    const on = await one(
      `select count(*)::int as n from public.cleanup_effective_flags($1) where enabled`, [config])
    expect(Number(on.n)).toBe(5)
  })

  it('lets one override enable one flag, and only that one', async () => {
    await db.query(
      `insert into public.cleanup_flag_overrides
         (configuration_id, flag, enabled, param_regex)
       values ($1,'display_name_regex',true,'Bl')`, [config])
    const hits = await flagsFor('Blank')
    expect(hits).toContain('display_name_regex')
    expect(hits).not.toContain('description_missing')
  })

  it('hides a snoozed type from one user\'s queue until the snooze expires', async () => {
    const before = Number((await one(`select public.run_cleanup($1) as n`, [config])).n)

    await db.query(
      `insert into public.cleanup_snoozes (user_id, object_type_id, until)
       values ($1,$2, now() + interval '7 days')`, [user, ot.Dead])
    const during = Number((await one(`select public.run_cleanup($1) as n`, [config])).n)
    expect(during).toBe(before - 1)

    await db.query(
      `update public.cleanup_snoozes set until = now() - interval '1 day'
        where user_id = $1 and object_type_id = $2`, [user, ot.Dead])
    const after = Number((await one(`select public.run_cleanup($1) as n`, [config])).n)
    expect(after, 'an expired snooze hides nothing').toBe(before)
  })

  it('orders high above medium above low', async () => {
    const { rows } = await db.query(
      `select public.cleanup_priority_rank('high') as h,
              public.cleanup_priority_rank('medium') as m,
              public.cleanup_priority_rank('low') as l`)
    const r = rows[0] as { h: number; m: number; l: number }
    expect(r.h).toBeLessThan(r.m)
    expect(r.m).toBeLessThan(r.l)
  })
})
