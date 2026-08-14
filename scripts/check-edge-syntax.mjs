// Parse every edge function, and prove every file it ships is reachable.
//
// turbo's type-check covers the TS packages but NOT supabase/functions — those
// are Deno, resolved at deploy time. This guard existed until the teardown
// deleted it, correctly at the time: supabase/functions was empty. It is back
// because function-run is not.
//
//   pnpm check:edge
//
// TWO failure modes, both of which have reached production here.
//
// §1 SYNTAX. A broken string literal passed CI and failed the deploy with
// "failed to create the graph". esbuild parses the same syntax Deno does, and
// without --bundle it never resolves npm:/jsr: imports.
//
// §2 REACHABILITY, which is the one that cost a day. The deploy bundler
// uploads what index.ts statically imports and nothing else. function-run's
// first deploy referenced its worker by runtime URL, so the file sat in the
// repo, passed every check, and did not exist on the server. A file that
// nothing imports is not "unused" here — it is a deploy that will fail at the
// moment it is called.

import { readdirSync, existsSync, readFileSync, rmSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = 'supabase/functions'
const slash = (p) => p.replace(/\\/g, '/')

const fns = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => join(ROOT, d.name))
  .filter((d) => existsSync(join(d, 'index.ts')))

if (fns.length === 0) {
  console.error(`no edge functions found — is the path still ${ROOT}/?`)
  process.exit(1)
}

// ── §1 does it parse ────────────────────────────────────────────────────────
// Every .ts in the directory, not just the entry: a helper module is deployed
// and run, so a syntax error in it breaks the same way.
const files = fns.flatMap((d) =>
  readdirSync(d).filter((f) => f.endsWith('.ts')).map((f) => slash(join(d, f))))

const out = mkdtempSync(join(tmpdir(), 'edge-parse-'))
const run = spawnSync(
  'pnpm',
  ['dlx', 'esbuild@0.25.12', ...files, '--outdir=' + out, '--log-level=error'],
  { encoding: 'utf8', shell: process.platform === 'win32' },
)
rmSync(out, { recursive: true, force: true })

if (run.status !== 0) {
  console.error(`${run.stdout ?? ''}${run.stderr ?? ''}`.trim())
  console.error('\nedge syntax check FAILED — this is what breaks the deploy, not CI')
  process.exit(1)
}

// ── §2 does the deploy carry it ─────────────────────────────────────────────
/** Relative imports only — npm:, jsr: and https: are resolved by Deno, not us. */
const importsOf = (file) => [...readFileSync(file, 'utf8')
  .matchAll(/(?:from|import)\s*['"](\.[^'"]+)['"]/g)]
  .map((m) => slash(resolve(dirname(file), m[1])))

const orphans = []
for (const dir of fns) {
  const entry = slash(join(dir, 'index.ts'))
  const seen = new Set([entry])
  const queue = [entry]
  while (queue.length > 0) {
    for (const target of importsOf(queue.pop())) {
      const hit = [target, `${target}.ts`].find((p) => existsSync(p))
      if (hit !== undefined && !seen.has(slash(hit))) { seen.add(slash(hit)); queue.push(hit) }
    }
  }
  const here = readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => slash(join(dir, f)))
  orphans.push(...here.filter((f) => !seen.has(slash(resolve(f)))).filter((f) => !seen.has(f)))
}

if (orphans.length > 0) {
  console.error('these files are NOT statically imported, so the deploy will not upload them:\n')
  for (const o of orphans) console.error(`  ${o}`)
  console.error('\nimport it from index.ts, or delete it — a runtime-only reference deploys empty')
  process.exit(1)
}

console.log(`${String(fns.length)} edge functions parse · ${String(files.length)} files, all reachable`)
