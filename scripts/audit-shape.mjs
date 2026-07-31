// Shape audit — every surviving database artifact, classified by reachability
// and by whether the ontology knows about it.
//
// Migrations are a LOG: most of the 285 are superseded by later ones, so
// auditing their text measures history rather than the system. This audits what
// the database actually contains now, which is the thing the stage directive's
// test applies to — does this shape have a Foundry counterpart, and does ours
// match it?
//
//   node scripts/audit-shape.mjs           summary + findings
//   node scripts/audit-shape.mjs --json    full data to stdout
//   node scripts/audit-shape.mjs --check   fail the build on new drift
//
// --check is the ratchet (Phase E). It enforces three things against
// shape_registry, which is where the platform/domain boundary is DECLARED:
//
//   1. every table declares what it is — a new one cannot arrive unclassified
//   2. every `domain` table is reached by the ontology (object type, link OR
//      time series — three doors, not one)
//   3. the grandfathered `domain_untyped` set may only SHRINK, and no
//      unreachable function may appear that is not declared intentional
//
// The point is not this file. It is that the next capability from Foundry's
// list cannot land half-typed or half-consumed without the build saying so.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { connectionString, SSL } from './db-url.mjs'

const SEP = String.fromCharCode(92) // backslash, kept out of template literals

// ── Who calls what, from the TypeScript side ────────────────────────────────
const ROOTS = ['apps/web/src', 'supabase/functions', 'packages']
const called = new Map()
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!['node_modules', 'dist'].includes(e.name)) walk(p) }
    else if (/\.(ts|tsx)$/.test(e.name)) {
      const src = readFileSync(p, 'utf8')
      for (const m of src.matchAll(/\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g)) {
        if (!called.has(m[1])) called.set(m[1], new Set())
        called.get(m[1]).add(p.split(SEP).join('/'))
      }
    }
  }
}
for (const r of ROOTS) { try { walk(r) } catch { /* absent root is fine */ } }

// The SQL guards are callers too — the drift tests are the only thing invoking
// authored_artifact_drift, export_ontology_package and friends. Without this
// the audit reports its own contract suite as dead code.
const guards = new Map()
try {
  for (const f of readdirSync('supabase/tests')) {
    if (f.endsWith('.sql')) guards.set(`supabase/tests/${f}`, readFileSync(join('supabase/tests', f), 'utf8'))
  }
} catch { /* no tests dir */ }
const inGuards = (name) => {
  const re = new RegExp(`\\b${name}\\s*\\(`)
  for (const [file, src] of guards) if (re.test(src)) return file
  return null
}

const url = connectionString()
if (!url) { console.log('audit-shape: no SUPABASE_DB_URL — skipping'); process.exit(0) }

const c = new pg.Client({ connectionString: url, ssl: SSL })
await c.connect()

// A function is reachable if the app calls it, a trigger fires it, another
// function calls it, or a policy uses it. Anything else is unreachable — which
// is not the same as wrong, but it is where dead shape accumulates.
const { rows: fns } = await c.query(`
  SELECT p.proname AS name,
         p.prosecdef AS secdef,
         EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgfoid = p.oid AND NOT t.tgisinternal) AS is_trigger,
         -- q.prokind = 'f' matters: pg_get_functiondef throws on an aggregate.
         (SELECT count(*) FROM pg_proc q JOIN pg_namespace qn ON qn.oid = q.pronamespace
           WHERE qn.nspname = 'public' AND q.oid <> p.oid AND q.prokind = 'f'
             AND pg_get_functiondef(q.oid) ~ ('\\m' || p.proname || '\\M')) AS refs_fns,
         (SELECT count(*) FROM pg_policy pol
           WHERE pg_get_expr(pol.polqual, pol.polrelid) ~ ('\\m' || p.proname || '\\M')
              OR pg_get_expr(pol.polwithcheck, pol.polrelid) ~ ('\\m' || p.proname || '\\M')) AS refs_policies,
         -- A CHECK helper and a cron job are both real callers that no grep of
         -- the TypeScript would ever find. Without these two, every constraint
         -- grammar function and the whole unattended cycle read as dead.
         (SELECT count(*) FROM pg_constraint con
           WHERE con.contype = 'c'
             AND pg_get_constraintdef(con.oid) ~ ('\\m' || p.proname || '\\M')) AS refs_checks,
         (SELECT count(*) FROM cron.job j
           WHERE j.command ~ ('\\m' || p.proname || '\\M')) AS refs_cron,
         -- rls_auto_enable is fired by an EVENT trigger, which is not pg_trigger.
         (SELECT count(*) FROM pg_event_trigger et WHERE et.evtfoid = p.oid) AS refs_evt
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    -- pgvector installs ~40 functions into public (the advisor's
    -- extension_in_public). They are not ours and would drown the signal.
    AND NOT EXISTS (SELECT 1 FROM pg_depend d
                    WHERE d.objid = p.oid AND d.deptype = 'e')
  ORDER BY 1`)

