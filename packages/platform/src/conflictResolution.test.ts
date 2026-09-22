// Which value wins when a user edit meets a datasource update.
//
// "When a single object (that is, a row or object with a specific primary key
// value) receives data from both the input datasource and user edits, these
// received values must be transparently resolved with a conflict resolution
// strategy" (object-edits/how-edits-applied).
//
// The page prints the answer for a two-row Ticket example, and that printed
// table is what this asserts — the same standard as the transaction-types
// suite. 842 built the second strategy; before it, `object_state` never read
// `conflict_resolution` at all and both strategies behaved identically.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, type Fixture } from './harness'

describe.skipIf(noDb)('a datasource resolves edits against its own timestamp', () => {
  let db: pg.Client
  let f: Fixture
  let type = ''
  let ds = ''
  let usr = ''
  let switchedAt = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  /** The datasource row as the indexer builds it: keyed by property_id. */
  const row = (pk: string, title: string, priority: string, ts: string | null) =>
    JSON.stringify(ts === null
      ? { ticket_id: pk, title, priority }
      : { ticket_id: pk, title, priority, ts })

  const state = async (pk: string, r: string) =>
    (await one('select properties, deleted from public.object_state($1,$2,$3::jsonb)',
      [type, pk, r])) as unknown as { properties: Record<string, string>; deleted: boolean }

  /** switchedAt + n minutes, as an ISO string the jsonb row can carry. */
  const at = async (minutes: number): Promise<string> =>
    (await one(`select ($1::timestamptz + ($2 || ' minutes')::interval)::text as t`,
      [switchedAt, String(minutes)])).t

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'cflres')
    usr = (await one('select gen_random_uuid() as id')).id
    const email = `cflres-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, email, f.orgId])

    const ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'cflres','Cflres',false) returning id`, [f.spaceId])).id
    // Edits are written directly here, so the toggle the guard names in its own
    // hint is turned off rather than faked.
    type = (await one(
      `insert into public.object_types (ontology_id, project_id, api_name, label, only_edits_via_actions)
       values ($1,$2,'CflTicket','Cfl ticket',false) returning id`, [ont, f.projectId])).id
    ds = (await one(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3) returning id`, [type, f.datasetId, f.branchId])).id
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, api_name, display_name, base_type, source,
          backing_column, is_primary_key, is_title_key, required, datasource_id)
       values ($1,'ticket_id','ticketId','Ticket ID','string','column','ticket_id',true,true,true,null),
              ($1,'title','title','Title','string','column','title',false,false,false,$2),
              ($1,'priority','priority','Priority','string','column','priority',false,false,false,$2),
              ($1,'ts','ts','Timestamp','timestamp','column','ts',false,false,false,$2),
              ($1,'team','team','Team','string','user_input',null,false,false,false,$2)`,
      [type, ds])

    const stamp = (await one(
      `select id from public.object_type_properties
        where object_type_id=$1 and property_id='ts'`, [type])).id
    await db.query(
      `update public.object_type_datasources
          set conflict_resolution='apply_most_recent_value', timestamp_property_id=$2 where id=$1`,
      [ds, stamp])
    switchedAt = (await one(
      `select conflict_resolution_changed_at::text as t
         from public.object_type_datasources where id=$1`, [ds])).t

    // The page's timeline, shifted to sit after the switch so each edit is
    // measured against its own submission time: title at +1m, the datasource
    // timestamp at +2m, priority at +3m.
    for (const pk of ['101', '102']) {
      await db.query(
        `insert into public.object_edits
           (object_type_id, primary_key, instruction, properties, applied_at, applied_by_user_id)
         values ($1,$2,'modify','{"title":"Ticket"}'::jsonb, $3::timestamptz + interval '1 minute', $4),
                ($1,$2,'modify','{"priority":"P0"}'::jsonb, $3::timestamptz + interval '3 minutes', $4)`,
        [type, pk, switchedAt, usr])
    }
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  // The page prints: 101 keeps "Ticket One" and takes "P0".
  it('keeps the datasource value for an edit older than the datasource timestamp', async () => {
    const s = await state('101', row('101', 'Ticket One', 'P1', await at(2)))
    expect(s.deleted).toBe(false)
    expect(s.properties.title, 'the 8:30 edit predates the 9:00 datasource timestamp').toBe('Ticket One')
    expect(s.properties.priority, 'the 9:30 edit does not').toBe('P0')
  })

  // And 102, whose timestamp is empty, takes both: "there is no value for the
  // timestamp property in the backing datasource, so all three conditional
  // edits are applied, regardless of their associated timestamps".
  it('applies every edit when the datasource has no timestamp value', async () => {
    const s = await state('102', row('102', 'Ticket Two', 'P2', null))
    expect(s.properties.title).toBe('Ticket')
    expect(s.properties.priority).toBe('P0')
  })

  // "it is possible for some newer user edits to apply and older user edits to
  // not apply on the same object" — one edit, decided property by property.
  it('decides one edit property by property, by the datasource backing each', async () => {
    const applied = (await one(
      `select public.edit_properties_that_apply($1,'{"title":"X","team":"Recruiting"}'::jsonb,
              $2::timestamptz + interval '1 minute',
              jsonb_build_object('ts', ($2::timestamptz + interval '2 minutes')::text)) as p`,
      [type, switchedAt])) as unknown as { p: Record<string, string> }
    // "For edit-only properties, user edits will always apply regardless of the
    // timestamp on the input datasource."
    expect(applied.p).toEqual({ team: 'Recruiting' })
  })

  // "any existing edits to those properties will be conditionally applied based
  // on the timestamp of the conflict resolution strategy change"
  it('measures an edit older than the switch against the switch', async () => {
    const applied = (await one(
      `select public.edit_properties_that_apply($1,'{"title":"X"}'::jsonb,
              timestamptz '2010-01-01 08:30:00+00',
              jsonb_build_object('ts', ($2::timestamptz - interval '1 minute')::text)) as p`,
      [type, switchedAt])) as unknown as { p: Record<string, string> }
    expect(applied.p, 'the switch is newer than the datasource row, so the edit survives')
      .toEqual({ title: 'X' })
  })

  // The default strategy is what every other object type in the platform uses,
  // and 842 must not have moved it.
  it('leaves apply_user_edits alone — the edit always wins', async () => {
    await db.query(
      `update public.object_type_datasources
          set conflict_resolution='apply_user_edits', timestamp_property_id=null where id=$1`, [ds])
    const s = await state('101', row('101', 'Ticket One', 'P1', await at(2)))
    expect(s.properties.title).toBe('Ticket')
    expect(s.properties.priority).toBe('P0')
  })

  // The switch is a stored fact, because pre-existing edits are measured
  // against it. Asked last, since the test above changes it.
  it('stamps when the strategy changed', async () => {
    const after = (await one(
      `select conflict_resolution_changed_at::text as t
         from public.object_type_datasources where id=$1`, [ds])).t
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(switchedAt).getTime())
  })
})
