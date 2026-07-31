// Every RPC name the app or an edge function calls must exist in the database.
//
// Written after occupancy ingestion was found dead: both ingest-occupancy and
// mews-webhook call ingest_occupancy_webhook, migration 064 is RECORDED as
// applied and declares it, and the function is not in the database. A missing
// RPC is invisible to the type system — the name is a string handed to
// PostgREST — so nothing failed until somebody sent a webhook.
//
//   node scripts/check-rpcs.mjs

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { connectionString, SSL } from './db-url.mjs'

const ROOTS = ['apps/web/src', 'supabase/functions', 'packages']
const RPC   = /\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g

const callers = new Map()
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'dist') walk(p)
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      const src = readFileSync(p, 'utf8')
      for (const m of src.matchAll(RPC)) {
        if (!callers.has(m[1])) callers.set(m[1], new Set())
        callers.get(m[1]).add(p.replaceAll('\\', '/'))
      }
    }
  }
}
for (const r of ROOTS) { try { walk(r) } catch { /* absent root is fine */ } }

const names = [...callers.keys()].sort()
if (names.length === 0) {
  console.error('check-rpcs: found no .rpc() calls at all — the matcher is probably broken')
  process.exit(1)
}

// Dormant without the secret, like every other DB-touching job here — a fork
// should not fail on a credential it was never given.
const url = connectionString()
if (!url) {
  console.log('check-rpcs: no SUPABASE_DB_URL — skipping')
  process.exit(0)
}

const client = new pg.Client({ connectionString: url, ssl: SSL })
await client.connect()
const { rows } = await client.query(
  `select distinct p.proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any($1)`,
  [names],
)
await client.end()

const present = new Set(rows.map((r) => r.proname))
const missing = names.filter((n) => !present.has(n))

console.log(`${names.length} RPC names called · ${present.size} present`)
if (missing.length > 0) {
  console.error(`\n${missing.length} CALLED BUT MISSING:`)
  for (const n of missing) {
    console.error(`  ${n}`)
    for (const f of callers.get(n)) console.error(`      ${f}`)
  }
  process.exit(1)
}
console.log('every called RPC exists')
