// Has a page we built from changed since we mirrored it?
//
// The mirror is a dated snapshot — every page carries the date it was taken —
// and Palantir edits their documentation. A migration whose comment quotes a
// sentence that no longer exists is worse than one with no citation: it looks
// verified.
//
//   pnpm check:doc-drift
//
// WHAT IT CHECKS, and why the list is derived rather than kept. Re-fetching
// 1,758 pages weekly would be rude and slow. It checks only the pages our
// readings actually QUOTE — which is exactly the set the build rests on, and it
// is computed, not maintained: a page enters the list by being cited and leaves
// it by not being.
//
// It reports; it never rewrites the mirror. A changed page is a decision — did
// Foundry change, or were we wrong — and that decision needs the reading it
// belongs to open beside it.

import fs from 'node:fs'
import path from 'node:path'

const READINGS = 'docs/foundry-reference/readings'
const MIRROR = 'docs/foundry-reference/mirror'
const DELAY_MS = 400
const MIN_LEN = 25

const normalise = (s) => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\*\*/g, '').replace(/`/g, '').replace(/\*/g, '')
  .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  .replace(/\\/g, '').replace(/\s+/g, ' ').trim()
  .replace(/^"+/, '').replace(/"+$/, '').trim()

/** Quotations, joined across wrapped blockquote lines. */
function quotations(text) {
  const out = []
  let block = null
  let inCode = false
  const flush = () => {
    if (block && normalise(block).length >= MIN_LEN) out.push(normalise(block))
    block = null
  }
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { inCode = !inCode; flush(); continue }
    if (inCode) continue
    const bq = /^\s*>\s?(.*)$/.exec(line)
    if (bq) {
      if (bq[1].trim() === '') flush()
      else block = block ? block + ' ' + bq[1] : bq[1]
      continue
    }
    flush()
    for (const m of line.matchAll(/[“"]([^“”"]{25,})[”"]/g)) out.push(normalise(m[1]))
  }
  flush()
  return out
}

function mirrorPages() {
  const files = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (e.name !== 'images' && e.name !== 'media') walk(p) }
      else if (e.name.endsWith('.md')) files.push(p)
    }
  }
  walk(MIRROR)
  return files.map((f) => {
    const raw = fs.readFileSync(f, 'utf8')
    const url = /<!--\s*source:\s*(\S+)/.exec(raw)?.[1] ?? null
    return { file: f, url, raw, lower: normalise(raw).toLowerCase() }
  })
}

/** Which mirrored pages do our readings actually quote? */
function loadBearing(pages) {
  const cited = new Map()
  for (const name of fs.readdirSync(READINGS)) {
    if (!name.endsWith('.md') || name === 'README.md') continue
    const text = fs.readFileSync(path.join(READINGS, name), 'utf8')
    for (const q of quotations(text)) {
      const frag = q.split(/…|\.\.\./)[0].trim()
      if (frag.length < MIN_LEN) continue
      const hit = pages.find((p) => p.lower.includes(frag.toLowerCase()))
      if (!hit) continue
      if (!cited.has(hit.file)) cited.set(hit.file, { page: hit, readings: new Set() })
      cited.get(hit.file).readings.add(name)
    }
  }
  return [...cited.values()]
}

async function fetchMarkdown(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'beacon-docs-mirror' } })
  if (!res.ok) return { error: `HTTP ${res.status}` }
  const html = await res.text()
  // The attribute, not the whole tag: attribute order is not ours to predict,
  // and matching the full opening tag failed on every page.
  const at = html.indexOf('id="__NEXT_DATA__"')
  if (at === -1) return { error: 'no __NEXT_DATA__ — the docs site changed shape' }
  const from = html.indexOf('>', at) + 1
  const end = html.indexOf('</script>', from)
  const md = JSON.parse(html.slice(from, end))?.props?.pageProps?.markdown
  if (typeof md !== 'string') return { error: 'no pageProps.markdown' }
  return { markdown: md }
}

const pages = mirrorPages()
const watched = loadBearing(pages)
console.log(`${pages.length} mirrored pages · ${watched.length} of them cited by a reading`)

if (process.argv.includes('--list')) {
  for (const w of watched) {
    console.log(`  ${path.relative(MIRROR, w.page.file)}  ← ${[...w.readings].join(', ')}`)
  }
  process.exit(0)
}

const changed = []
const failed = []

for (const w of watched) {
  if (!w.page.url) { failed.push({ file: w.page.file, why: 'no source URL in the header' }); continue }
  const got = await fetchMarkdown(w.page.url)
  await new Promise((r) => setTimeout(r, DELAY_MS))
  if (got.error) { failed.push({ file: w.page.file, why: got.error }); continue }

  // Compare the prose, not the header we wrote or the whitespace it wrapped at.
  const mirrored = normalise(w.page.raw.replace(/^<!--[\s\S]*?-->\s*/, ''))
  if (normalise(got.markdown) !== mirrored) {
    changed.push({ file: path.relative(MIRROR, w.page.file), readings: [...w.readings] })
  }
}

if (failed.length > 0) {
  console.warn(`\n${failed.length} page(s) could not be fetched:`)
  for (const f of failed.slice(0, 10)) console.warn(`  ${path.relative(MIRROR, f.file)} — ${f.why}`)
}

// A check that could not check anything must not report success. The first run
// of this fetched nothing — every page failed on a marker that was too exact —
// and still printed "unchanged". That is the same failure as an audit that
// silently skips: it is not a pass, it is an absence of evidence.
const reached = watched.length - failed.length
if (watched.length > 0 && reached < watched.length / 2) {
  console.error(`
Only ${reached} of ${watched.length} pages could be fetched — too few to conclude anything.`)
  process.exit(1)
}

if (changed.length === 0) {
  console.log(`every one of the ${reached} pages we build from is unchanged upstream`)
  process.exit(0)
}

console.error(`\n${changed.length} page(s) have CHANGED upstream since we mirrored them:\n`)
for (const c of changed) {
  console.error(`  ${c.file}`)
  console.error(`    cited by: ${c.readings.join(', ')}`)
}
console.error('\nRe-mirror the page, then re-read it against the reading that cites it.')
console.error('A citation that no longer exists is worse than none — it looks verified.')
process.exit(1)
