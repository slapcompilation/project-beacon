// No policy helper runs once per row.
//
// Supabase's guidance and the reason:
//   "calling functions directly in RLS policies can impact database
//    performance, as the function is evaluated for each row when the policy
//    is checked" (substrate-reference/mirror/api/securing-your-api.md)
//
// Measured here on 200,000 rows, because `(select f())` becomes an InitPlan
// the planner evaluates once per QUERY: 1590ms → 88ms for a scalar helper
// (18x), and 4563ms → 96ms for an array one (47x, worse because it builds an
// array per row).
//
// 504 and 505 wrapped every call site. Applied migrations run once, so they
// cannot catch the next policy someone writes — this can. It carries no
// exception list on purpose: the moment one is needed, the rule has decayed.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

// Zero-argument STABLE helpers. Not project_role(project_id) or
// resource_file_access(kind, id, org) — those read the row and must run per row.
const HELPERS = [
  'auth_org_id', 'auth_role', 'auth_org_ids', 'auth_group_ids',
  'auth_marking_ids', 'auth_group_names', 'auth_org_marking_ids',
]

describe.skipIf(noDb)('policy helpers are InitPlans', () => {
  let db: pg.Client

  const one = async (sql: string) =>
    (await db.query(sql)).rows[0] as Record<string, string>

  beforeAll(async () => { db = await connect() })
  afterAll(async () => { await rollback(db) })

  // The precondition that makes wrapping legal rather than clever: STABLE
  // guarantees one consistent value per statement, and zero arguments means
  // there is nothing row-dependent to capture.
  it('every wrapped helper is STABLE and takes no arguments', async () => {
    const { rows } = await db.query(
      `select f.name from unnest($1::text[]) f(name)
         left join pg_proc p
           on p.proname = f.name and p.pronamespace = 'public'::regnamespace
        where p.oid is null or p.provolatile <> 's' or p.pronargs <> 0
        order by 1`, [HELPERS])
    expect(rows.map((r) => (r as { name: string }).name)).toEqual([])
  })

  it('no policy calls a helper per row', async () => {
    // Postgres renders the wrapped form as "( SELECT auth_org_id() AS
    // auth_org_id)", which contains the bare text — strip those, then any
    // remaining call is a real one.
    const { rows } = await db.query(
      `select pol.tablename || '.' || pol.policyname || ' → ' || f.name as site
         from pg_policies pol, unnest($1::text[]) f(name)
        where pol.schemaname = 'public'
          and regexp_replace(coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, ''),
                             '\\( SELECT ' || f.name || '\\(\\)[^)]*\\)', '', 'g')
              ~ ('\\m' || f.name || '\\(\\)')
        order by 1`, [HELPERS])
    expect(rows.map((r) => (r as { site: string }).site)).toEqual([])
  })

  // Supabase names this one directly: "You can use `(select auth.uid())`
  // instead of `auth.uid()` to improve performance".
  it('no policy calls auth.uid() per row', async () => {
    const { rows } = await db.query(
      `select tablename || '.' || policyname as site
         from pg_policies
        where schemaname = 'public'
          and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
                             '\\( SELECT auth\\.uid\\(\\)[^)]*\\)', '', 'g')
              like '%auth.uid()%'
        order by 1`)
    expect(rows.map((r) => (r as { site: string }).site)).toEqual([])
  })

  // 619. A FOR ALL policy is evaluated on SELECT too, and RLS is permissive-OR
  // with no order guarantee, so a cheap read predicate does not save you from
  // an expensive write one sitting beside it. Measured as `authenticated`:
  // count(*) over dataset_branches 66.1ms -> 4.7ms, ontology_violations()
  // 150.5ms -> 57ms, once the write half stopped running on every SELECT.
  //
  // Scoped to the tables the linter walks, because that is where it was
  // measured — a blanket rule against FOR ALL would be a claim this suite has
  // not earned.
  it('a SELECT on the dataset tables does not evaluate a write predicate', async () => {
    const { rows } = await db.query(
      `select tablename || '.' || policyname as site
         from pg_policies
        where schemaname = 'public'
          and tablename in ('dataset_branches','dataset_transactions','dataset_schemas')
          and cmd = 'ALL'
        order by 1`)
    expect(rows.map((r) => (r as { site: string }).site)).toEqual([])
  })

  // The premise that made 619 safe rather than a narrowing: can_write_dataset
  // is can_read_dataset AND more, so `read OR write` was always just `read`.
  // If someone rewrites it without that conjunct, the split becomes a real
  // change to who can see what, and this is where they find out.
  it('write implies read, which is why the write half could leave the SELECT path', async () => {
    const { def } = await one(
      `select pg_get_functiondef('public.can_write_dataset(uuid)'::regprocedure) as def`)
    expect(def).toContain('can_read_dataset')
  })

  // The shape 505 had to write by hand, asserted so it is not "simplified"
  // back into the subquery form of ANY, which compares uuid against uuid[].
  it('array helpers are wrapped inside a scalar position, never as ANY(subquery)', async () => {
    const { rows } = await db.query(
      `select tablename || '.' || policyname as site
         from pg_policies
        where schemaname = 'public'
          and coalesce(qual, '') || ' ' || coalesce(with_check, '')
              ~ 'ANY \\(\\( SELECT auth_(org_ids|group_ids|marking_ids|org_marking_ids)'
        order by 1`)
    expect(rows.map((r) => (r as { site: string }).site)).toEqual([])
  })
})
