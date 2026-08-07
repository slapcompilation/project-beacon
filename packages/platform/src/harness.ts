// Connecting, and the fixture every suite builds on.
//
// Each suite opens one transaction and rolls it back, so a run leaves nothing
// behind and can point at any database it can reach — including the real one.

import pg from 'pg'
import { connectionString, SSL } from '../../../scripts/db-url.mjs'

export const DB_URL = connectionString()

/** No credential, no run: a fork should not fail on a secret it never had.
 *  Used as `describe.skipIf(noDb)`. */
export const noDb = !DB_URL

export async function connect(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: DB_URL as string, ssl: SSL })
  await client.connect()
  await client.query('BEGIN')
  return client
}

export async function rollback(client: pg.Client): Promise<void> {
  await client.query('ROLLBACK')
  await client.end()
}

/** Run something that is expected to fail, without poisoning the transaction. */
export async function refused(client: pg.Client, fn: () => Promise<unknown>): Promise<string | null> {
  await client.query('SAVEPOINT probe')
  try {
    await fn()
    await client.query('ROLLBACK TO SAVEPOINT probe')
    return null
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT probe')
    return err instanceof Error ? err.message : String(err)
  }
}

/** Read something as the role PostgREST connects as, then step back out. */
export async function asAuthenticated<T>(client: pg.Client, fn: () => Promise<T>): Promise<T> {
  await client.query('SAVEPOINT role_probe')
  await client.query('SET LOCAL ROLE authenticated')
  try {
    return await fn()
  } finally {
    await client.query('RESET ROLE')
    await client.query('ROLLBACK TO SAVEPOINT role_probe')
  }
}

export interface Fixture {
  orgId: string
  projectId: string
  datasetId: string
  branchId: string
  claims: string
}

/** An organization, a project, a dataset and its master branch — plus a JWT for
 *  the explicit function checks, which read the claim rather than the role. */
export async function fixture(client: pg.Client, slug: string): Promise<Fixture> {
  const one = async (sql: string, params: unknown[] = []) => {
    const { rows } = await client.query(sql, params)
    return rows[0] as Record<string, string>
  }
  const org = await one(
    `insert into public.organizations (name) values ($1) returning id`, [slug])
  const proj = await one(
    `insert into public.projects (organization_id, api_name, name) values ($1,$2,$2) returning id`,
    [org.id, slug])
  const ds = await one(
    `insert into public.datasets (organization_id, project_id, api_name, name)
     values ($1,$2,$3,$3) returning id`, [org.id, proj.id, `${slug}_ds`])
  const branch = await one(
    `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`, [ds.id])

  const claims = JSON.stringify({ app_metadata: { role: 'admin', org_id: org.id } })
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims])

  return { orgId: org.id, projectId: proj.id, datasetId: ds.id, branchId: branch.id, claims }
}

/** The view, as the paths a reader would see. */
export async function view(client: pg.Client, branch: string): Promise<string[]> {
  const { rows } = await client.query(
    'select logical_path from public.dataset_view($1) order by logical_path', [branch])
  return (rows as { logical_path: string }[]).map((r) => r.logical_path)
}

/** Open a transaction, write its files, commit. Returns the transaction id. */
export async function commit(
  client: pg.Client, ds: string, branch: string, type: string, files: string[], parent?: string,
): Promise<string> {
  const { rows } = await client.query(
    `insert into public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
     values ($1,$2,$3,$4) returning id`, [ds, branch, type, parent ?? null])
  const id = (rows[0] as { id: string }).id
  for (const path of files) {
    await client.query(
      `insert into public.dataset_files (dataset_id, transaction_id, logical_path, removes, row_count)
       values ($1,$2,$3,$4,$5)`, [ds, id, path, type === 'DELETE', type === 'DELETE' ? 0 : 1])
  }
  await client.query(
    `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp() where id=$1`,
    [id])
  return id
}
