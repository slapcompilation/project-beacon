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

const SITEMAP = 'https://palantir.com/docs/sitemap.xml'

const args = process.argv.slice(2)
const refresh = args.includes('--refresh')
// Pages mirrored before mirrorImages handled absolute hrefs kept their
// /docs/resources/... links and downloaded nothing. --images backfills those
// without re-fetching a whole section's prose.
const imagesOnly = args.includes('--images')
const urlsOnly = args.includes('--urls')
const targets = args.filter((a) => !a.startsWith('--'))
if (targets.length === 0 && !urlsOnly) {
  console.error('usage: node scripts/mirror-foundry-docs.mjs [--refresh] <section>...')
  console.error('       node scripts/mirror-foundry-docs.mjs --images <section>/<page>.md...')
  console.error('       node scripts/mirror-foundry-docs.mjs --urls   # re-derive the index')
  process.exit(2)
}
const sections = targets

/** Re-derive the URL index from the sitemap.
 *
 *  Without this the index is frozen at the day it was written, and a page
 *  published since is invisible to every gap check — the diff can only find
 *  what the list already knows about. The substrate mirror has had this from
 *  the start; this one did not, and its list sat two weeks stale.
 *
 *  Two known shapes of the sitemap, both handled: it caps at 5,000 URLs and
 *  skews to API and localized pages, so locale prefixes are stripped back to
 *  the canonical English path and the result deduplicated. */
async function refreshUrls() {
  const res = await fetch(SITEMAP, { headers: { 'user-agent': 'beacon-docs-mirror' } })
  if (!res.ok) throw new Error(`sitemap HTTP ${res.status}`)
  const xml = await res.text()
  const seen = new Set()
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const canonical = m[1].trim().replace(/\/docs\/[a-z]{2}(?:-[A-Za-z]{2})?\/foundry\//, '/docs/foundry/')
    if (canonical.includes('/docs/foundry/')) seen.add(canonical)
  }
  const before = fs.existsSync(URLS)
    ? new Set(fs.readFileSync(URLS, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean))
    : new Set()
  // UNION, never replace. The live sitemap is NARROWER than this index — it
  // caps at 5,000 entries and skews to API and localized pages, while the
  // index was built by recovering canonical English paths from those locale
  // variants. Overwriting threw away 2,217 known URLs the first time this
  // ran. A page that has since been retired costs one failed fetch, which the
  // per-page handler already reports by name.
  const urls = [...new Set([...before, ...seen])].sort()
  fs.writeFileSync(URLS, urls.join('\n') + '\n')
  const added = [...seen].filter((u) => !before.has(u)).sort()
  console.log(`wrote ${URLS} — ${urls.length} pages (${added.length} new since the last index)`)
  for (const u of added.slice(0, 40)) console.log(`  + ${u}`)
  if (added.length > 40) console.log(`  … and ${added.length - 40} more`)
  return urls
}

if (urlsOnly) {
  await refreshUrls()
  if (sections.length === 0) process.exit(0)
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

/** The API reference is a different animal, and worth the extra code.
 *
 *  Its pages carry no prose — they carry the SPEC, at page.content.endpoint:
 *  request and response schemas, field descriptions, and the enums. That is
 *  where Foundry publishes vocabulary the user documentation only gestures at.
 *  Build status is the case that forced this: `data-integration/builds.md`
 *  enumerates the job states and never lists a build's, so ours were inferred
 *  from the job states and two of the four were wrong. `builds/get-build`
 *  states them outright.
 *
 *  Rendered to markdown rather than stored as JSON, because a reading quotes
 *  sentences and check:readings greps them back — descriptions are written
 *  verbatim for exactly that reason. */
function renderEndpoint(ep) {
  const out = []
  const verb = Object.keys(ep.operationType ?? {}).find((k) => k !== 'type') ?? ep.operationType?.type
  out.push(`\`${String(verb).toUpperCase()} ${ep.path}\``, '')
  if (ep.description) out.push(ep.description.trim(), '')
  if (ep.scopes?.length > 0) out.push(`Scopes: ${ep.scopes.map((s) => `\`${s.name}\``).join(', ')}`, '')

  const field = (n, depth) => {
    const pad = '  '.repeat(depth)
    const t = n.type?.type ?? 'unknown'
    const items = n.type?.enumType?.items
    const bits = [`\`${n.name}\``, t.replace(/Type$/, '')]
    if (n.required === true) bits.push('required')
    out.push(`${pad}- ${bits.join(' · ')}`)
    if (items?.length > 0) out.push(`${pad}  one of ${items.map((i) => `\`${i}\``).join(', ')}`)
    if (n.description) {
      // One line per description, quotable as written.
      out.push(`${pad}  "${String(n.description).trim().replace(/\s*\n\s*/g, ' ')}"`)
    }
    for (const c of n.children ?? []) field(c, depth + 1)
  }
  const section = (title, nodes) => {
    if (!nodes || nodes.length === 0) return
    out.push(`## ${title}`, '')
    for (const n of nodes) field(n, 0)
    out.push('')
  }
  section('Path parameters', ep.pathParameters)
  section('Query parameters', ep.queryParameters)
  section('Request', ep.request?.body ? [ep.request.body] : null)
  section('Response', ep.response?.body ? [ep.response.body] : null)
  if (ep.errorResponses?.length > 0) {
    out.push('## Errors', '')
    for (const e of ep.errorResponses) {
      out.push(`- \`${e.name}\` (${e.errorCode})${e.description ? ` — "${e.description.trim()}"` : ''}`)
    }
    out.push('')
  }
  return out.join('\n')
}

