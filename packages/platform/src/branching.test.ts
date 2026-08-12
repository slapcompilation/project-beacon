// The branch overlay, as regression tests rather than migration assertions.
//
// 461 asserts this once, at the moment it landed — applied migrations are
// immutable and run once. Re-asked on every CI run: a branch save validates
// like a main save and touches nothing, the merge applies the overlay through
// the same arms, and a promotion rides the merge on an ontology owner's
// approval.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused } from './harness'

describe.skipIf(noDb)('the branch overlay', () => {
  let db: pg.Client
  let org: string
  let ont: string
  let ds: string
  let dsBranch: string
  let u1: string
  let u2: string

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>
  const count = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await db.query(sql, p)).rows[0].n)
  const asUser = (id: string) =>
    db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: id, app_metadata: { role: 'admin', org_id: org } })])

  const addUser = async (email: string): Promise<string> => {
    const id = (await db.query('select gen_random_uuid() as id')).rows[0].id as string
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`,
      [id, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1, $2, 'admin', $3)`, [id, email, org])
    return id
  }

  beforeAll(async () => {
    db = await connect()
    org = (await one(`insert into public.organizations (name) values ('branch-regress') returning id`)).id
    u1 = await addUser(`branch1-${Date.now()}@beacon.test`)
    u2 = await addUser(`branch2-${Date.now()}@beacon.test`)
    await asUser(u1)
    await db.query('set local role authenticated')

    const space = (await one(`select public.create_space('Branch regress') as id`)).id
    ont = (await one(`insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
                      values ($1,'branchregress','Branch regress',false) returning id`, [space])).id
    const proj = (await one(`insert into public.projects (organization_id, space_id, api_name, name)
                             values ($1,$2,'branchr','BranchR') returning id`, [org, space])).id
    ds = (await one(`insert into public.datasets (organization_id, project_id, api_name, name)
                     values ($1,$2,'branchds','branchds') returning id`, [org, proj])).id
    dsBranch = (await one(`insert into public.dataset_branches (dataset_id, name)
                           values ($1,'master') returning id`, [ds])).id
  })
  afterAll(async () => { await rollback(db) })

  it('runs the whole flow: overlay save, proposal, approval, merge', async () => {
    const b = (await one(`insert into public.ontology_branches (ontology_id, name, title)
                          values ($1,'flow','Flow') returning id`, [ont])).id
    const t = (await one('select gen_random_uuid() as id')).id

    // An invalid overlay refuses the save with the main save's own error.
    await db.query(`select public.stage_change('object_type', $1, $2::jsonb, $3, 'created')`,
      [t, JSON.stringify({ api_name: 'FlowA', label: 'A', ontology_id: ont }), b])
    expect(await refused(db, () => db.query('select public.save_working_state($1)', [b])))
      .toContain('SaveBlockedByErrors')
    expect(await count('select count(*) n from public.object_types where id = $1', [t])).toBe(0)

    // A valid one saves onto the branch and never touches main.
    await db.query(`select public.stage_change('object_type', $1, $2::jsonb, $3, 'created')`,
      [t, JSON.stringify({
        api_name: 'FlowA', label: 'A', ontology_id: ont,
        datasources: [{ dataset_id: ds, branch_id: dsBranch }],
        properties: [{
          property_id: 'a_id', display_name: 'A Id', api_name: 'aId',
          base_type: 'string', source: 'column', backing_column: 'a_id',
          is_primary_key: true, is_title_key: true, required: true,
        }],
      }), b])
    await db.query('select public.save_working_state($1)', [b])
    expect(await count('select count(*) n from public.object_types where id = $1', [t])).toBe(0)
    expect(await count(
      'select count(*) n from public.branch_resource_changes where branch_id = $1', [b])).toBe(1)

    // Approval by the second user, then the merge applies the overlay.
    const pr = (await one(`select public.create_proposal($1, 'Flow', '') as id`, [b])).id
    const tk = (await one(`select id from public.proposal_tasks where proposal_id = $1`, [pr])).id
    await asUser(u2)
    await db.query(`insert into public.proposal_reviews (task_id, user_id, decision)
                    values ($1,$2,'approved')`, [tk, u2])
    await asUser(u1)
    await db.query('select public.merge_proposal($1)', [pr])
    expect(await count(
      `select count(*) n from public.object_types where id = $1 and api_name = 'FlowA'`, [t])).toBe(1)
    expect((await one('select status from public.ontology_branches where id = $1', [b])).status)
      .toBe('merged')
  })

  it('refuses the merge while approval is missing, by the check name', async () => {
    // 462 auto-approves an unprotected change the proposer could make
    // directly, so only a PROTECTED resource still waits for review here.
    const proj = (await one(`insert into public.projects (organization_id, space_id, api_name, name)
                             values ($1,(select space_id from public.ontologies where id = $2),'unappr','Unapproved') returning id`,
      [org, ont])).id
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3)`, [proj, u1, org])
    const t = (await one(`insert into public.object_types (ontology_id, project_id, api_name, label, status)
                          values ($1,$2,'FlowB','B','active') returning id`, [ont, proj])).id
    await db.query(`update public.object_types set protected = true where id = $1`, [t])
    const b = (await one(`insert into public.ontology_branches (ontology_id, name, title)
                          values ($1,'unapproved','Unapproved') returning id`, [ont])).id
    await db.query(`select public.stage_change('object_type', $1, $2::jsonb, $3, 'modified')`,
      [t, JSON.stringify({ label: 'B renamed' }), b])
    await db.query('select public.save_working_state($1)', [b])
    const pr = (await one(`select public.create_proposal($1, 'Unapproved', '') as id`, [b])).id
    expect(await refused(db, () => db.query('select public.merge_proposal($1)', [pr])))
      .toContain('The check "Changes are approved" fails')
  })

  it('lets a promotion ride the merge on an ontology owner approval', async () => {
    const t = (await one(`insert into public.object_types (ontology_id, api_name, label, status)
                          values ($1,'FlowC','C','active') returning id`, [ont])).id
    await db.query(`insert into public.ontology_role_grants (ontology_id, user_id, role)
                    values ($1,$2,'owner')`, [ont, u2])
    const b = (await one(`insert into public.ontology_branches (ontology_id, name, title)
                          values ($1,'promote','Promote') returning id`, [ont])).id
    await db.query(`select public.stage_change('object_type', $1, $2::jsonb, $3, 'modified')`,
      [t, JSON.stringify({ status: 'promoted' }), b])
    await db.query('select public.save_working_state($1)', [b])
    expect((await one('select status from public.object_types where id = $1', [t])).status)
      .toBe('active')

    const pr = (await one(`select public.create_proposal($1, 'Promote', '') as id`, [b])).id
    const tk = (await one(`select id from public.proposal_tasks where proposal_id = $1`, [pr])).id
    await asUser(u2)
    await db.query(`insert into public.proposal_reviews (task_id, user_id, decision)
                    values ($1,$2,'approved')`, [tk, u2])
    await asUser(u1)
    await db.query('select public.merge_proposal($1)', [pr])
    const row = await one('select status, visibility from public.object_types where id = $1', [t])
    expect(row.status).toBe('promoted')
    expect(row.visibility).toBe('prominent')
  })

  // ── 462: protection makes main read-only ───────────────────────────────────
  it('protects a placed resource: main refuses, the approved branch route lands', async () => {
    const proj = (await one(`insert into public.projects (organization_id, space_id, api_name, name)
                             values ($1,(select space_id from public.ontologies where id = $2),'guarded','Guarded') returning id`,
      [org, ont])).id
    await db.query(`insert into public.project_role_grants (project_id, user_id, role, organization_id)
                    values ($1,$2,'owner',$3), ($1,$4,'viewer',$3)`, [proj, u1, org, u2])
    const t = (await one(`insert into public.object_types (ontology_id, project_id, api_name, label, status)
                          values ($1,$2,'Guarded','Guarded','active') returning id`, [ont, proj])).id
    await db.query(`update public.object_types set protected = true where id = $1`, [t])

    expect(await refused(db, () =>
      db.query(`update public.object_types set label = 'direct' where id = $1`, [t])))
      .toContain('Branching:ResourceIsProtected')

    const b = (await one(`insert into public.ontology_branches (ontology_id, name, title)
                          values ($1,'guarded','Guarded') returning id`, [ont])).id
    await db.query(`select public.stage_change('object_type', $1, $2::jsonb, $3, 'modified')`,
      [t, JSON.stringify({ label: 'via branch' }), b])
    await db.query('select public.save_working_state($1)', [b])
    const pr = (await one(`select public.create_proposal($1, 'Guarded', '') as id`, [b])).id
    const tk = (await one(`select id, auto_approved from public.proposal_tasks where proposal_id = $1`, [pr]))
    expect((tk as unknown as { auto_approved: boolean }).auto_approved).toBe(false)
    await asUser(u2)
    await db.query(`insert into public.proposal_reviews (task_id, user_id, decision)
                    values ($1,$2,'approved')`, [tk.id, u2])
    await asUser(u1)
    await db.query('select public.merge_proposal($1)', [pr])
    expect((await one('select label from public.object_types where id = $1', [t])).label)
      .toBe('via branch')
  })

  it('auto-approves an unprotected change the proposer could make directly', async () => {
    const t = (await one(`insert into public.object_types (ontology_id, api_name, label, status)
                          values ($1,'AutoOk','Auto','active') returning id`, [ont])).id
    const b = (await one(`insert into public.ontology_branches (ontology_id, name, title)
                          values ($1,'auto-ok','Auto ok') returning id`, [ont])).id
    await db.query(`select public.stage_change('object_type', $1, $2::jsonb, $3, 'modified')`,
      [t, JSON.stringify({ label: 'auto merged' }), b])
    await db.query('select public.save_working_state($1)', [b])
    const pr = (await one(`select public.create_proposal($1, 'Auto ok', '') as id`, [b])).id
    await db.query('select public.merge_proposal($1)', [pr])
    expect((await one('select label from public.object_types where id = $1', [t])).label)
      .toBe('auto merged')
  })

  it('refuses a save onto a non-active branch', async () => {
    const b = (await one(`insert into public.ontology_branches (ontology_id, name, title, status)
                          values ($1,'sleepy','Sleepy','archived') returning id`, [ont])).id
    expect(await refused(db, () => db.query('select public.save_working_state($1)', [b])))
      .toContain('Branching:BranchNotActive')
  })
})
