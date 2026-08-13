// The Check access panel and Test policy, re-asked on every CI run.
//
// Migration 486 asserts this once at landing. The durable questions: the
// panel's two halves match checking-permissions.md (organization + markings +
// "Having one or more roles (directly, via a group, or a default role)" over
// lineage-inherited markings), the role clause names the granting group, Test
// policy answers through the real compiled predicate, and the claims swap
// never leaks.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('the access checker', () => {
  let db: pg.Client
  let f: Fixture
  let admin = ''
  let member = ''
  let rv = ''
  let marking = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  const claims = async (sub: string, role: string) =>
    db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub, app_metadata: { role, org_id: f.orgId } })])

  const clause = async (like: string) =>
    (await db.query(
      `select requirement, detail, satisfied from public.check_access('dataset', $1, $2) c
        where c.requirement like $3`,
      [f.datasetId, member, like])).rows[0] as { requirement: string; detail: string; satisfied: boolean }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'checka486')
    for (const key of ['admin', 'member'] as const) {
      const id = (await one('select gen_random_uuid() as id')).id
      await db.query(
        `insert into auth.users (id, instance_id, aud, role, email)
         values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
        [id, `checka-${key}-${Date.now()}@beacon.test`])
      await db.query(
        `insert into public.users (id, email, role, organization_id) values ($1,$2,'admin',$3)`,
        [id, `checka-${key}-${Date.now()}@beacon.test`, f.orgId])
      if (key === 'admin') admin = id; else member = id
    }
    await claims(admin, 'admin')
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, admin, f.orgId])

    // The member's role arrives only via a group.
    const grp = (await one(
      `insert into public.groups (organization_id, name, created_by)
       values ($1,'Access Leads 486',$2) returning id`, [f.orgId, admin])).id
    await db.query(`insert into public.group_members (group_id, member_user_id) values ($1,$2)`, [grp, member])
    await db.query(
      `insert into public.project_role_grants (project_id, group_id, role, organization_id)
       values ($1,$2,'viewer',$3)`, [f.projectId, grp, f.orgId])

    // A lineage marking the member does not hold.
    const cat = (await one(
      `insert into public.marking_categories (name, category_type, organization_id)
       values ('CheckA486','conjunctive',$1) returning id`, [f.orgId])).id
    marking = (await one(
      `insert into public.markings (category_id, name) values ($1,'Access PII 486') returning id`, [cat])).id
    const upstream = (await one(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'checka486_raw','raw') returning id`, [f.orgId, f.projectId])).id
    await db.query(`insert into public.dataset_inputs (dataset_id, input_dataset_id) values ($1,$2)`,
      [f.datasetId, upstream])
    await db.query(`insert into public.marking_permissions (marking_id, user_id, permission)
                    values ($1,$2,'apply')`, [marking, admin])
    await db.query(`insert into public.resource_markings (marking_id, resource_kind, resource_id)
                    values ($1,'dataset',$2)`, [marking, upstream])

    // A dataset with rows, for Test policy.
    const txn = (await one(
      `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
       values ($1,$2,'SNAPSHOT') returning id`, [f.datasetId, f.branchId])).id
    await db.query(
      `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
      [f.datasetId, txn, JSON.stringify([
        { name: 'row_id', type: 'STRING' }, { name: 'holder_id', type: 'STRING' }])])
    const file = (await one(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
       values ($1,$2,'rows.parquet',3) returning id`, [f.datasetId, txn])).id
    await db.query(
      `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [txn])
    const tbl = (await one('select public.dataset_materialize($1,$2) as t', [f.datasetId, txn])).t
    await db.query(
      `insert into datasets.${tbl} (_file, row_id, holder_id) values
        ($1,'R1',$2), ($1,'R2',$3), ($1,'R3',$3)`, [file, admin, member])
    rv = (await one(
      `insert into public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
       values ($1,$2,'checka_rv486','Rows by holder',
         '{"match":"all","rules":[{"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"holder_id"}}]}')
       returning id`, [f.projectId, f.datasetId])).id
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('the role clause names the granting group', async () => {
    const c = await clause('Having one or more roles%')
    expect(c.satisfied).toBe(true)
    expect(c.detail).toContain('via Access Leads 486')
  })

  it('the organization clause is its own verdict', async () => {
    const c = await clause('Organization')
    expect(c.satisfied).toBe(true)
  })

  it('a lineage marking fails until membership, then flips', async () => {
    let c = await clause('Marking through lineage%')
    expect(c.satisfied).toBe(false)
    await db.query(`insert into public.marking_members (marking_id, user_id) values ($1,$2)`,
      [marking, member])
    c = await clause('Marking through lineage%')
    expect(c.satisfied).toBe(true)
  })

  it('membership granted to a group satisfies the clause too (489)', async () => {
    // Re-grant through the group instead: "If Marking permissions are granted
    // to a group, then a new user to the group will inherit those permissions."
    await db.query(`delete from public.marking_members where marking_id=$1 and user_id=$2`,
      [marking, member])
    let c = await clause('Marking through lineage%')
    expect(c.satisfied).toBe(false)
    const grp = (await one(`select g.id from public.groups g where g.name='Access Leads 486'`)).id
    await db.query(`insert into public.marking_members (marking_id, group_id) values ($1,$2)`,
      [marking, grp])
    c = await clause('Marking through lineage%')
    expect(c.satisfied).toBe(true)
  })

  it('Test policy answers per named user through the real predicate', async () => {
    const r = (await db.query('select * from public.test_restricted_view($1,$2)', [rv, member]))
      .rows[0] as { visible_rows: string; total_rows: string }
    expect(Number(r.visible_rows)).toBe(2)
    expect(Number(r.total_rows)).toBe(3)
    const caller = await one(`select current_setting('request.jwt.claims', true)::jsonb->>'sub' as sub`)
    expect(caller.sub).toBe(admin)
  })

  it('checking someone else takes standing', async () => {
    await claims(member, 'limited_access')
    const err = await refused(db, () =>
      db.query(`select * from public.check_access('dataset',$1,$2)`, [f.datasetId, admin]))
    expect(err).toContain('Compass:InsufficientPermissions')
    await claims(admin, 'admin')
  })
})
