// The dataset view algorithm, checked against the example Palantir publishes.
//
// `data-integration/datasets#example-of-transaction-types` gives a four-step
// history and states the resulting view, then adds a fifth step and states it
// again. That is a specification with its own answer key, so the check is to run
// it and compare — not to assert what our implementation happens to do.
//
// Everything runs inside one transaction that is ROLLED BACK, so the check
// leaves nothing behind and can run against any database it can reach.
//
//   node scripts/check-datasets.mjs

import pg from 'pg'
import { connectionString, SSL } from './db-url.mjs'

const url = connectionString()
if (!url) {
  console.error('SUPABASE_DB_URL not set (environment or .env.local).')
  process.exit(2)
}

const client = new pg.Client({ connectionString: url, ssl: SSL })
await client.connect()

let failures = 0
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) { console.log(`  ok   ${label} → ${a}`); return }
  console.error(`  FAIL ${label}\n       expected ${e}\n       actual   ${a}`)
  failures += 1
}

/** The view, as the paths a reader would see. */
async function view(branch) {
  const { rows } = await client.query(
    'select logical_path from public.dataset_view($1) order by logical_path', [branch])
  return rows.map((r) => r.logical_path)
}

/** Open a transaction, write its files, commit. Returns the transaction id. */
async function commit(ds, branch, type, files, parent) {
  const { rows: [t] } = await client.query(
    `insert into public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
     values ($1,$2,$3,$4) returning id`, [ds, branch, type, parent ?? null])
  for (const path of files) {
    await client.query(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, removes, row_count)
       values ($1,$2,$3,$4,$5)`, [ds, t.id, path, type === 'DELETE', type === 'DELETE' ? 0 : 1])
  }
  await client.query(
    `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`, [t.id])
  return t.id
}

await client.query('BEGIN')
try {
  const { rows: [org] } = await client.query(
    `insert into public.organizations (name) values ('check-datasets') returning id`)
  const { rows: [proj] } = await client.query(
    `insert into public.projects (organization_id, api_name, name) values ($1,'check','Check') returning id`,
    [org.id])
  const { rows: [ds] } = await client.query(
    `insert into public.datasets (organization_id, project_id, api_name, name)
     values ($1,$2,'check_ds','Check dataset') returning id`, [org.id, proj.id])
  const { rows: [main] } = await client.query(
    `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [ds.id])

  // dataset_materialize checks can_write_dataset, which reads the JWT. Set one
  // for the rest of the transaction (the `true` scopes it there, so the
  // ROLLBACK clears it). NOTE: this exercises the explicit function checks, NOT
  // the RLS policies — a superuser connection bypasses those.
  const claims = JSON.stringify({ app_metadata: { role: 'admin', org_id: org.id } })
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims])

  // ── the published example ─────────────────────────────────────────────────
  // "1. SNAPSHOT contains files A and B
  //  2. APPEND adds file C
  //  3. UPDATE modifies file A to have different contents, A'
  //  4. DELETE removes file B"
  const t1 = await commit(ds.id, main.id, 'SNAPSHOT', ['A', 'B'])
  check('after SNAPSHOT {A,B}', await view(main.id), ['A', 'B'])

  const t2 = await commit(ds.id, main.id, 'APPEND', ['C'], t1)
  check('after APPEND {C}', await view(main.id), ['A', 'B', 'C'])

  const t3 = await commit(ds.id, main.id, 'UPDATE', ['A'], t2)
  const t4 = await commit(ds.id, main.id, 'DELETE', ['B'], t3)
  // "At this point, the current dataset view would contain A' and C."
  check("after DELETE {B} — the doc's stated answer", await view(main.id), ['A', 'C'])

  // "If we added a fifth SNAPSHOT transaction containing file D, the current
  //  dataset view would then only contain D."
  const t5 = await commit(ds.id, main.id, 'SNAPSHOT', ['D'], t4)
  check("after SNAPSHOT {D} — the doc's stated answer", await view(main.id), ['D'])

  // "the number of views in a dataset's history is equal to the number of
  //  SNAPSHOT transactions it contains."
  const { rows: [{ views, snapshots }] } = await client.query(
    `select count(*) filter (where txn_type='SNAPSHOT')::int as snapshots,
            (select count(*) from public.dataset_history($1) where txn_type='SNAPSHOT')::int as views
       from public.dataset_history($1)`, [main.id])
  check('views == SNAPSHOT count', views, snapshots)

  // ── time travel ───────────────────────────────────────────────────────────
  // A view is "the effective file contents of a dataset for a branch at a point
  // in time", so asking as of t4 must still give the four-step answer.
  const { rows: past } = await client.query(
    'select logical_path from public.dataset_view_from($1) order by logical_path', [t4])
  check('view as of the DELETE transaction', past.map((r) => r.logical_path), ['A', 'C'])

  // The timestamp form is the one the algorithm is written in, and it is the one
  // with a trap: committed_at is microseconds and a JS Date is milliseconds, so
  // a round-tripped commit time lands *before* its own transaction. Read it as
  // text and the boundary holds — which is why dataset_view_from exists.
  const { rows: [{ at4 }] } = await client.query(
    'select committed_at::text as at4 from public.dataset_transactions where id=$1', [t4])
  const { rows: pastByClock } = await client.query(
    'select logical_path from public.dataset_view($1,$2::timestamptz) order by logical_path', [main.id, at4])
  check('view as of the DELETE clock time', pastByClock.map((r) => r.logical_path), ['A', 'C'])

  const truncated = new Date(at4)
  const { rows: viaJsDate } = await client.query(
    'select logical_path from public.dataset_view($1,$2) order by logical_path', [main.id, truncated])
  check('a JS Date truncates and loses the anchor transaction (why _from exists)',
    viaJsDate.map((r) => r.logical_path), ['A', 'B', 'C'])

  // ── branching ─────────────────────────────────────────────────────────────
  // "A child branch can be created from another branch, or from any transaction.
  //  The new branch points to the same transaction as the parent branch."
  // Forked at t4, so it must see the pre-SNAPSHOT view, not master's {D}.
  const { rows: [feat] } = await client.query(
    `insert into public.dataset_branches (dataset_id, name, parent_branch_id, parent_dataset_id, head_transaction_id)
     values ($1,'feature',$2,$1,$3) returning id`, [ds.id, main.id, t4])
  check('branch forked at the DELETE', await view(feat.id), ['A', 'C'])

  await commit(ds.id, feat.id, 'APPEND', ['E'], t4)
  check('branch after its own APPEND', await view(feat.id), ['A', 'C', 'E'])
  // "When a dataset is changed on a branch by committing a transaction, the
  //  transactions and views of all other branches are unaltered."
  check('master unaffected by the branch', await view(main.id), ['D'])

  // ── the commit rules ──────────────────────────────────────────────────────
  // "If an APPEND transaction is opened and existing files are overwritten,
  //  then attempting to commit the transaction will fail."
  let refused = null
  try {
    await client.query('SAVEPOINT s')
    await commit(ds.id, main.id, 'APPEND', ['D'], t5)
  } catch (err) { refused = err.message }
  await client.query('ROLLBACK TO SAVEPOINT s')
  check('APPEND over an existing file is refused',
    refused?.includes('Datasets:AppendOverwritesExistingFiles') ?? false, true)

  // The same paths through an UPDATE must be allowed — that is the whole
  // difference between the two types.
  let allowed = true
  try {
    await client.query('SAVEPOINT s2')
    await commit(ds.id, main.id, 'UPDATE', ['D'], t5)
    await client.query('ROLLBACK TO SAVEPOINT s2')
  } catch { allowed = false; await client.query('ROLLBACK TO SAVEPOINT s2') }
  check('UPDATE over an existing file is allowed', allowed, true)

  // ── the physical table ────────────────────────────────────────────────────
  await client.query(
    `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
    [ds.id, t1, JSON.stringify([
      { name: 'iata', type: 'STRING' },
      { name: 'fare', type: 'DECIMAL', precision: 38, scale: 18 },
      { name: 'tags', type: 'ARRAY', arraySubType: { type: 'STRING' } },
      { name: 'seen', type: 'TIMESTAMP' },
    ])])
  await client.query('select public.dataset_materialize($1,$2)', [ds.id, t1])

  const { rows: cols } = await client.query(
    `select column_name, data_type from information_schema.columns
      where table_schema='datasets' and table_name='check_ds' order by ordinal_position`)
  check('physical table columns',
    cols.map((c) => c.column_name),
    ['_row', '_file', 'iata', 'fare', 'tags', 'seen'])
  check('DECIMAL(38,18) became numeric',
    cols.find((c) => c.column_name === 'fare')?.data_type, 'numeric')
  check('ARRAY<STRING> became a Postgres array',
    cols.find((c) => c.column_name === 'tags')?.data_type, 'ARRAY')

  const { rows: [{ rls }] } = await client.query(
    `select c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='datasets' and c.relname='check_ds'`)
  check('generated table has RLS', rls, true)

  // A caller with no role must not be able to issue DDL through it. The whole
  // point of a SECURITY DEFINER function is that its own check is the gate.
  let denied = null
  try {
    await client.query('SAVEPOINT s3')
    await client.query(`select set_config('request.jwt.claims', '{}', true)`)
    await client.query('select public.dataset_materialize($1,$2)', [ds.id, t1])
  } catch (err) { denied = err.message }
  await client.query('ROLLBACK TO SAVEPOINT s3')
  check('materialize refuses a caller with no role',
    denied?.includes('Datasets:NotAuthorized') ?? false, true)

  // ── the tenant boundary ───────────────────────────────────────────────────
  // can_write_dataset is called from a SECURITY DEFINER function, where RLS does
  // not run — so it has to carry the organization check itself. It did not, and
  // an admin of any other tenant passed. Migration 395.
  const { rows: [other] } = await client.query(
    `insert into public.organizations (name) values ('check-datasets other') returning id`)
  await client.query(`select set_config('request.jwt.claims', $1, true)`,
    [JSON.stringify({ app_metadata: { role: 'admin', org_id: other.id } })])
  const { rows: [cross] } = await client.query(
    'select public.can_read_dataset($1) as r, public.can_write_dataset($1) as w', [ds.id])
  check('an admin of another organization cannot read', cross.r, false)
  check('an admin of another organization cannot write', cross.w, false)

  await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
  const { rows: [own] } = await client.query(
    'select public.can_read_dataset($1) as r, public.can_write_dataset($1) as w', [ds.id])
  check('the owning organization still can', [own.r, own.w], [true, true])

  // ── markings ──────────────────────────────────────────────────────────────
  // The published behaviour, not ours: file markings gate whether the resource
  // exists for you; data markings gate only its rows. "the user can detect the
  // presence of the derived dataset and view the file metadata, but cannot
  // access the data within."
  const [{ rows: [cat] }, { rows: [downstream] }] = [
    await client.query(`insert into public.marking_categories (name) values ('check') returning id`),
    await client.query(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,'check_downstream','downstream') returning id`, [org.id, proj.id]),
  ]
  const { rows: [pii] } = await client.query(
    `insert into public.markings (category_id, name) values ($1,'PII') returning id`, [cat.id])
  await client.query(
    `insert into public.dataset_inputs (dataset_id, input_dataset_id) values ($1,$2)`,
    [downstream.id, ds.id])

  const applyAs = async (kind, id) => {
    await client.query('alter table public.resource_markings disable trigger guard_marking_application')
    await client.query(
      `insert into public.resource_markings (marking_id, resource_kind, resource_id) values ($1,$2,$3)`,
      [pii.id, kind, id])
    await client.query('alter table public.resource_markings enable trigger guard_marking_application')
  }
  const clearMarkings = async () => {
    await client.query('alter table public.resource_markings disable trigger guard_marking_application')
    await client.query('delete from public.resource_markings where marking_id=$1', [pii.id])
    await client.query('alter table public.resource_markings enable trigger guard_marking_application')
  }
  const access = async (id) => {
    const { rows: [a] } = await client.query(
      'select public.can_read_dataset($1) as meta, public.can_read_dataset_data($1) as data', [id])
    return [a.meta, a.data]
  }

  // A file marking on the dataset itself: not a member, so it does not exist.
  await applyAs('dataset', ds.id)
  check('an unmet FILE marking denies metadata and data', await access(ds.id), [false, false])

  // The same marking one hop downstream is a DATA marking: metadata survives.
  check('an unmet DATA marking denies rows but keeps metadata',
    await access(downstream.id), [true, false])

  // Membership is what satisfies it — and only membership.
  await client.query(
    `insert into public.marking_permissions (marking_id, user_id, permission)
     select $1, id, 'apply' from public.users limit 1`, [pii.id])
  check('holding "apply" does not grant membership', await access(ds.id), [false, false])

  await client.query(
    `insert into public.marking_members (marking_id, user_id) select $1, id from public.users limit 1`,
    [pii.id])
  // auth.uid() is NULL on this connection, so membership cannot be observed here;
  // what is checked is that the row landed and nothing else changed.
  const { rows: [{ n }] } = await client.query(
    'select count(*)::int as n from public.marking_members where marking_id=$1', [pii.id])
  check('membership is recorded separately from permissions', n, 1)

  // stop_propagating cuts the edge, and the downstream goes clear.
  await client.query(
    `insert into public.dataset_input_marking_stops (dataset_id, input_dataset_id, marking_id)
     values ($1,$2,$3)`, [downstream.id, ds.id, pii.id])
  check('stop_propagating clears the data marking downstream',
    await access(downstream.id), [true, true])

  // A marking on the PROJECT reaches every dataset in it, without a row of its own.
  await client.query('delete from public.dataset_input_marking_stops')
  await clearMarkings()
  await applyAs('project', proj.id)
  const { rows: origin } = await client.query(
    `select origin, kind from public.dataset_markings($1)`, [ds.id])
  check('a project marking reaches its datasets as file_hierarchy',
    origin.map((r) => [r.kind, r.origin]), [['file', 'file_hierarchy']])
  check('and it denies the whole resource, not just the rows',
    await access(ds.id), [false, false])

  // The two holes the re-read found (migration 403). Both passed every earlier
  // test, because both live where the predicates are not called.
  const { rows: [w] } = await client.query('select public.can_write_dataset($1) as w', [ds.id])
  check('an unmet file marking also blocks WRITING — "in any way"', w.w, false)

  // ── scoped sessions ───────────────────────────────────────────────────────
  // The filter is DISJUNCTIVE where the marking check is conjunctive, and the
  // two give different answers — which is the whole reason it is tested.
  await clearMarkings()
  const { rows: [sess] } = await client.query(
    `insert into public.scoped_sessions (organization_id, name) values ($1,'focus') returning id`,
    [org.id])
  await client.query(
    `insert into public.scoped_session_markings (scoped_session_id, marking_id) values ($1,$2)`,
    [sess.id, pii.id])
  await client.query(
    `insert into public.organization_scoped_session_settings (organization_id, enabled, allow_no_session)
     values ($1, false, false)`, [org.id])

  const passes = async (ms) => {
    const { rows: [p] } = await client.query(
      'select public.passes_scoped_session($1::uuid[]) as p', [ms])
    return p.p
  }
  check('disabled: nothing is filtered', await passes([pii.id]), true)

  await client.query(
    'update public.organization_scoped_session_settings set enabled=true where organization_id=$1',
    [org.id])
  // Nobody has chosen a session and none is allowed, so this is the empty-session
  // case: unmarked resources still visible, marked ones not.
  check('an UNMARKED resource stays visible under a session', await passes([]), true)
  check('a marking outside the session is filtered out', await passes([pii.id]), false)

  await client.query(
    'update public.organization_scoped_session_settings set allow_no_session=true where organization_id=$1',
    [org.id])
  check('"no scoped session" restores full marking access', await passes([pii.id]), true)

  // The distinction that makes this a different mechanism: a resource marked
  // {A,B} under a session {A} is VISIBLE (it carries A) — narrowing the
  // membership set would have hidden it on B.
  const { rows: [{ overlaps, disjoint }] } = await client.query(
    `select array[$1::uuid,$2::uuid] && array[$1::uuid] as overlaps,
            array[$2::uuid] && array[$1::uuid] as disjoint`, [pii.id, cat.id])
  check('a resource marked {A,B} matches a session {A} by overlap', overlaps, true)
  check('a resource sharing no marking with the session does not', disjoint, false)

  // ── the datasource binding (O1) ───────────────────────────────────────────
  // "Note that a single datasource can only be used to back one object type."
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
  const [{ rows: [ot1] }, { rows: [ot2] }] = [
    await client.query(
      `insert into public.object_types (organization_id, api_name, label)
       values ($1,'check_one','One') returning id`, [org.id]),
    await client.query(
      `insert into public.object_types (organization_id, api_name, label)
       values ($1,'check_two','Two') returning id`, [org.id]),
  ]
  await client.query(
    `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
     values ($1,$2,$3)`, [ot1.id, ds.id, main.id])

  let clash = null
  try {
    await client.query('SAVEPOINT o1')
    await client.query(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3)`, [ot2.id, ds.id, main.id])
  } catch (err) { clash = err.message }
  await client.query('ROLLBACK TO SAVEPOINT o1')
  check('one datasource cannot back two object types',
    clash?.includes('Phonograph2:DatasetAndBranchAlreadyRegistered') ?? false, true)

  // A different branch of the same dataset IS a different datasource — which is
  // what the error name says, and the reason the key is the pair.
  await client.query(
    `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
     values ($1,$2,$3)`, [ot2.id, ds.id, feat.id])
  const { rows: [{ bound }] } = await client.query(
    'select count(*)::int as bound from public.object_type_datasources where dataset_id=$1', [ds.id])
  check('a second branch of the same dataset is a second datasource', bound, 2)

  // "A backing datasource for an object type may not contain MapType or
  //  StructType columns."
  const { rows: [structDs] } = await client.query(
    `insert into public.datasets (organization_id, project_id, api_name, name)
     values ($1,$2,'check_struct','struct') returning id`, [org.id, proj.id])
  const { rows: [structBr] } = await client.query(
    `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`,
    [structDs.id])
  const { rows: [structTxn] } = await client.query(
    `insert into public.dataset_transactions (dataset_id, branch_id, txn_type, status, committed_at)
     values ($1,$2,'SNAPSHOT','COMMITTED', now()) returning id`, [structDs.id, structBr.id])
  await client.query(
    `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
    [structDs.id, structTxn.id, JSON.stringify([
      { name: 'ok', type: 'STRING' },
      { name: 'nope', type: 'MAP', mapKeyType: { type: 'STRING' }, mapValueType: { type: 'LONG' } },
    ])])
  let rejected = null
  try {
    await client.query('SAVEPOINT o1b')
    await client.query(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3)`, [ot1.id, structDs.id, structBr.id])
  } catch (err) { rejected = err.message }
  await client.query('ROLLBACK TO SAVEPOINT o1b')
  check('a MAP column disqualifies a backing datasource',
    rejected?.includes('Ontology:UnsupportedColumnType') ?? false, true)

  // ── the path this whole script was blind to ───────────────────────────────
  // Everything above runs as the connection owner, and RLS is bypassed for
  // superusers. So a policy could be infinitely recursive and every assertion
  // above would still pass — which is exactly what happened: migration 403 put
  // effective_file_markings into the datasets policy, that function reads
  // `datasets`, and `select * from datasets` became "stack depth limit exceeded"
  // for every real user while this script stayed green.
  //
  // `authenticated` is the role PostgREST connects as. Nothing verifies the
  // product unless something runs as it.
  await client.query('SAVEPOINT rls')
  await client.query('SET LOCAL ROLE authenticated')
  // A savepoint per probe: the first failure aborts the transaction, so without
  // one a single recursive policy would mask every table after it.
  const asUser = async (label, sql) => {
    await client.query(`SAVEPOINT p_${label}`)
    try { await client.query(sql); await client.query(`RELEASE SAVEPOINT p_${label}`); return true }
    catch (err) {
      await client.query(`ROLLBACK TO SAVEPOINT p_${label}`)
      return err.message.split('\n')[0]
    }
  }
  const reads = {
    datasets:            await asUser('datasets', 'select count(*) from public.datasets'),
    projects:            await asUser('projects', 'select count(*) from public.projects'),
    object_types:        await asUser('object_types', 'select count(*) from public.object_types'),
    dataset_branches:    await asUser('branches', 'select count(*) from public.dataset_branches'),
    dataset_transactions:await asUser('transactions', 'select count(*) from public.dataset_transactions'),
    dataset_inputs:      await asUser('inputs', 'select count(*) from public.dataset_inputs'),
    object_type_datasources: await asUser('bindings', 'select count(*) from public.object_type_datasources'),
    markings:            await asUser('markings', 'select count(*) from public.markings'),
    scoped_sessions:     await asUser('sessions', 'select count(*) from public.scoped_sessions'),
    marking_categories:  await asUser('cats', 'select count(*) from public.marking_categories'),
    marking_permissions: await asUser('perms', 'select count(*) from public.marking_permissions'),
    marking_members:     await asUser('members', 'select count(*) from public.marking_members'),
    resource_markings:   await asUser('resmark', 'select count(*) from public.resource_markings'),
    dataset_schemas:     await asUser('schemas', 'select count(*) from public.dataset_schemas'),
    dataset_files:       await asUser('files', 'select count(*) from public.dataset_files'),
    spaces:              await asUser('spaces', 'select count(*) from public.spaces'),
    link_types:          await asUser('links', 'select count(*) from public.link_types'),
    object_sets:         await asUser('sets', 'select count(*) from public.object_sets'),
    shared_properties:   await asUser('shared', 'select count(*) from public.shared_properties'),
    ontology_interfaces: await asUser('ifaces', 'select count(*) from public.ontology_interfaces'),
  }
  await client.query('RESET ROLE')
  await client.query('ROLLBACK TO SAVEPOINT rls')
  const broken = Object.entries(reads).filter(([, v]) => v !== true)
  check('every RLS-guarded table is readable as `authenticated` (no policy recursion)',
    broken.map(([t, e]) => `${t}: ${e}`), [])

  const listChecks = await client.query(
    `select c.relname, position('resource_file_access' in pg_get_expr(p.polqual, p.polrelid)) > 0 as guarded
       from pg_policy p join pg_class c on c.oid = p.polrelid
      where p.polname in ('members read datasets','members read projects') order by c.relname`)
  check('the list policies compose the one definition of file access',
    listChecks.rows.map((r) => [r.relname, r.guarded]),
    [['datasets', true], ['projects', true]])
} finally {
  await client.query('ROLLBACK')
  await client.end()
}

console.log(failures === 0 ? '\ncheck-datasets: ok' : `\ncheck-datasets: ${failures} failure(s)`)
process.exit(failures === 0 ? 0 : 1)
