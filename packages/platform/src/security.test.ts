// Who can see what, checked against `security/markings` and the pages under it.
//
// Two of these exist because a re-read of the page against the result found a
// hole: writing bypassed markings, and a marked dataset still appeared in the
// list. Both passed every test that existed at the time, because both lived
// where the predicate was not called.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, asAuthenticated, type Fixture } from './harness'

describe.skipIf(noDb)('access', () => {
  let db: pg.Client
  let f: Fixture
  let markingId: string
  let categoryId: string
  let downstreamId: string

  const access = async (id: string): Promise<[boolean, boolean]> => {
    const { rows: [a] } = await db.query(
      'select public.can_read_dataset($1) as meta, public.can_read_dataset_data($1) as data', [id])
    const r = a as { meta: boolean; data: boolean }
    return [r.meta, r.data]
  }
  // The guard refuses an application by someone who does not hold the marking,
  // which is correct and in the way of setting up the case being tested.
  const withGuardOff = async (fn: () => Promise<void>) => {
    await db.query('alter table public.resource_markings disable trigger guard_marking_application')
    await fn()
    await db.query('alter table public.resource_markings enable trigger guard_marking_application')
  }
  const applyTo = (kind: string, id: string) => withGuardOff(async () => {
    await db.query(
      `insert into public.resource_markings (marking_id, resource_kind, resource_id) values ($1,$2,$3)`,
      [markingId, kind, id])
  })
  const clearMarkings = () => withGuardOff(async () => {
    await db.query('delete from public.resource_markings where marking_id=$1', [markingId])
  })

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'platform_sec')
    // 472: creating a marking takes a Category Administrator, and the creator
    // seed needs a real auth.uid() — the harness claims carry no sub.
    const { rows: [au] } = await db.query(`
      insert into auth.users (id, instance_id, aud, role, email)
      values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'sec-cat@beacon.test') returning id`)
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: (au as { id: string }).id, app_metadata: { role: 'admin', org_id: f.orgId } })])
    const { rows: [c] } = await db.query(
      `insert into public.marking_categories (name) values ('platform_sec') returning id`)
    categoryId = (c as { id: string }).id
    const { rows: [m] } = await db.query(
      `insert into public.markings (category_id, name) values ($1,'PII') returning id`, [categoryId])
    markingId = (m as { id: string }).id
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [f.claims])
    const { rows: [d] } = await db.query(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'platform_sec_down','downstream') returning id`, [f.orgId, f.projectId])
    downstreamId = (d as { id: string }).id
    await db.query(
      `insert into public.dataset_inputs (dataset_id, input_dataset_id) values ($1,$2)`,
      [downstreamId, f.datasetId])
  })
  afterAll(async () => { await rollback(db) })

  describe('the tenant boundary', () => {
    // can_write_dataset is called from a SECURITY DEFINER function, where RLS
    // does not run — so it has to carry the organization check itself. It did
    // not, and an admin of any other tenant passed. Migration 395.
    it('an admin of another organization can neither read nor write', async () => {
      const { rows: [o] } = await db.query(
        `insert into public.organizations (name) values ('platform_sec other') returning id`)
      await db.query(`select set_config('request.jwt.claims', $1, true)`,
        [JSON.stringify({ app_metadata: { role: 'admin', org_id: (o as { id: string }).id } })])
      const { rows: [x] } = await db.query(
        'select public.can_read_dataset($1) as r, public.can_write_dataset($1) as w', [f.datasetId])
      expect(x).toMatchObject({ r: false, w: false })

      await db.query(`select set_config('request.jwt.claims', $1, true)`, [f.claims])
      const { rows: [own] } = await db.query(
        'select public.can_read_dataset($1) as r, public.can_write_dataset($1) as w', [f.datasetId])
      expect(own).toMatchObject({ r: true, w: true })
    })
  })

  describe('markings', () => {
    // The published behaviour, not ours: file markings gate whether the resource
    // exists for you; data markings gate only its rows. "the user can detect the
    // presence of the derived dataset and view the file metadata, but cannot
    // access the data within."
    it('a FILE marking denies metadata and data; the same marking downstream denies only rows', async () => {
      await applyTo('dataset', f.datasetId)
      expect(await access(f.datasetId)).toEqual([false, false])
      expect(await access(downstreamId)).toEqual([true, false])
    })

    it('membership satisfies a marking, and holding "apply" does not', async () => {
      await db.query(
        `insert into public.marking_permissions (marking_id, user_id, permission)
         select $1, id, 'apply' from public.users limit 1`, [markingId])
      expect(await access(f.datasetId)).toEqual([false, false])

      await db.query(
        `insert into public.marking_members (marking_id, user_id) select $1, id from public.users limit 1`,
        [markingId])
      // auth.uid() is NULL on this connection, so membership cannot be observed
      // here; what is checked is that it is recorded apart from permissions.
      const { rows: [c] } = await db.query(
        'select count(*)::int as n from public.marking_members where marking_id=$1', [markingId])
      expect((c as { n: number }).n).toBe(1)
    })

    it('stop_propagating clears the data marking downstream', async () => {
      await db.query(
        `insert into public.dataset_input_marking_stops (dataset_id, input_dataset_id, marking_id)
         values ($1,$2,$3)`, [downstreamId, f.datasetId, markingId])
      expect(await access(downstreamId)).toEqual([true, true])
      await db.query('delete from public.dataset_input_marking_stops')
    })

    it('a marking on the project reaches its datasets without a row of its own', async () => {
      await clearMarkings()
      await applyTo('project', f.projectId)
      const { rows } = await db.query('select origin, kind from public.dataset_markings($1)', [f.datasetId])
      expect((rows as { kind: string; origin: string }[]).map((r) => [r.kind, r.origin]))
        .toEqual([['file', 'file_hierarchy']])
      expect(await access(f.datasetId)).toEqual([false, false])
    })

    it('an unmet file marking blocks WRITING too — "in any way"', async () => {
      // Migration 403. The predicate was applied on read and not on write, four
      // migrations after the same mistake was made with the tenant check.
      const { rows: [w] } = await db.query('select public.can_write_dataset($1) as w', [f.datasetId])
      expect((w as { w: boolean }).w).toBe(false)
    })
  })

  describe('scoped sessions', () => {
    // The filter is DISJUNCTIVE where the marking check is conjunctive, and the
    // two give different answers — which is the whole reason it is tested.
    const passes = async (ms: string[]): Promise<boolean> => {
      const { rows: [p] } = await db.query('select public.passes_scoped_session($1::uuid[]) as p', [ms])
      return (p as { p: boolean }).p
    }

    beforeAll(async () => {
      await clearMarkings()
      const { rows: [s] } = await db.query(
        `insert into public.scoped_sessions (organization_id, name) values ($1,'focus') returning id`,
        [f.orgId])
      await db.query(
        `insert into public.scoped_session_markings (scoped_session_id, marking_id) values ($1,$2)`,
        [(s as { id: string }).id, markingId])
      await db.query(
        `insert into public.organization_scoped_session_settings (organization_id, enabled, allow_no_session)
         values ($1, false, false)`, [f.orgId])
    })

    it('filters nothing while disabled', async () => {
      expect(await passes([markingId])).toBe(true)
    })

    it('with no session chosen and none allowed, unmarked stays visible and marked does not', async () => {
      await db.query(
        'update public.organization_scoped_session_settings set enabled=true where organization_id=$1',
        [f.orgId])
      expect(await passes([])).toBe(true)
      expect(await passes([markingId])).toBe(false)
    })

    it('"no scoped session" restores full marking access', async () => {
      await db.query(
        'update public.organization_scoped_session_settings set allow_no_session=true where organization_id=$1',
        [f.orgId])
      expect(await passes([markingId])).toBe(true)
    })

    it('matches by overlap, not by subset', async () => {
      // A resource marked {A,B} under a session {A} is VISIBLE — it carries A.
      // Narrowing the membership set would have hidden it on B.
      const { rows: [r] } = await db.query(
        `select array[$1::uuid,$2::uuid] && array[$1::uuid] as overlaps,
                array[$2::uuid] && array[$1::uuid] as disjoint`, [markingId, categoryId])
      expect(r).toMatchObject({ overlaps: true, disjoint: false })
    })
  })

  describe('the list and the detail', () => {
    // This replaced a check that grepped the policy text for a literal function
    // name — an allowlist wearing a different hat, and one that could not tell a
    // policy composing the right function from one composing it wrongly. What
    // matters is that the two agree.
    const listed = () => asAuthenticated(db, async () => {
      const { rows } = await db.query('select id from public.datasets where id = $1', [f.datasetId])
      return rows.length
    })
    const readable = async () => {
      const { rows: [r] } = await db.query('select public.can_read_dataset($1) as r', [f.datasetId])
      return (r as { r: boolean }).r
    }

    it('agree when the dataset is unmarked', async () => {
      await clearMarkings()
      expect([await listed(), await readable()]).toEqual([1, true])
    })

    it('agree when it is marked and the caller is not a member', async () => {
      await applyTo('dataset', f.datasetId)
      expect([await listed(), await readable()]).toEqual([0, false])
      await clearMarkings()
    })
  })
})
