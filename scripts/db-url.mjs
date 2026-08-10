// One place that answers "how do I connect". Duplicating this is how the
// sslmode fix got applied to db.mjs and then lost again in the generator: pg
// 8.22 maps sslmode=require to verify-full, which rejects Supabase's chain, and
// the secret carries that parameter while .env.local does not.

import fs from 'node:fs'
import path from 'node:path'

export function connectionString() {
  const raw = process.env.SUPABASE_DB_URL ?? readEnvLocal()
  if (!raw) return null
  const url = new URL(raw)
  url.searchParams.delete('sslmode')
  return url.toString()
}

// Walk up from the caller's directory: the migration runner runs at the repo
// root and the platform tests run inside their own package, and both want the
// same file. Finding nothing stays silent — CI has the environment variable and
// no .env.local at all.
function readEnvLocal() {
  let dir = process.cwd()
  for (;;) {
    const file = path.join(dir, '.env.local')
    if (fs.existsSync(file)) {
      const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('SUPABASE_DB_URL='))
      return line ? line.slice('SUPABASE_DB_URL='.length).trim() : null
    }
    const up = path.dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

/** Supabase's chain is not in node's trust store; sslmode=require meant
 *  "encrypted, unverified" and that is what this preserves. */
export const SSL = { rejectUnauthorized: false }
