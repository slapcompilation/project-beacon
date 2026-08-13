// Mirror a section of Supabase's docs into docs/substrate-reference/mirror/.
//
// The Foundry mirror says WHAT to build. This one says what we can build it
// WITH — and it exists because guessing at the substrate cost us a whole
// design cycle: "no isolate is available on this platform" went into a
// reading as fact when WebAssembly had been there all along.
//
//   node scripts/mirror-substrate-docs.mjs functions database
//   node scripts/mirror-substrate-docs.mjs --refresh functions
//   node scripts/mirror-substrate-docs.mjs --urls          # refresh the URL list
//
// Supabase serves the authors' own markdown at <page-url>.md, so this saves
// what they wrote rather than a lossy HTML conversion. A page that stops
// serving markdown fails loudly instead of writing something plausible.
//
// A mirrored page is still not proof: the docs describe the product, and we
// run one deployment of it, on one plan, at one version. Anything
// load-bearing gets probed against our own project before it is believed.

import fs from 'node:fs'
import path from 'node:path'

const SITEMAP = 'https://supabase.com/docs/sitemap.xml'
const URLS = 'docs/substrate-reference/all-supabase-urls.txt'
const MIRROR = 'docs/substrate-reference/mirror'
const DELAY_MS = 250

const args = process.argv.slice(2)
const refresh = args.includes('--refresh')
const urlsOnly = args.includes('--urls')
const sections = args.filter((a) => !a.startsWith('--'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const today = new Date().toISOString().slice(0, 10)

async function refreshUrls() {
  const res = await fetch(SITEMAP, { headers: { 'user-agent': 'beacon-docs-mirror' } })
  if (!res.ok) throw new Error(`sitemap HTTP ${res.status}`)
  const xml = await res.text()
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((u) => u.includes('/docs/guides/'))
    .sort()
  fs.mkdirSync(path.dirname(URLS), { recursive: true })
  fs.writeFileSync(URLS, urls.join('\n') + '\n')
  console.log(`wrote ${URLS} — ${urls.length} guide pages`)
  return urls
}

/** mirror/<section>/<slug>.md, a section root becoming _index.md — the same
 *  layout the Foundry mirror uses, so both corpora grep alike. */
function targetFor(url, section) {
  const after = url.split(`/docs/guides/${section}`)[1] ?? ''
  const slug = after.replace(/^\//, '').replace(/\/$/, '')
  return path.join(MIRROR, section, `${slug === '' ? '_index' : slug.replace(/\//g, '-')}.md`)
}

/** The docs print example anon/service keys. They are Supabase's own and
 *  public, but a repository that accepts pasted credentials teaches the wrong
 *  reflex — and GitHub's push protection blocks them anyway. Redact on write
 *  so a refresh cannot reintroduce them. */
function redact(md) {
  const MARK = '<redacted-by-mirror: example credential>'
  return md
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, MARK)
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}/g, MARK)
    .replace(/sb_secret_[A-Za-z0-9_-]{16,}/g, MARK)
    .replace(/sb_publishable_[A-Za-z0-9_-]{16,}/g, MARK)
    // The examples also print other providers' keys — Slack, Stripe, GitHub,
    // AWS, OpenAI — in tutorials for those integrations.
    .replace(/sk-[A-Za-z0-9]{20,}/g, MARK)
    .replace(/sk_(?:live|test)_[A-Za-z0-9]{16,}/g, MARK)
    .replace(/(?:ghp|gho)_[A-Za-z0-9]{20,}/g, MARK)
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, MARK)
    .replace(/AKIA[0-9A-Z]{16}/g, MARK)
    .replace(/xox[bp]-[A-Za-z0-9-]{20,}/g, MARK)
    .replace(/AIza[A-Za-z0-9_-]{30,}/g, MARK)
    .replace(/whsec_[A-Za-z0-9]{20,}/g, MARK)
}

async function pageMarkdown(url) {
  const res = await fetch(`${url.replace(/\/$/, '')}.md`, {
    headers: { 'user-agent': 'beacon-docs-mirror' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const md = await res.text()
  if (md.trim() === '' || md.trimStart().startsWith('<')) {
    throw new Error('no markdown — the docs site changed shape')
  }
  return redact(md)
}

const urls = urlsOnly || !fs.existsSync(URLS)
  ? await refreshUrls()
  : fs.readFileSync(URLS, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)

if (urlsOnly) process.exit(0)
if (sections.length === 0) {
  console.error('usage: node scripts/mirror-substrate-docs.mjs [--refresh] <section>...')
  process.exit(2)
}

let written = 0, skipped = 0, failed = 0
for (const section of sections) {
  const mine = urls.filter((u) =>
    u.includes(`/docs/guides/${section}/`) || u.replace(/\/$/, '').endsWith(`/docs/guides/${section}`))
  if (mine.length === 0) {
    console.error(`  ${section}: no pages in the URL list — check the name`)
    failed++
    continue
  }
  for (const url of mine) {
    const out = targetFor(url, section)
    if (!refresh && fs.existsSync(out)) { skipped++; continue }
    try {
      const md = await pageMarkdown(url)
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, `<!-- source: ${url} · mirrored ${today} from Supabase docs -->\n\n${md}`)
      written++
    } catch (err) {
      console.error(`  FAILED ${url} — ${err.message}`)
      failed++
    }
    await sleep(DELAY_MS)
  }
  console.log(`${section}: ${mine.length} page(s)`)
}
console.log(`\nwritten ${written} · skipped ${skipped} (already mirrored) · failed ${failed}`)
