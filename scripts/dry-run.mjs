// Dry-run a migration file inside BEGIN/ROLLBACK against the live database:
// the probe pattern self-rolls-back, DDL is transactional, and nothing lands.
// Usage: node scripts/dry-run.mjs supabase/migrations/NNN_x.sql [NNN+1_y.sql …]
// Several files run in ONE transaction, in the order given — which is how a
// migration that builds on the one before it gets dry-run before either lands.
import fs from 'node:fs'
import pg from 'pg'
import { connectionString, SSL } from './db-url.mjs'
const files = process.argv.slice(2)
const client = new pg.Client({ connectionString: connectionString(), ssl: SSL })
await client.connect()
client.on('notice', (n) => console.log('NOTICE:', n.message))
try {
  await client.query('BEGIN')
  for (const file of files) {
    await client.query(fs.readFileSync(file, 'utf8'))
    if (files.length > 1) console.log('  ok —', file)
  }
  await client.query('ROLLBACK')
  console.log('DRY RUN OK — rolled back')
} catch (e) {
  try { await client.query('ROLLBACK') } catch {}
  console.error('DRY RUN FAILED:', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
