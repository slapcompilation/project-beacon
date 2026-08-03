// Mirror a section of Palantir's docs into docs/foundry-reference/mirror/.
//
// The mirror is a dated snapshot we grep before designing anything with a
// Foundry counterpart (see the stage directive in CLAUDE.md). It was built by
// hand the first time; this is the repeatable version, so re-fetching a section
// when precision matters is one command rather than an afternoon.
//
//   node scripts/mirror-foundry-docs.mjs workshop app-building
//   node scripts/mirror-foundry-docs.mjs --refresh ontology   # overwrite existing
//
// The pages are Next.js, and every one carries its own SOURCE MARKDOWN at
// props.pageProps.markdown — so this saves what the authors wrote rather than a
// lossy HTML-to-markdown conversion. If that path ever disappears the script
// fails loudly per page instead of writing something plausible and wrong.

import fs from 'node:fs'
import path from 'node:path'

const URLS = 'docs/foundry-reference/all-foundry-urls.txt'
const MIRROR = 'docs/foundry-reference/mirror'
/** Palantir's docs are not a public API; one request at a time, with a pause. */
const DELAY_MS = 400

const args = process.argv.slice(2)
const refresh = args.includes('--refresh')
const sections = args.filter((a) => !a.startsWith('--'))
if (sections.length === 0) {
  console.error('usage: node scripts/mirror-foundry-docs.mjs [--refresh] <section>...')
  process.exit(2)
}

const all = fs.readFileSync(URLS, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
const today = new Date().toISOString().slice(0, 10)

/** mirror/<section>/<slug>.md — a section root becomes _index.md, matching the
 *  layout the existing 311 pages already use. */
function targetFor(url, section) {
  const after = url.split(`/foundry/${section}/`)[1] ?? ''
  const slug = after.replace(/\/$/, '')
  return path.join(MIRROR, section, `${slug === '' ? '_index' : slug.replace(/\//g, '-')}.md`)
}

async function pageMarkdown(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'beacon-docs-mirror' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const at = html.indexOf('id="__NEXT_DATA__"')
  if (at === -1) throw new Error('no __NEXT_DATA__ — the docs site changed shape')
  const start = html.indexOf('>', at) + 1
  const end = html.indexOf('</script>', start)
  const md = JSON.parse(html.slice(start, end))?.props?.pageProps?.markdown
  if (typeof md !== 'string' || md.trim() === '') {
    throw new Error('no pageProps.markdown — the docs site changed shape')
  }
  return md
}

let written = 0, skipped = 0
const failures = []

for (const section of sections) {
  const urls = all.filter((u) => u.includes(`/foundry/${section}/`) || u.endsWith(`/foundry/${section}`))
  if (urls.length === 0) {
    console.error(`${section}: no URLs in ${URLS}`)
    continue
  }
  fs.mkdirSync(path.join(MIRROR, section), { recursive: true })
  console.log(`${section}: ${urls.length} page(s)`)

  for (const url of urls) {
    const target = targetFor(url, section)
    if (!refresh && fs.existsSync(target)) { skipped += 1; continue }
    try {
      const md = await pageMarkdown(url)
      const header = `<!-- source: ${url} · mirrored ${today} from Palantir Foundry docs -->\n\n`
      fs.writeFileSync(target, header + md.trimEnd() + '\n')
      written += 1
    } catch (err) {
      // One attempt each. A retry loop against somebody else's docs site is
      // rude, and a page that fails twice is a page to look at by hand.
      failures.push(`${url} — ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, DELAY_MS))
  }
}

console.log(`\nwritten ${written} · skipped ${skipped} (already mirrored) · failed ${failures.length}`)
for (const f of failures) console.log(`  ${f}`)
process.exit(failures.length > 0 ? 1 : 0)
