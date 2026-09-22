// Before you change the shape of a table that a lot of things already read,
// check that shape against the one the documentation publishes.
//
// THE COST CURVE THIS EXISTS FOR, measured on real migrations here. An ENGINE
// GAP costs a constant: 842 added a missing engine behind a column that already
// had its CHECK, its guard and its surface, in one additive migration, and
// nothing that already existed had to move. A SHAPE ERROR costs the number of
// consumers: 840 corrected a wrong primary-key semantic and had to rewrite a
// test that had encoded it, green for 400 migrations. Consumers only ever grow,
// so a shape is cheap to correct now and ruinous later.
//
// THIS IS NOT `check:shape`, WHICH WAS DELETED, and the difference is the whole
// design. That one decided correctness statically and needed an allowlist to
// tell "deliberately ahead of its runtime" from "dead" — and CLAUDE.md's lesson
// is that wanting an allowlist is the signal to index instead. This indexes:
// consumers come from `pg_proc`, and whether a shape has been audited comes
// from the machine-readable block in docs/SHAPE-AUDIT.md. There is no list of
// exceptions to maintain, because a disposition is a paragraph with a reason.
//
// AND IT IS TIED TO THE WORK, not to a calendar. It fails only when a migration
// in THIS branch changes the shape or the access of a table that already has
// many consumers and has never been audited — the moment the check is cheap and
// the moment it is about to stop being. The full backlog is printed every run,
// because a guard that passes is not evidence; read the count it prints.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import pg from 'pg'
import { connectionString, SSL } from './db-url.mjs'

/** Above this many consuming functions, correcting a shape stops being cheap.
 *  Measured, not chosen: `object_state` had four consumers when 842 corrected
 *  it and the correction touched none of them. */
const THRESHOLD = 8

const AUDIT = path.join(process.cwd(), 'docs', 'SHAPE-AUDIT.md')
const FENCE = '```shape-audit'

/** The migrations this branch ADDS — the same question check:readings asks, and
 *  for the same reason: `git diff` never lists an untracked file, and a new
 *  file is the commonest case there is. */
const addedMigrations = () => {
  const found = new Set()
  const collect = (args) => {
    const r = spawnSync('git', args, { encoding: 'utf8' })
    if (r.status !== 0) return
    for (const l of r.stdout.split('\n')) {
      const f = l.trim()
      if (f.endsWith('.sql')) found.add(f)
    }
  }
  for (const base of ['origin/main...HEAD', 'origin/main']) {
    collect(['diff', '--name-only', '--diff-filter=A', base, '--', 'supabase/migrations'])
  }
  collect(['ls-files', '--others', '--exclude-standard', '--', 'supabase/migrations'])
  return [...found]
}

/** Only the fenced block counts, and it is parsed by slicing rather than by a
 *  regex. The first version of this matched any backticked mention, and
 *  SHAPE-AUDIT.md's own backlog paragraph then marked eight tables audited by
 *  naming them — a prose mention is not a verdict, and an index that cannot
 *  tell the difference reported 30 audited where 24 were. */
const auditedTables = () => {
  if (!fs.existsSync(AUDIT)) return new Set()
  const doc = fs.readFileSync(AUDIT, 'utf8')
  const open = doc.indexOf(FENCE)
  if (open < 0) return new Set()
  const from = open + FENCE.length
  const close = doc.indexOf('```', from)
  const body = close < 0 ? doc.slice(from) : doc.slice(from, close)
  return new Set(body.split('\n').map((l) => l.trim().split(/\s+/)[0]).filter(Boolean))
}

const url = connectionString()
if (!url) {
  console.log('no database connection — skipping (CI without SUPABASE_DB_URL)')
  process.exit(0)
}

const db = new pg.Client({ connectionString: url, ssl: SSL })
await db.connect()

// A table's consumers are the functions that name it. `\m` and `\M` are
// POSTGRES word boundaries — correct here, inside SQL — so `builds` does not
// match `build_jobs` and `object_sets` does not match the `object_set_rows`
// helper, which is how a first count of this came out at 30 when the honest
// answer is 14. They mean nothing in a JavaScript regex; see below.
const { rows } = await db.query(`
  WITH t AS (
    SELECT c.relname AS name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  )
  SELECT t.name,
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace pn ON pn.oid = p.pronamespace
           WHERE pn.nspname = 'public' AND p.prosrc ~ ('\\m' || t.name || '\\M')) AS consumers
    FROM t
   ORDER BY 2 DESC, 1
`)
await db.end()

const audited = auditedTables()
const ranked = rows.map((r) => ({
  name: r.name, consumers: Number(r.consumers), audited: audited.has(r.name),
}))
const load = ranked.filter((r) => r.consumers >= THRESHOLD)

console.log(`${ranked.length} public tables · ${load.length} with ${THRESHOLD}+ consumers · ` +
            `${load.filter((r) => r.audited).length} of those audited`)

// What this branch actually changes the SHAPE or the ACCESS of. A migration
// that merely selects from a table in its proof is not changing it, so the
// question is narrowed to DDL and policy, which is exactly when a published
// shape is worth re-reading.
const touched = new Set()
for (const f of addedMigrations()) {
  const p = path.isAbsolute(f) ? f : path.join(process.cwd(), f)
  if (!fs.existsSync(p)) continue
  const sql = fs.readFileSync(p, 'utf8')
  for (const r of ranked) {
    // `\b`, not `\m..\M`: those are Postgres word boundaries and mean nothing
    // to a JavaScript regex, where `\M` is a literal M. The first version of
    // this line used them and the gate matched nothing at all — found by
    // running it against a migration that should have failed it, which is the
    // only way a guard's failing path ever gets exercised.
    const ddl = new RegExp(
      '(alter\\s+table|create\\s+table|create\\s+or\\s+replace\\s+view|' +
      'create\\s+(unique\\s+)?index[^;]*?\\son|policy[^;]*?\\son)\\s+' +
      '(if\\s+(not\\s+)?exists\\s+)?(public\\.)?"?' + r.name + '"?\\b', 'is')
    if (ddl.test(sql)) touched.add(r.name)
  }
}

const unaudited = load.filter((r) => !r.audited)
if (unaudited.length > 0) {
  console.log('')
  console.log(`  backlog — ${unaudited.length} load-bearing shape(s) not yet audited:`)
  for (const r of unaudited.slice(0, 15)) {
    console.log(`  ${String(r.consumers).padStart(4)}  ${r.name}`)
  }
  if (unaudited.length > 15) console.log(`  … and ${unaudited.length - 15} more`)
}

const overdue = [...touched].map((n) => ranked.find((r) => r.name === n))
  .filter((r) => r && r.consumers >= THRESHOLD && !r.audited)

console.log('')
if (overdue.length === 0) {
  console.log(touched.size === 0
    ? 'no migration in this branch changes the shape of a table'
    : `shapes changed here: ${[...touched].join(', ')} — each audited or below ${THRESHOLD} consumers`)
  process.exit(0)
}

console.error(`${overdue.length} shape(s) changed here with ${THRESHOLD}+ consumers and no audit:`)
for (const r of overdue) console.error(`  ${r.name} — ${r.consumers} consumers`)
console.error('')
console.error('Correcting a shape costs its consumer count, and consumers only grow.')
console.error('Check this one against the page or the api/ entry that publishes it —')
console.error('api/ has falsified our schema four times and publishes unions WITH their')
console.error('members — and write the verdict into docs/SHAPE-AUDIT.md. "Ours diverges,')
console.error('and here is why that is deliberate" is a verdict, not a gap.')
process.exit(1)
