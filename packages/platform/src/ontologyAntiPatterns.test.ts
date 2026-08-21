// Action Sprawl: the one countable indicator in three pages of design guidance.
//
//   "More than 10 action types for a single object type"
//                          (ontology/ontology-anti-patterns, Indicators)
//
// Eight anti-patterns are named and every other indicator is qualitative
// ("many properties that are frequently null", "End users frequently ask"), so
// this is the only one a database can answer. 621 made it an
// `ontology_warnings()` arm rather than a violation, because the page calls it
// an INDICATOR — weaker than "warned" or "recommended" — and warnings do not
// block a save.
//
// The boundary is the assertion that matters: "more than 10" is not "10 or
// more", and an off-by-one here would warn on a perfectly cohesive ontology.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('ontology anti-patterns', () => {
  let db: pg.Client
  let f: Fixture
  let ont = ''
  let ot = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)

  /** One more action type whose rule targets the object type. */
  const addAction = async (n: number) => {
    const at = (await one(
      `insert into public.action_types (ontology_id, api_name, label)
       values ($1,$2,$2) returning id`, [ont, `sprawl${n}`])).id
    await db.query(
      `insert into public.action_type_rules (action_type_id, kind, position, object_type_id)
       values ($1,'delete_object',0,$2)`, [at, ot])
  }

  const sprawlWarnings = () => count(
    `select count(*) n from public.ontology_warnings()
      where subject = $1 and problem like '%Action Sprawl%'`, [ot])

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'sprawl621')
    ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'sprawl621','Sprawl621',false) returning id`, [f.spaceId])).id
    ot = (await one(
      `insert into public.object_types (ontology_id, api_name, label)
       values ($1,'Sprawled','Sprawled') returning id`, [ont])).id
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('stays silent at ten action types, because the page says MORE than ten', async () => {
    for (let n = 1; n <= 10; n++) await addAction(n)
    expect(await sprawlWarnings()).toBe(0)
  })

  it('fires on the eleventh', async () => {
    await addAction(11)
    expect(await sprawlWarnings()).toBe(1)
  })

  it('warns without blocking, which is the list it was written for', async () => {
    // ontology_violations() refuses a save that introduces one of its rows.
    // An anti-pattern INDICATOR must never reach it.
    expect(await count(
      `select count(*) n from public.ontology_violations() where subject = $1`, [ot]))
      .toBe(0)
  })

  it('counts action types, not rules — several rules from one action is cohesion', async () => {
    // The distinction the page is actually drawing: one action that changes
    // eleven things is the GOOD shape. Eleven actions that each change one is
    // the anti-pattern. Adding ten more rules from a single action type must
    // not move the count.
    const before = await sprawlWarnings()
    const at = (await one(
      `insert into public.action_types (ontology_id, api_name, label)
       values ($1,'cohesive','cohesive') returning id`, [ont])).id
    for (let p = 0; p < 10; p++) {
      await db.query(
        `insert into public.action_type_rules (action_type_id, kind, position, object_type_id)
         values ($1,'delete_object',$2,$3)`, [at, p, ot])
    }
    expect(await sprawlWarnings()).toBe(before)
  })
})
