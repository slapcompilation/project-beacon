// Every value a CHECK constraint allows must be consumed by something.
//
// The database owns the vocabulary here: widget types, effect types, edge types,
// lifecycle states and thirty other lists are CHECK constraints rather than
// conventions. That is deliberate, and it has paid off repeatedly — W1 put
// Foundry's whole variable vocabulary in the constraint ahead of the runtime,
// which later made three phases land with no schema change at all.
//
// It has a cost the shape ratchet cannot see. `audit-shape.mjs` polices tables
// and functions — DATABASE OBJECTS. A value inside a CHECK is not an object, so
// a vocabulary entry that nothing consumes sits there indefinitely looking
// official. Three were found by hand:
//
//   object_set_filter   a variable type the builder OFFERED and nothing read
//   recompute modes     stored, typed, documented, and never honoured
//   object_set_aggregation  in the CHECK since W1 with no runtime
//
// Each read as a working feature. This is the guard for that class.
//
//   node scripts/check-vocabulary.mjs
//
// A VALUE IS CONSUMED IF ANY OF THREE THINGS IS TRUE, and getting this wrong is
// how a guard becomes noise:
//
//   1. CODE     a literal in app, package, edge-function or script source, or
//               inside a database function body or RLS policy — EXCEPT in a file
//               marked `@vocabulary-declaration`, which see below.
//   2. DATA     at least one row actually holds it. `one_to_many` appears in no
//               TypeScript at all and is the stored cardinality of four link
//               types — flagging it would have been a false positive on the
//               first run.
//   3. DECLARED shape_registry says it is deliberately ahead of its runtime,
//               with a reason. That is the honest escape hatch, and like the
//               function exemptions it is checked for staleness: a declaration
//               for a value that IS now consumed is itself reported.
//
// A CONSTANTS FILE IS NOT A CONSUMER. Rule 1 was defeated the first time someone
// leaned on it. Migration 321 added eight values across two new columns and every
// one passed, because `ontology/status.ts` restates the vocabulary in TypeScript
// and rule 1 counts a string literal anywhere. Restating a list is not acting on
// it — `visibility` was written by a form, stored, and read by nothing.
//
// So a file whose head carries `@vocabulary-declaration` is excluded from the
// corpus. Mark the files that MIRROR the database's vocabulary; the values then
// have to earn their keep somewhere that actually branches on them.
//
// WHAT THIS STILL CANNOT SEE, so nobody mistakes green for proof: a column that
// is written and never read. `object_types.visibility` is touched by a trigger
// (which SETS it) and by a form (which SUBMITS it), and both look like use to any
// static scan. Catching that needs read/write discrimination this guard does not
// have. If you add a column, ask what QUERIES it — the guard cannot ask for you.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { connectionString, SSL } from './db-url.mjs'

const url = connectionString()
if (!url) {
  console.log('SUPABASE_DB_URL not set — skipping vocabulary check.')
  process.exit(0)
}

const CODE_ROOTS = ['apps/web/src', 'packages', 'supabase/functions', 'scripts']
/** Short values collide with ordinary words, and a false positive here is worse
 *  than a miss: it teaches people to ignore the guard. */
const MIN_LENGTH = 3

const client = new pg.Client({ connectionString: url, ssl: SSL })
await client.connect()

const { rows: checks } = await client.query(
  "SELECT c.conrelid::regclass::text AS tbl, c.conname, pg_get_constraintdef(c.oid) AS def " +
  "FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid " +
  "JOIN pg_namespace n ON n.oid = t.relnamespace " +
  "WHERE c.contype='c' AND n.nspname='public' AND t.relkind='r' " +
  "AND (pg_get_constraintdef(c.oid) LIKE '%= ANY %' OR pg_get_constraintdef(c.oid) LIKE '% IN (%')")

const { rows: [fns] } = await client.query(
  "SELECT coalesce(string_agg(prosrc, chr(10)),'') AS src FROM pg_proc p " +
  "JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public'")
const { rows: [pols] } = await client.query(
  "SELECT coalesce(string_agg(coalesce(pg_get_expr(polqual,polrelid),'') || ' ' || " +
  "coalesce(pg_get_expr(polwithcheck,polrelid),''), chr(10)),'') AS src FROM pg_policy")
const { rows: declarations } = await client.query(
  "SELECT object_name, reason FROM shape_registry WHERE object_kind = 'vocabulary'")

// ── 1. Code ──────────────────────────────────────────────────────────────────
// A file marked @vocabulary-declaration is the vocabulary RESTATED, not a
// consumer of it, and does not count. See the header for what went wrong.
let code = `${fns.src}\n${pols.src}`
const declarationFiles = []
for (const root of CODE_ROOTS) {
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (!['node_modules', 'dist', '.turbo', 'coverage'].includes(e.name)) walk(p)
      } else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) {
        const src = readFileSync(p, 'utf8')
        // The marker must lead the file, or this script excludes itself for
        // explaining the rule.
        if (src.split('\n', 3).join('\n').includes('@vocabulary-declaration')) {
          declarationFiles.push(p); continue
        }
        // A test asserting the list contains a value is the same restatement as
        // a constants file — `status.test.ts` kept `example` alive on its own.
        if (/\.(test|spec)\.|[\\/]evals?[\\/]/.test(p)) { declarationFiles.push(p); continue }
        code += `\n${src}`
      }
    }
  }
  walk(root)
}
const inCode = (v) => code.includes(`'${v}'`) || code.includes(`"${v}"`) || code.includes(`\`${v}\``)

