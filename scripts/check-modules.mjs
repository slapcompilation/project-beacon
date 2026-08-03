// Every reference inside a Workshop module must point at something real.
//
// Written after an audit of the live data found 87 of 92 modules were e2e
// leftovers, and — more importantly — that a widget could legally show ANOTHER
// module's variable. Migration 319 made the cross-module case impossible in the
// database. This catches what a foreign key cannot: references held BY NAME
// inside jsonb, where nothing but this script is looking.
//
// A module fails quietly. Everything renders, no error appears, and one card
// shows an em dash — so the failure mode is a screen that looks finished and
// answers nothing. That is why this is a gate rather than a report.
//
//   node scripts/check-modules.mjs
//
// Dormant without SUPABASE_DB_URL, like the other db-backed guards.

import pg from 'pg'
import { connectionString, SSL } from './db-url.mjs'

const url = connectionString()
if (!url) {
  console.log('SUPABASE_DB_URL not set — skipping module reference check.')
  process.exit(0)
}

const client = new pg.Client({ connectionString: url, ssl: SSL })
await client.connect()

/** Each check returns rows of { subject, detail }. Keep the SQL readable: this
 *  file is the documentation of what "a well-formed module" means. */
const CHECKS = [
  {
    name: 'a module that renders nothing',
    why: 'No widgets and no loop — an operator opens it and finds an empty state.',
    sql: `SELECT m.api_name AS subject, m.status AS detail
          FROM modules m
          WHERE NOT EXISTS (SELECT 1 FROM module_widgets w WHERE w.module_id = m.id)
            AND NOT EXISTS (SELECT 1 FROM module_layouts l
                            WHERE l.module_id = m.id AND l.layout_type = 'loop')`,
  },
  {
    name: 'an object set variable pointing nowhere',
    why: 'Its table and every aggregation over it silently resolve to nothing.',
    sql: `SELECT m.api_name || '.' || v.api_name AS subject,
                 coalesce(v.definition->>'objectSetId', '(unset)') AS detail
          FROM module_variables v JOIN modules m ON m.id = v.module_id
          WHERE v.definition_kind = 'object_set_definition'
            AND (coalesce(v.definition->>'objectSetId', '') = ''
                 OR NOT EXISTS (SELECT 1 FROM object_sets s
                                WHERE s.id = (v.definition->>'objectSetId')::uuid))`,
  },
  {
    name: 'an aggregation reading a set that is not there',
    why: 'The metric card shows an em dash and nobody can tell why.',
    sql: `SELECT m.api_name || '.' || v.api_name AS subject,
                 coalesce(v.definition->>'objectSet', '(unset)') AS detail
          FROM module_variables v JOIN modules m ON m.id = v.module_id
          WHERE v.definition_kind = 'object_set_aggregation'
            AND NOT EXISTS (SELECT 1 FROM module_variables s
                            WHERE s.module_id = v.module_id
                              AND s.api_name = v.definition->>'objectSet'
                              AND s.var_type = 'object_set')`,
  },
  {
    name: 'a set reading a filter variable that is not there',
    why: 'The filter list writes somewhere nothing reads; nothing ever narrows.',
    sql: `SELECT m.api_name || '.' || v.api_name AS subject,
                 v.definition->>'filterVariable' AS detail
          FROM module_variables v JOIN modules m ON m.id = v.module_id
          WHERE v.definition ? 'filterVariable'
            AND NOT EXISTS (SELECT 1 FROM module_variables f
                            WHERE f.module_id = v.module_id
                              AND f.api_name = v.definition->>'filterVariable'
                              AND f.var_type = 'object_set_filter')`,
  },
  {
    name: 'a filter list whose output nothing reads',
    why: 'The operator picks a value and the screen does not move.',
    sql: `SELECT m.api_name || '.' || w.api_name AS subject,
                 coalesce(w.config->>'output', '(unset)') AS detail
          FROM module_widgets w JOIN modules m ON m.id = w.module_id
          WHERE w.widget_type = 'filter_list'
            AND NOT EXISTS (SELECT 1 FROM module_variables s
                            WHERE s.module_id = w.module_id
                              AND s.definition->>'filterVariable' = w.config->>'output')`,
  },
  {
    name: 'an event acting on something that is gone',
    why: 'The button is pressable and does nothing at all.',
    sql: `SELECT m.api_name || ' · ' || e.effect_type AS subject,
                 coalesce(e.config->>'variableId', e.config->>'layoutApiName', '?') AS detail
          FROM module_events e JOIN modules m ON m.id = e.module_id
          WHERE (e.config ? 'variableId'
                 AND NOT EXISTS (SELECT 1 FROM module_variables v
                                 WHERE v.id::text = e.config->>'variableId'
                                   AND v.module_id = e.module_id))
             OR (e.config ? 'layoutApiName'
                 AND NOT EXISTS (SELECT 1 FROM module_layouts l
                                 WHERE l.module_id = e.module_id
                                   AND l.api_name = e.config->>'layoutApiName'))`,
  },
  {
    name: 'a loop that cannot run',
    why: 'It needs a set to walk, a module to show, and where the object lands.',
    sql: `SELECT m.api_name || '.' || l.api_name AS subject, l.config::text AS detail
          FROM module_layouts l JOIN modules m ON m.id = l.module_id
          WHERE l.layout_type = 'loop'
            AND (coalesce(l.config->>'variable','') = ''
                 OR coalesce(l.config->>'module','') = ''
                 OR coalesce(l.config->>'itemInto','') = '')`,
  },
  {
    name: 'embedding a module that is not published',
    why: 'Foundry always embeds the published version; a draft renders a notice.',
    sql: `SELECT m.api_name || '.' || w.api_name AS subject,
                 coalesce(w.config->>'module', '(unset)') AS detail
          FROM module_widgets w JOIN modules m ON m.id = w.module_id
          WHERE w.widget_type = 'embedded_module'
            AND NOT EXISTS (SELECT 1 FROM modules c
                            WHERE c.api_name = w.config->>'module' AND c.status = 'published')
          UNION ALL
          SELECT m.api_name || '.' || l.api_name,
                 coalesce(l.config->>'module', '(unset)')
          FROM module_layouts l JOIN modules m ON m.id = l.module_id
          WHERE l.layout_type = 'loop' AND coalesce(l.config->>'module','') <> ''
            AND NOT EXISTS (SELECT 1 FROM modules c
                            WHERE c.api_name = l.config->>'module' AND c.status = 'published')`,
  },
  {
    name: 'a metric card bound to a set instead of a value',
    why: 'Foundry cards display a variable; aggregating belongs to the variable.',
    sql: `SELECT m.api_name || '.' || w.api_name AS subject, v.api_name AS detail
          FROM module_widgets w
          JOIN modules m ON m.id = w.module_id
          JOIN module_variables v ON v.id = w.variable_id
          WHERE w.widget_type = 'metric_card' AND v.var_type = 'object_set'`,
  },
  {
    name: 'test debris left in the application list',
    why: 'Specs must remove what they create; otherwise the portal fills with probes.',
    sql: `SELECT api_name AS subject, status AS detail FROM modules
          WHERE api_name ~ '^(builder|loop|agg|authored|w1)_probe' OR api_name ~ '^probe_'`,
  },
]

let failures = 0
for (const check of CHECKS) {
  const { rows } = await client.query(check.sql)
  if (rows.length === 0) continue
  failures += rows.length
  console.error(`\n✗ ${check.name} — ${rows.length}`)
  console.error(`  ${check.why}`)
  for (const r of rows.slice(0, 10)) console.error(`    ${r.subject}  ${r.detail ?? ''}`)
  if (rows.length > 10) console.error(`    … and ${rows.length - 10} more`)
}

const { rows: [counts] } = await client.query(
  `SELECT (SELECT count(*) FROM modules) AS modules,
          (SELECT count(*) FROM module_widgets) AS widgets`)

await client.end()

if (failures === 0) {
  console.log(`modules OK — ${counts.modules} module(s), ${counts.widgets} widget(s), every reference resolves`)
  process.exit(0)
}
console.error(`\n${failures} broken reference(s). A module fails quietly: it renders, and answers nothing.`)
process.exit(1)