const { rows: registry } = await c.query(
  `SELECT object_kind, object_name, classification, reason FROM public.shape_registry`)

const { rows: reached } = await c.query(`
  SELECT DISTINCT name FROM (
    SELECT source_table  AS name FROM object_types           WHERE source_table  IS NOT NULL
    UNION SELECT backing_table   FROM link_types             WHERE backing_table IS NOT NULL
    UNION SELECT source_table    FROM time_series_properties WHERE source_table  IS NOT NULL
  ) x`)

const { rows: tbls } = await c.query(`
  SELECT c.relname AS name, coalesce(s.n_live_tup, 0) AS rows,
         EXISTS (SELECT 1 FROM object_types o WHERE o.source_table = c.relname) AS backs_type,
         EXISTS (SELECT 1 FROM link_types l WHERE l.backing_table = c.relname) AS backs_link
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY 1`)

await c.end()

const enriched = fns.map((f) => ({
  ...f,
  called_from_app: called.has(f.name),
  callers: called.has(f.name) ? [...called.get(f.name)] : [],
  guard: inGuards(f.name),
  reachable: called.has(f.name) || f.is_trigger || Number(f.refs_fns) > 0
    || Number(f.refs_policies) > 0 || Number(f.refs_checks) > 0 || Number(f.refs_cron) > 0
    || Number(f.refs_evt) > 0 || inGuards(f.name) !== null,
}))

// ── The ratchet ─────────────────────────────────────────────────────────────
if (process.argv.includes('--check')) {
  const failures = []
  const declared = new Map(registry.filter((r) => r.object_kind === 'table').map((r) => [r.object_name, r]))
  const reachedSet = new Set(reached.map((r) => r.name))
  const exempt = new Set(registry.filter((r) => r.object_kind === 'function').map((r) => r.object_name))

  for (const t of tbls) {
    const d = declared.get(t.name)
    if (!d) {
      failures.push(`table ${t.name} declares nothing — add it to shape_registry as platform, domain or dev`)
    } else if (d.classification === 'domain' && !reachedSet.has(t.name)) {
      failures.push(`table ${t.name} is declared domain but the ontology does not reach it (no object type, link or time series)`)
    }
  }

  const baselineRow = registry.find((r) => r.object_kind === 'meta' && r.object_name === 'domain_untyped_baseline')
  const baseline = baselineRow ? Number(baselineRow.reason) : 0
  const untyped = registry.filter((r) => r.classification === 'domain_untyped').length
  if (untyped > baseline) {
    failures.push(`grandfathered domain tables rose from ${baseline} to ${untyped} — the ratchet only turns one way`)
  }

  for (const f of enriched.filter((x) => !x.reachable)) {
    if (!exempt.has(f.name)) {
      failures.push(`function ${f.name} is reachable by nothing — give it a consumer, delete it, or declare it intentional_unreachable`)
    }
  }

  if (failures.length > 0) {
    console.error(`SHAPE DRIFT — ${failures.length} finding(s):`)
    for (const f of failures) console.error(`  ${f}`)
    process.exit(1)
  }
  console.log(`shape OK — ${tbls.length} tables declared, ${untyped}/${baseline} grandfathered, every unreachable function accounted for`)
  process.exit(0)
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ fns: enriched, tbls }, null, 1))
  process.exit(0)
}

const unreachable = enriched.filter((f) => !f.reachable)
const orphanTables = tbls.filter((t) => !t.backs_type && !t.backs_link)

console.log(`functions        ${enriched.length}`)
console.log(`  called by app  ${enriched.filter((f) => f.called_from_app).length}`)
console.log(`  trigger        ${enriched.filter((f) => f.is_trigger).length}`)
console.log(`  unreachable    ${unreachable.length}`)
console.log(`tables           ${tbls.length}`)
console.log(`  back a type    ${tbls.filter((t) => t.backs_type).length}`)
console.log(`  back a link    ${tbls.filter((t) => t.backs_link && !t.backs_type).length}`)
console.log(`  neither        ${orphanTables.length}`)

console.log('\nUNREACHABLE FUNCTIONS')
for (const f of unreachable) console.log(`  ${f.name}${f.secdef ? '  [definer]' : ''}`)

console.log('\nTABLES OUTSIDE THE ONTOLOGY, BY SIZE')
for (const t of orphanTables.sort((a, b) => b.rows - a.rows)) {
  console.log(`  ${String(t.rows).padStart(6)}  ${t.name}`)
}