// ── 2. Data ──────────────────────────────────────────────────────────────────
/** `CHECK ((col = ANY (ARRAY[...])))` — the column the list constrains. */
function columnOf(def) {
  const m = /\(\(?\s*([a-z_][a-z0-9_]*)\s*(?:=\s*ANY|IN)\s*\(/i.exec(def)
  return m ? m[1] : null
}

const dataCache = new Map()
async function valuesInUse(tbl, col) {
  const key = `${tbl}.${col}`
  if (dataCache.has(key)) return dataCache.get(key)
  let set = new Set()
  try {
    const { rows } = await client.query(
      `SELECT DISTINCT "${col}"::text AS v FROM ${tbl} WHERE "${col}" IS NOT NULL LIMIT 500`)
    set = new Set(rows.map((r) => r.v))
  } catch {
    // A generated column, a dropped one, or a CHECK spanning several columns.
    // Unknown is not the same as absent, so the value keeps its benefit of doubt.
    set = null
  }
  dataCache.set(key, set)
  return set
}

// ── The sweep ────────────────────────────────────────────────────────────────
const declared = new Map(declarations.map((d) => [d.object_name, d.reason]))
const dead = []
const staleDeclarations = []
let total = 0

for (const c of checks) {
  const col = columnOf(c.def)
  const values = [...new Set([...c.def.matchAll(/'([a-zA-Z][a-zA-Z0-9_-]*)'/g)].map((m) => m[1]))]
    .filter((v) => v.length >= MIN_LENGTH && v !== 'text')

  for (const v of values) {
    total += 1
    const key = `${c.tbl}.${v}`
    const used = inCode(v)
      || (col ? (await valuesInUse(c.tbl, col))?.has(v) ?? true : true)

    if (used && declared.has(key)) {
      staleDeclarations.push(`${key} — declared unconsumed, but something uses it now`)
    }
    if (!used && !declared.has(key)) dead.push({ key, constraint: c.conname })
  }
}

for (const key of declared.keys()) {
  const [tbl] = key.split('.')
  if (!checks.some((c) => c.tbl === tbl)) {
    staleDeclarations.push(`${key} — declared, but no CHECK on ${tbl} offers it any more`)
  }
}

// ── The shipped-action collision list ───────────────────────────────────────
// A vocabulary SQL holds as a copy, because a trigger cannot import the action
// registry. It was written by hand once and was wrong immediately — twelve names
// against a registry of forty-two, two of them misspellings — so thirty-two
// shipped names were takeable by an authored action type. The TypeScript side is
// derived now; this is what keeps the copy in step.
const actionDrift = []
try {
  const { actionDescriptors } = await import('../supabase/functions/_shared/reality-graph.bundle.mjs')
  const registry = Object.keys(actionDescriptors).sort()
  const body = /shipped text\[\] := ARRAY\[([\s\S]*?)\]/.exec(fns.src)?.[1] ?? ''
  const inSql = [...body.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort()
  if (inSql.length === 0) {
    actionDrift.push('refuse_shipped_action_name has no name array — the collision guard is not deployed')
  } else {
    for (const n of registry) if (!inSql.includes(n)) actionDrift.push(`${n} is a shipped action an authored one could take`)
    for (const n of inSql) if (!registry.includes(n)) actionDrift.push(`${n} is guarded but is not an action type`)
  }
} catch {
  actionDrift.push('could not read the edge bundle — run `pnpm build:edge-bundle` first')
}

await client.end()

if (dead.length === 0 && staleDeclarations.length === 0 && actionDrift.length === 0) {
  const excluded = declarationFiles.length > 0
    ? ` · ${declarationFiles.length} declaration file(s) excluded` : ''
  console.log(`vocabulary OK — ${total} allowed value(s) across ${checks.length} constraint(s), every one consumed or declared${excluded}`)
  process.exit(0)
}

if (dead.length > 0) {
  console.error(`\n✗ ${dead.length} allowed value(s) that nothing consumes:\n`)
  for (const d of dead) console.error(`    ${d.key}   (${d.constraint})`)
  console.error(`
  A CHECK value with no code, no data and no declaration reads as a working
  feature and is not one. Give it a consumer, remove it from the constraint, or
  declare it deliberate:

    INSERT INTO shape_registry (object_kind, object_name, classification, reason)
    VALUES ('vocabulary', '<table>.<value>', 'intentional_unreachable', '<why>');`)
}

if (actionDrift.length > 0) {
  console.error(`
✗ the shipped-action collision guard disagrees with the registry:
`)
  for (const d of actionDrift) console.error(`    ${d}`)
  console.error(`
  SHIPPED_ACTION_NAMES is derived from actionDescriptors; the trigger's text[]
  is a generated copy. Regenerate it in a new migration.`)
}

if (staleDeclarations.length > 0) {
  console.error(`\n✗ ${staleDeclarations.length} stale declaration(s):\n`)
  for (const s of staleDeclarations) console.error(`    ${s}`)
  console.error('\n  An allowlist rots in two directions. Remove these rows.')
}

process.exit(1)
