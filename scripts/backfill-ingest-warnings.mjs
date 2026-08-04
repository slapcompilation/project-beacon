// Run the blank-template detector over documents that were ingested before it
// existed, using the chunk text already in the database.
//
// The detector is deterministic and reads stored text, so this costs no LLM
// call and no re-ingest. Without it, `blank_template` only ever describes
// documents processed from here on — and the one document that most needs the
// warning, INV11122, is already in.
//
//   node scripts/backfill-ingest-warnings.mjs          # report only
//   node scripts/backfill-ingest-warnings.mjs --write   # persist

import pg from 'pg'
import { connectionString, SSL } from './db-url.mjs'
import { detectBlankTemplate } from '../supabase/functions/_shared/reality-graph.bundle.mjs'

const url = connectionString()
if (!url) {
  console.log('SUPABASE_DB_URL not set — skipping backfill.')
  process.exit(0)
}
const write = process.argv.includes('--write')

const client = new pg.Client({ connectionString: url, ssl: SSL })
await client.connect()

// One row per document with its full text reassembled in chunk order — the same
// input the detector sees at ingest.
const { rows } = await client.query(`
  SELECT d.id, d.title, d.ingest_warnings,
         string_agg(c.text_full, chr(10) ORDER BY c.page, c.chunk_number) AS text
  FROM documents d
  JOIN document_chunks c ON c.document_id = d.id
  GROUP BY d.id, d.title, d.ingest_warnings`)

let flagged = 0
let updated = 0

for (const doc of rows) {
  const verdict = detectBlankTemplate(doc.text ?? '')
  const already = doc.ingest_warnings?.blankTemplate != null
  if (!verdict.isBlank) continue
  flagged += 1
  console.log(`  ${verdict.score.toFixed(2)}  ${doc.title}`)
  for (const s of verdict.signals) console.log(`        · ${s}`)

  if (write && !already) {
    // Merge rather than replace — rejectedEntities may already be there from a
    // later ingest, and this pass knows nothing about them.
    await client.query(
      `UPDATE documents
          SET ingest_warnings = coalesce(ingest_warnings, '{}'::jsonb)
                              || jsonb_build_object('blankTemplate', $2::jsonb)
        WHERE id = $1`,
      [doc.id, JSON.stringify({ score: verdict.score, signals: verdict.signals })])
    updated += 1
  }
}

await client.end()

console.log(`\n${String(rows.length)} document(s) scanned · ${String(flagged)} read as a blank form` +
  (write ? ` · ${String(updated)} updated` : ' · run with --write to persist'))
