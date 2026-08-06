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
} finally {
  await client.query('ROLLBACK')
  await client.end()
}

console.log(failures === 0 ? '\ncheck-datasets: ok' : `\ncheck-datasets: ${failures} failure(s)`)
process.exit(failures === 0 ? 0 : 1)
