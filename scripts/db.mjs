// Run .sql files against the linked project — the local half of db-contracts.yml.
//
// Migrations used to be applied by hand through the Supabase MCP, which meant
// three tables ended up with cascading provenance FKs that no migration file
// records (see invariant 4). Same connection string CI uses.
//
//   node scripts/db.mjs supabase/migrations/231_provenance_fks_set_null.sql
//   node scripts/db.mjs --contracts        # the three guards, in CI's order
//
// Reads SUPABASE_DB_URL from the environment or .env.local.

import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const CONTRACTS = [
  'supabase/tests/security_invariants.sql',
  'supabase/tests/rls_contracts.sql',
  'supabase/tests/ontology_drift.sql',
]

function connectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL
  const envFile = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      if (line.startsWith('SUPABASE_DB_URL=')) return line.slice('SUPABASE_DB_URL='.length).trim()
    }
  }
  return null
}

const args = process.argv.slice(2)
const files = args[0] === '--contracts' ? CONTRACTS : args
if (files.length === 0) {
  console.error('usage: node scripts/db.mjs <file.sql>... | --contracts')
  process.exit(2)
}

const url = connectionString()
if (!url) {
  console.error('SUPABASE_DB_URL not set (env or .env.local). See scripts/db.mjs header.')
  process.exit(2)
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

// psql prints RAISE NOTICE; the guards say what passed through it, so relay them.
client.on('notice', (n) => { console.log(`  ${n.message ?? n}`) })

let failed = false
for (const file of files) {
  console.log(`── ${file}`)
  try {
    await client.query(fs.readFileSync(file, 'utf8'))
    console.log('   ok')
  } catch (err) {
    failed = true
    console.error(`   FAILED: ${err.message}`)
    break  // ON_ERROR_STOP=1, same as CI
  }
}

await client.end()
process.exit(failed ? 1 : 0)
