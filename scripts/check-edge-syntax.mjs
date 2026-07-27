// Parse every edge function so a syntax error fails CI instead of the deploy.
//
// turbo's type-check covers the TS packages but NOT supabase/functions — those
// are Deno, resolved at deploy time. That gap let a broken string literal reach
// the production deploy ("failed to create the graph"). esbuild parses the same
// syntax Deno does, and without --bundle it never resolves npm:/jsr: imports.

import { readdirSync, existsSync, rmSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = 'supabase/functions'
const entries = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => join(ROOT, d.name, 'index.ts').replace(/\\/g, '/'))
  .filter((f) => existsSync(f))

if (entries.length === 0) {
  console.error('no edge functions found — is the path still supabase/functions/?')
  process.exit(1)
}

const out = mkdtempSync(join(tmpdir(), 'edge-parse-'))
const run = spawnSync(
  'pnpm',
  ['dlx', 'esbuild@0.25.12', ...entries, '--outdir=' + out, '--log-level=error'],
  { encoding: 'utf8', shell: process.platform === 'win32' },
)
rmSync(out, { recursive: true, force: true })

if (run.status !== 0) {
  console.error(`${run.stdout ?? ''}${run.stderr ?? ''}`.trim())
  console.error(`\nedge syntax check FAILED — this is what breaks the deploy, not CI`)
  process.exit(1)
}
console.log(`${String(entries.length)} edge functions parse`)
