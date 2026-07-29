// Run .sql files against the linked project — the local half of db-contracts.yml.
//
// This is the ONLY path that should apply a migration. Applying by hand through
// the Supabase MCP is what let 16 schema changes exist in the database with no
// file in the repo, and three tables keep cascading provenance FKs nothing
// recorded. Anything under supabase/migrations/ is registered in
// supabase_migrations.schema_migrations here, so repo and remote stay in step.
//
//   node scripts/db.mjs supabase/migrations/231_provenance_fks_set_null.sql
//   node scripts/db.mjs --contracts        # the three guards, in CI's order
//   node scripts/db.mjs --status           # repo files vs recorded history
//
// Note the Supabase CLI cannot drive these files: it derives a version from the
// leading digits, and 111a/111b/111c would all collide on 111. That is why the
// GitHub integration's "deploy to production" is off — our numbering is ours.
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

/** Version + name the way the file names them. Returns null for non-migrations. */
function migrationId(file) {
  const m = /^(\d{3}[a-z]?)_(.+)\.sql$/.exec(path.basename(file))
  return m && file.replace(/\\/g, '/').includes('supabase/migrations/')
    ? { version: m[1], name: m[2] }
    : null
}

const args = process.argv.slice(2)
const files = args[0] === '--contracts' ? CONTRACTS : args
if (files.length === 0) {
  console.error('usage: node scripts/db.mjs <file.sql>... | --contracts | --status')
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

if (args[0] === '--status') {
  const onDisk = fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
  const { rows } = await client.query('select version from supabase_migrations.schema_migrations')
  const applied = new Set(rows.map((r) => r.version))
  const pending = onDisk.filter((f) => { const id = migrationId(`supabase/migrations/${f}`); return id && !applied.has(id.version) })
  const unknown = [...applied].filter((v) => !onDisk.some((f) => migrationId(`supabase/migrations/${f}`)?.version === v))
  console.log(`files ${onDisk.length} · recorded ${applied.size}`)
  console.log(pending.length ? `pending:\n  ${pending.join('\n  ')}` : 'pending: none')
  console.log(unknown.length ? `recorded with no file:\n  ${unknown.join('\n  ')}` : 'recorded with no file: none')
  await client.end()
  process.exit(pending.length || unknown.length ? 1 : 0)
}

let failed = false
for (const file of files) {
  console.log(`── ${file}`)
  try {
    await client.query(fs.readFileSync(file, 'utf8'))
    const id = migrationId(file)
    if (id) {
      await client.query(
        'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict (version) do nothing',
        [id.version, id.name],
      )
      console.log(`   ok — recorded ${id.version}`)
    } else {
      console.log('   ok')
    }
  } catch (err) {
    failed = true
    console.error(`   FAILED: ${err.message}`)
    break  // ON_ERROR_STOP=1, same as CI
  }
}

await client.end()
process.exit(failed ? 1 : 0)
