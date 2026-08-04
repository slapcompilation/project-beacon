// Every file in the web app must be reachable from the entry point.
//
// Five guards police the database — tables, functions, CHECK values, module
// references, RPC names, edge syntax. NONE of them looks at apps/web, and that
// gap has a measured cost: a cleanup on 2026-08-02 deleted ReportsPage and left
// its ELEVEN section components behind, plus FinancePage whose route had become
// a redirect. 2,503 lines survived a sweep whose entire purpose was to find
// them, and nothing noticed for two days.
//
// WHY THE OBVIOUS VERSION DOES NOT WORK, learned by getting it wrong twice in
// one sitting:
//
//   grep for the component name    -> said TrendCell was dead. ChainPage uses it.
//   grep for the route             -> says most panels are dead. They are not
//                                     routes; they are lazy imports inside a
//                                     workspace.
//   grep with the name as written  -> said GLExportPage was dead. I had typed
//                                     GlExport. Casing.
//
// So this builds the actual IMPORT GRAPH and walks it from `main.tsx`. A file is
// alive if you can reach it by following imports from the thing the browser
// loads — which is the only definition that means anything.
//
//   node scripts/check-surfaces.mjs
//
// TESTS DO NOT COUNT AS REACHABLE, the same rule check-vocabulary learned: a
// test importing a component proves the test compiles, not that the product
// uses it. Tests are excluded from the graph and never reported as dead.
//
// The escape hatch is a marker in the first three lines, like
// `@vocabulary-declaration`:
//
//   // @surface-orphan-ok — why this exists without a caller

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'

const ROOT  = 'apps/web/src'
const ENTRY = join(ROOT, 'main.tsx')
const EXT   = ['.ts', '.tsx', '.js', '.jsx']

/** Not product code: type declarations, tests, and the entry itself. */
const isTest = (p) => /\.(test|spec)\.[jt]sx?$/.test(p) || `${sep}__tests__${sep}`.includes(sep) && p.includes(`${sep}__tests__${sep}`)
const isDecl = (p) => p.endsWith('.d.ts')

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out) }
    else if (EXT.some((x) => e.name.endsWith(x))) out.push(p)
  }
  return out
}

const all = walk(ROOT)
const source = new Map(all.map((f) => [f, readFileSync(f, 'utf8')]))

/** Every import specifier in a file: static, `export ... from`, and dynamic
 *  `import('...')` — the last one is how every workspace panel is loaded, and
 *  missing it would report half the app as dead. */
function specifiers(src) {
  const out = []
  // `from '...'` unanchored, deliberately. The first version required `import`
  // and `from` on ONE LINE, and this codebase wraps them across several — which
  // missed ChainPage's import of TrendCell and reported TrendCell as dead.
  // Matching every `from` clause covers static imports, re-exports and type-only
  // imports without caring how the statement is formatted.
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) for (const m of src.matchAll(re)) out.push(m[1])
  return out
}

/** Resolve a specifier to a file in the tree, or null when it leaves it
 *  (a package, a stylesheet, a virtual module). `@/` is the app's own alias. */
function resolveSpec(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else return null

  const rel = relative(process.cwd(), base)
  const candidates = [
    rel,
    ...EXT.map((x) => rel + x),
    ...EXT.map((x) => join(rel, 'index' + x)),
  ]
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

// ── Walk from the entry point ────────────────────────────────────────────────

if (!existsSync(ENTRY)) {
  console.error(`check:surfaces — no entry point at ${ENTRY}`)
  process.exit(2)
}

const reachable = new Set()
const queue = [ENTRY]
while (queue.length > 0) {
  const file = queue.pop()
  if (reachable.has(file)) continue
  reachable.add(file)
  const src = source.get(file) ?? (existsSync(file) ? readFileSync(file, 'utf8') : '')
  for (const spec of specifiers(src)) {
    const target = resolveSpec(spec, file)
    // A test reached from product code would be a bug in its own right, but it
    // must not make the test's other imports look alive.
    if (target && !reachable.has(target) && !isTest(target)) queue.push(target)
  }
}

const exempt = new Map()
const dead = []
for (const f of all) {
  if (reachable.has(f) || isTest(f) || isDecl(f)) continue
  const head = (source.get(f) ?? '').split('\n', 3).join('\n')
  const marker = /@surface-orphan-ok\s*—?\s*(.*)/.exec(head)
  if (marker) { exempt.set(f, marker[1].trim()); continue }
  dead.push(f)
}

// A declaration for a file that is now reachable is stale — same staleness check
// the vocabulary guard runs, for the same reason.
const staleExemptions = [...exempt.keys()].filter((f) => reachable.has(f))

const scanned = all.filter((f) => !isTest(f) && !isDecl(f)).length

if (dead.length === 0 && staleExemptions.length === 0) {
  const note = exempt.size > 0 ? ` · ${exempt.size} declared orphan(s)` : ''
  console.log(`surfaces OK — ${reachable.size} of ${scanned} file(s) reachable from main.tsx${note}`)
  process.exit(0)
}

if (dead.length > 0) {
  console.error(`\n✗ ${dead.length} file(s) nothing can reach from main.tsx:\n`)
  for (const f of dead) console.error(`    ${f}`)
  console.error(`
  A component the browser cannot reach still gets read, maintained and copied
  from. Delete it, wire it up, or say why it stays:

    // @surface-orphan-ok — <why this exists without a caller>

  in the first three lines of the file.`)
}

if (staleExemptions.length > 0) {
  console.error(`\n✗ ${staleExemptions.length} declared orphan(s) that ARE reachable now — drop the marker:\n`)
  for (const f of staleExemptions) console.error(`    ${f}`)
}

process.exit(1)
