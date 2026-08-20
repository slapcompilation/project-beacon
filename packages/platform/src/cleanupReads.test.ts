// The READS column of the cleanup queue.
//
// `cleanup-filter-example.png` shows it — 1, 1 and 43 for three example types,
// and the one with 43 is the one the page deprecates rather than deletes. Ours
// rendered a hardcoded null in its place, while `run_cleanup` was already
// asking the usage ledger about every type it walked for the
// `no_registered_usage` flag: it asked, used the answer as a boolean, and threw
// the number away.
//
// The distinction this file exists to hold is NULL versus 0. A zero means
// nobody used the type. A null means we were not counting. Rendering the second
// as the first is how a live object type gets deleted, and 579 already built the
// predicate that tells them apart.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('the cleanup queue carries its read count', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let user = ''
  let config = ''
  let dead = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const queue = async () => {
    const { rows } = await db.query(
      `select t.api_name, c.reads, c.flags
         from public.cleanup_candidates c
         join public.object_types t on t.id = c.object_type_id
        where c.configuration_id = $1 order by t.api_name`, [config])
    return rows as { api_name: string; reads: string | null; flags: string[] }[]
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'reads596')
    user = (await one('select gen_random_uuid() as id')).id
    const email = `reads596-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [user, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [user, email, f.orgId])
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'reads596','Reads596',false) returning id`, [f.spaceId])).id
    // Flagged by `past_deprecation_date`, which does NOT depend on usage — so
    // the row stays in the queue whether metrics are on or off, and the reads
    // column is the only thing that changes between the two.
    dead = (await one(
      `insert into public.object_types
         (ontology_id, project_id, api_name, label, description,
          status, deprecation_reason, deprecation_deadline)
       values ($1,$2,'Abandoned','Abandoned','gone','deprecated','gone',current_date - 1)
       returning id`, [ont, f.projectId])).id
    config = (await one(
      `insert into public.cleanup_configurations (user_id, ontology_id)
       values ($1,$2) returning id`, [user, ont])).id
  })

  afterAll(async () => { await rollback(db) })

  it('records NULL, not zero, while metrics have never been on', async () => {
    // "OFF IS NOT ZERO": with metrics off the window is not covered, and a count
    // of 0 would say "nobody used this" about a type nobody was watching.
    expect(await one(
      `select public.ontology_usage_window_covered($1, 30) as covered`, [ont])).toEqual(
      expect.objectContaining({ covered: false }))

    await db.query(`select public.run_cleanup($1)`, [config])
    const rows = await queue()
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r.reads).toBeNull()
  })

  it('records the count once metrics have covered the window', async () => {
    await db.query(
      `update public.ontologies set metrics_enabled = true,
              metrics_enabled_at = now() - interval '60 days' where id = $1`, [ont])
    expect((await one(
      `select public.ontology_usage_window_covered($1, 30) as covered`, [ont])).covered).toBe(true)

    // Three reads on the type, through the ledger's own entry point.
    await db.query(
      `select public.record_ontology_usage($1, null, 'Object Explorer', 3, 0)`, [dead])

    await db.query(`select public.run_cleanup($1)`, [config])
    const row = (await queue()).find((r) => r.api_name === 'Abandoned')
    expect(row).toBeDefined()
    expect(Number(row?.reads)).toBe(3)
  })

  it('and a covered window with no traffic really is zero', async () => {
    const quiet = (await one(
      `insert into public.object_types
         (ontology_id, project_id, api_name, label, description,
          status, deprecation_reason, deprecation_deadline)
       values ($1,$2,'Quiet','Quiet','gone','deprecated','gone',current_date - 1)
       returning id`, [ont, f.projectId])).id
    expect(quiet).toBeTruthy()
    await db.query(`select public.run_cleanup($1)`, [config])
    const row = (await queue()).find((r) => r.api_name === 'Quiet')
    expect(row).toBeDefined()
    // Zero, not null — the difference the column exists to carry.
    expect(Number(row?.reads)).toBe(0)
    expect(row?.reads).not.toBeNull()
  })
})
