// Dry-run a migration file inside BEGIN/ROLLBACK against the live database:
// the probe pattern self-rolls-back, DDL is transactional, and nothing lands.
// Usage: node scripts/dry-run.mjs supabase/migrations/NNN_x.sql
import fs from 'node:fs'
import pg from 'pg'
import { connectionString, SSL } from './db-url.mjs'
const file = process.argv[2]
const sql = fs.readFileSync(file, 'utf8')
const client = new pg.Client({ connectionString: connectionString(), ssl: SSL })
await client.connect()
client.on('notice', (n) => console.log('NOTICE:', n.message))
try {
  await client.query('BEGIN')
  await client.query(sql)
  await client.query('ROLLBACK')
  console.log('DRY RUN OK — rolled back')
} catch (e) {
  try { await client.query('ROLLBACK') } catch {}
  console.error('DRY RUN FAILED:', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
