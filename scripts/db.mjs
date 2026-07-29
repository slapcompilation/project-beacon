// The one path that applies SQL to the linked project.
//
// Applying by hand through the Supabase MCP is what let 16 schema changes exist
// in the database with no file in the repo, and three tables keep cascading
// provenance FKs nothing recorded. Everything under supabase/migrations/ is
// registered in supabase_migrations.schema_migrations here, with its SQL, so
// repo and remote cannot silently diverge again.
//
//   pnpm db supabase/migrations/231_foo.sql   apply specific files
//   pnpm db:status                            pending / orphaned / modified
//   pnpm db:migrate                           apply everything pending, in order
//   pnpm db:contracts                         the three guards, in CI's order
//   pnpm db:baseline                          record SQL for already-applied files
//
// Forward-only: there are no down migrations. A mistake is corrected by a new
// migration, the same rule StockLogs follow.
//
// The Supabase CLI cannot drive these files — it derives a version from the
// leading digits, so 111a/111b/111c would all collide on 111. That is why the
// GitHub integration's "deploy to production" is off.
//
// Reads SUPABASE_DB_URL from the environment or .env.local.

import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const MIGRATIONS = 'supabase/migrations'
const CONTRACTS = [
  'supabase/tests/security_invariants.sql',
  'supabase/tests/rls_contracts.sql',
  'supabase/tests/ontology_drift.sql',
]
// Two runners must never apply concurrently — CI on merge and someone local.
const LOCK_KEY = 4021763

function connectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL
  const file = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return null
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('SUPABASE_DB_URL='))
  return line ? line.slice('SUPABASE_DB_URL='.length).trim() : null
}

/** Version + name exactly as the filename gives them. Null for non-migrations. */
function migrationId(file) {
  const m = /^(\d{3}[a-z]?)_(.+)\.sql$/.exec(path.basename(file))
  return m && file.replace(/\\/g, '/').includes(`${MIGRATIONS}/`) ? { version: m[1], name: m[2] } : null
}

const onDisk = () =>
  fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => ({ file: `${MIGRATIONS}/${f}`, ...migrationId(`${MIGRATIONS}/${f}`) }))

const normalize = (sql) => sql.replace(/\r\n/g, '\n').trim()

async function recorded(client) {
  const { rows } = await client.query('select version, name, statements from supabase_migrations.schema_migrations')
  return new Map(rows.map((r) => [r.version, { name: r.name, sql: (r.statements ?? []).join('\n') }]))
}

/** Pending, orphaned (recorded with no file) and modified (file changed after
 *  being applied — the failure every migration tool exists to catch). */
async function survey(client) {
  const files = onDisk()
  const have = await recorded(client)
  const pending = files.filter((f) => f.version && !have.has(f.version))
  const orphaned = [...have.keys()].filter((v) => !files.some((f) => f.version === v))
  const modified = files.filter((f) => {
    const rec = f.version && have.get(f.version)
    return rec && rec.sql && normalize(rec.sql) !== normalize(fs.readFileSync(f.file, 'utf8'))
  })
  return { files, pending, orphaned, modified }
}

/** Files managing their own transaction are run as-is; everything else is
 *  wrapped so the change and its history row land together or not at all. */
async function applyOne(client, file) {
  const sql = fs.readFileSync(file, 'utf8')
  const id = migrationId(file)
  const selfTransacting = /^\s*COMMIT\s*;/mi.test(sql)
  if (!id) { await client.query(sql); return null }

  if (selfTransacting) {
    await client.query(sql)
    await record(client, id, sql)
  } else {
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await record(client, id, sql)
      await client.query('COMMIT')
    } catch (err) { await client.query('ROLLBACK'); throw err }
  }
  return id
}

const record = (client, id, sql) => client.query(
  `insert into supabase_migrations.schema_migrations (version, name, statements)
   values ($1, $2, $3) on conflict (version) do update set statements = excluded.statements`,
  [id.version, id.name, [sql]],
)

// ── entry ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const mode = args[0]?.startsWith('--') ? args[0] : null
if (!mode && args.length === 0) {
  console.error('usage: node scripts/db.mjs <file.sql>... | --status | --migrate | --contracts | --baseline')
  process.exit(2)
}

const url = connectionString()
if (!url) {
  console.error('SUPABASE_DB_URL not set (environment or .env.local). See the header of this file.')
  process.exit(2)
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
try {
  await client.connect()
} catch (err) {
  console.error(`connect failed: ${err.message}`)
  if (/Tenant or user not found/i.test(err.message)) {
    console.error('That pooler host does not serve this project — check the region/fleet in the Connect dialog.')
  }
  process.exit(1)
}
client.on('notice', (n) => { console.log(`  ${n.message ?? n}`) })

// Serialize every writer against every other writer, CI or human.
if (mode !== '--status') await client.query('select pg_advisory_lock($1)', [LOCK_KEY])

let exitCode = 0
try {
  if (mode === '--status' || mode === '--migrate') {
    const { files, pending, orphaned, modified } = await survey(client)
    console.log(`files ${files.length} · recorded ${files.length - pending.length}`)

    if (modified.length > 0) {
      console.error('MODIFIED AFTER APPLYING — these files no longer match what ran:')
      for (const m of modified) console.error(`  ${m.file}`)
      console.error('Applied migrations are immutable. Correct it with a NEW migration.')
      exitCode = 1
    }
    if (orphaned.length > 0) {
      console.error(`recorded with no file: ${orphaned.join(', ')}`)
      exitCode = 1
    }

    if (mode === '--status') {
      // Pending is informational: a PR that adds a migration has not applied it
      // yet, and that is correct. Only modified/orphaned are always wrong.
      console.log(pending.length ? `pending:\n  ${pending.map((p) => p.file).join('\n  ')}` : 'pending: none')
    } else if (exitCode === 0) {
      if (pending.length === 0) console.log('nothing pending')
      for (const p of pending) {
        console.log(`── applying ${p.file}`)
        await applyOne(client, p.file)
        console.log(`   ok — recorded ${p.version}`)
      }
    }
  } else if (mode === '--baseline') {
    // One-time: give already-applied files a checksum baseline so future edits
    // are detectable. Never overwrites SQL that is already recorded.
    const have = await recorded(client)
    let n = 0
    for (const f of onDisk()) {
      if (!f.version || !have.has(f.version) || have.get(f.version).sql) continue
      await record(client, f, fs.readFileSync(f.file, 'utf8'))
      n += 1
    }
    console.log(`baseline recorded for ${n} migration(s)`)
  } else {
    for (const file of mode === '--contracts' ? CONTRACTS : args) {
      console.log(`── ${file}`)
      const id = await applyOne(client, file)
      console.log(id ? `   ok — recorded ${id.version}` : '   ok')
    }
  }
} catch (err) {
  console.error(`FAILED: ${err.message}`)
  exitCode = 1
}

if (mode !== '--status') await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {})
await client.end()
process.exit(exitCode)
