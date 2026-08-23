// The audit-export service, executed: "Both `audit.2` and `audit.3` logs can
// be exported, per-organization, directly into a Foundry dataset"
// (security/audit-logs-overview). 647's probe proved creation, the fill and
// the refusals once at landing; this re-asks those on every run and adds the
// arms the probe could not reach without moving clocks: the start-date
// filter, retention by transaction timestamp, and the trash/move grace hour.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('the audit export dataset', () => {
  let db: pg.Client
  let f: Fixture
  let usr = ''
  let ds = ''
  let phys = ''

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)
  const runExports = async (): Promise<number> => {
    await db.query('set local role beacon_runner')
    const n = Number((await one('select public.run_audit_exports() as n')).n)
    await db.query('reset role')
    return n
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'audexp')
    usr = (await one('select gen_random_uuid() as id')).id
    const email = `audexp-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, email, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [f.projectId, usr, f.orgId])
    ds = (await one(
      `select public.create_audit_export($1,$2,'audexp_logs','Audit logs') as d`,
      [f.orgId, f.projectId])).d
    phys = (await one('select physical_table as t from public.datasets where id=$1', [ds])).t
  }, 60_000)
  afterAll(async () => { await rollback(db) })

  it('fills from attributed lines, and an empty run appends nothing', async () => {
    // the role grant in the fixture is already an attributed line; add one more
    const grp = (await one(
      `insert into public.groups (organization_id, name, group_type)
       values ($1,'Aud exp','internal') returning id`, [f.orgId])).id
    await db.query('insert into public.group_members (group_id, member_user_id) values ($1,$2)',
      [grp, usr])

    expect(await runExports()).toBeGreaterThanOrEqual(2)
    expect(await count(`select count(*) n from datasets.${phys}`)).toBeGreaterThanOrEqual(2)
    // the analyst columns, not ours: camelCase names, a date, the caller
    expect(await count(
      `select count(*) n from datasets.${phys}
        where categories @> array['managementGroups'] and uid = $1 and date = current_date`,
      [usr])).toBeGreaterThanOrEqual(1)

    const txns = await count(
      'select count(*) n from public.dataset_transactions where dataset_id=$1', [ds])
    expect(await runExports()).toBe(0)
    expect(await count(
      'select count(*) n from public.dataset_transactions where dataset_id=$1', [ds])).toBe(txns)
  })

  it('the start date filter excludes what came before it', async () => {
    // "limit this dataset to events that occur on or after a given date"
    const future = (await one(
      `select public.create_audit_export($1,$2,'audexp_future','Future',
              (current_date + 1)::date) as d`, [f.orgId, f.projectId])).d
    await runExports()
    // everything so far happened today, so a tomorrow-dated export stays empty
    // — and empty means no transaction at all, not an empty one
    expect(await count(
      `select count(*) n from public.dataset_transactions
        where dataset_id=$1 and txn_type='APPEND'`, [future])).toBe(0)
  })

  it("retention deletes by the transaction timestamp, never the line's own", async () => {
    await db.query(
      `update public.audit_exports set retention_days = 1 where dataset_id = $1`, [ds])
    // age the appends already made: their transactions committed "3 days ago"
    await db.query(
      `update public.dataset_transactions set committed_at = now() - interval '3 days'
        where dataset_id = $1 and txn_type = 'APPEND'`, [ds])
    const before = await count(`select count(*) n from datasets.${phys}`)
    expect(before).toBeGreaterThan(0)

    // a fresh line makes the next run append, and the same run applies retention
    const grp = (await one(
      `insert into public.groups (organization_id, name, group_type)
       values ($1,'Aud exp 2','internal') returning id`, [f.orgId])).id
    await db.query('insert into public.group_members (group_id, member_user_id) values ($1,$2)',
      [grp, usr])
    expect(await runExports()).toBeGreaterThanOrEqual(1)

    // the aged files are gone — physical rows cascade through _file — and the
    // fresh append survives whole
    expect(await count(`select count(*) n from datasets.${phys}`)).toBe(1)
    expect(await count(
      `select count(*) n from public.dataset_files df
        join public.dataset_transactions t on t.id = df.transaction_id
       where t.dataset_id = $1 and t.committed_at < now() - interval '1 day'`, [ds])).toBe(0)
  })

  it('a displaced dataset pauses, restores in the hour, and an hour displaced halts forever', async () => {
    // trashed: the first run stamps the grace clock and appends nothing
    await db.query('update public.datasets set trashed_at = now() where id = $1', [ds])
    const grp = (await one(
      `insert into public.groups (organization_id, name, group_type)
       values ($1,'Aud exp 3','internal') returning id`, [f.orgId])).id
    await db.query('insert into public.group_members (group_id, member_user_id) values ($1,$2)',
      [grp, usr])
    await runExports()
    expect((await one(
      'select displaced_at from public.audit_exports where dataset_id=$1', [ds])).displaced_at)
      .not.toBeNull()

    // restored within the hour: the clock clears and the append lands
    await db.query('update public.datasets set trashed_at = null where id = $1', [ds])
    expect(await runExports()).toBeGreaterThanOrEqual(1)
    expect((await one(
      'select displaced_at from public.audit_exports where dataset_id=$1', [ds])).displaced_at)
      .toBeNull()

    // an hour displaced: halted, and "there is no way to restart these builds
    // once halted" — restoring the dataset does not help, un-halting refuses
    await db.query('update public.datasets set trashed_at = now() where id = $1', [ds])
    await runExports()
    await db.query(
      `update public.audit_exports set displaced_at = now() - interval '2 hours'
        where dataset_id = $1`, [ds])
    await runExports()
    expect((await one(
      'select halted_at from public.audit_exports where dataset_id=$1', [ds])).halted_at)
      .not.toBeNull()

    await db.query('update public.datasets set trashed_at = null where id = $1', [ds])
    const grp2 = (await one(
      `insert into public.groups (organization_id, name, group_type)
       values ($1,'Aud exp 4','internal') returning id`, [f.orgId])).id
    await db.query('insert into public.group_members (group_id, member_user_id) values ($1,$2)',
      [grp2, usr])
    expect(await runExports()).toBe(0)

    const err = await refused(db, () =>
      db.query('update public.audit_exports set halted_at = null where dataset_id=$1', [ds]))
    expect(err).toContain('AuditExport:CannotRestart')
  })
})