async function pageMarkdown(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'beacon-docs-mirror' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const at = html.indexOf('id="__NEXT_DATA__"')
  if (at === -1) throw new Error('no __NEXT_DATA__ — the docs site changed shape')
  const start = html.indexOf('>', at) + 1
  const end = html.indexOf('</script>', start)
  const props = JSON.parse(html.slice(start, end))?.props?.pageProps
  const md = props?.markdown
  if (typeof md === 'string' && md.trim() !== '') return md

  // The API reference puts it one level down, under a typed wrapper.
  const page = props?.page
  const content = page?.content
  const title = page?.title ? `# ${page.title}\n\n` : ''
  if (content?.type === 'markdown' && content.markdown?.trim() !== '') {
    return title + content.markdown
  }
  if (content?.type === 'endpoint' && content.endpoint) {
    return title + renderEndpoint(content.endpoint)
  }
  throw new Error('no page markdown or endpoint — the docs site changed shape')
}

/** Save every image a page references, next to the page.
 *
 *  A screenshot often carries the UI shape the prose leaves out, so a mirror that
 *  stores only markdown is a mirror you cannot fully read. Two forms appear, and
 *  missing the second cost 629 images on the first pass:
 *
 *    ![alt](/docs/resources/...)   markdown, absolute
 *    <img src="./media/x.png">     HTML, RELATIVE TO THE PAGE URL
 *
 *  Names are prefixed with the page slug because `./media/overview.png` is not
 *  unique across pages — two sections would otherwise overwrite each other. */
async function mirrorImages(md, section) {
  const dir = path.join(MIRROR, section, 'images')
  let out = md

  const refs = [
    ...md.matchAll(/!\[[^\]]*\]\((\.?\/[^)\s]+\.(?:png|jpe?g|gif|svg|webp))\)/gi),
    ...md.matchAll(/<img[^>]+src="(\.?\/[^"\s]+\.(?:png|jpe?g|gif|svg|webp))"/gi),
    // `<img src=./x.png>` — unquoted, which the two above both miss.
    ...md.matchAll(/<img[^>]+src=(\.?\/[^"'\s>]+\.(?:png|jpe?g|gif|svg|webp))/gi),
  ]

  for (const m of refs) {
    const href = m[1]
    if (href.startsWith('./images/')) continue          // already mirrored
    const name = href.split('/').pop()
    const target = path.join(dir, name)
    out = out.replaceAll(href, `./images/${name}`)
    if (fs.existsSync(target)) continue

    // `./media/x.png` on the page resolves to the section's resource folder, NOT
    // to a path under the page. Getting this wrong is silent: the docs site is a
    // SPA and answers 200 text/html for anything missing, so a wrong URL writes
    // an HTML error page into a .png. Hence the content-type check below.
    const abs = href.startsWith('/')
      ? `https://www.palantir.com${href}`
      : `https://www.palantir.com/docs/resources/foundry/${section}/${name}`
    try {
      const res = await fetch(abs, { headers: { 'user-agent': 'beacon-docs-mirror' } })
      if (!res.ok) continue
      if (!(res.headers.get('content-type') ?? '').startsWith('image/')) continue
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()))
      images += 1
    } catch { /* a missing image is not worth failing the page for */ }
    await new Promise((r) => setTimeout(r, DELAY_MS))
  }
  return out
}

let written = 0, skipped = 0, images = 0
const failures = []

if (imagesOnly) {
  for (const rel of targets) {
    const file = path.join(MIRROR, rel)
    if (!fs.existsSync(file)) { console.error(`  no such page: ${rel}`); continue }
    const before = fs.readFileSync(file, 'utf8')
    const after = await mirrorImages(before, rel.split(/[/\\]/)[0])
    if (after !== before) fs.writeFileSync(file, after)
    console.log(`  ${rel}`)
  }
  console.log(`\nimages ${images}`)
  process.exit(0)
}

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
      const md = await mirrorImages(await pageMarkdown(url), section)
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

// The map is the artifact CLAUDE.md tells you to grep before concluding
// Foundry lacks something, so it has to match what was just written. It was
// maintained by hand until it described half the corpus.
if (written > 0) {
  const { execFileSync } = await import('node:child_process')
  execFileSync(process.execPath, ['scripts/build-map.mjs'], { stdio: 'inherit' })
}

process.exit(failures.length > 0 ? 1 : 0)
