// Every quotation in a reading must appear in the mirror.
//
// CLAUDE.md's founding failure was an invented citation: `object_type_impact`
// came back on a quote that did not exist, and the phrase it rested on appears
// in exactly one mirrored page and is about pipelines. That is not a mistake
// review catches reliably — a plausible quote reads exactly like a real one.
//
// It is, however, mechanical. The mirror is on disk, so a quote either occurs in
// it or does not. This greps every quotation in every reading back against the
// corpus and fails on any that does not.
//
//   pnpm check:readings
//
// It matters more now than it did: readings are about to be written by agents,
// and this is the difference between an agent that cites and one that sounds
// like it cites.
//
// A QUOTE FROM A SCREENSHOT IS NOT IN THE MARKDOWN, and those carry the most
// weight here — the two Capabilities panel shapes, the two separately-named link
// ends, the Dependents index all came from images and appear in no prose. A
// checker that demanded every quotation be greppable would push readings away
// from images, which is exactly backwards.
//
// So a quotation declares where it came from, and each kind is checked its own
// way:
//
//   > "…"                          prose — must appear in a mirrored page
//   > "…"
//   > — path/to/image.png          image — that file must exist on disk
//
// A reading opts in with `verify: strict` in its frontmatter. Readings without
// it are counted and reported, never failed: 23 were written before this
// existed, and a guard that fails on its own backlog gets switched off.
//
// WHAT COUNTS AS A QUOTATION
//   > blockquote lines
//   "double-quoted spans" of at least MIN_LEN characters
// Shorter spans are skipped — "Yes", "no value" and the like are words, not
// citations, and matching them proves nothing.
//
// NORMALISATION, and why each part is needed
//   markdown emphasis is stripped, because a reading bolds the load-bearing
//   half of a sentence and the source does not;
//   whitespace collapses, because a quote wraps at a different column;
//   ellipsis splits the quote into fragments that must EACH appear, because a
//   reading elides the middle of a sentence.

import fs from 'node:fs'
import path from 'node:path'

const READINGS = 'docs/foundry-reference/readings'
const MIRROR = 'docs/foundry-reference/mirror'
const MIN_LEN = 25

/** Strip the formatting a reading adds, so the comparison is about words. The
 *  mirror carries HTML too — a doc table writes `Configure in <br>**Capabilities**
 *  page`, and a reading quotes the sentence without the tag. */
const normalise = (s) => s
  // An HTML TAG, not any angle bracket. `<[^>]+>` looked equivalent and was
  // not: `functions/version-range-dependencies-for-functions` is a page about
  // `>=1.2.3 <2.0.0`, and the loose form matched from a comparison operator to
  // the next `>` anywhere in the file, deleting real prose. Its printed
  // precedence example normalised to "1.0.0-rc.1 =1.0.0 <2.0.0.", so no
  // quotation from it could ever be traced. A tag starts with a letter or a
  // slash; a comparison does not.
  .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
  // A source sentence carries links — "associated with a [space](/docs/…) in the
  // platform" — and a reading quotes the words, not the URL.
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\*\*/g, '').replace(/`/g, '').replace(/\*/g, '')
  .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  .replace(/\\/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  // A blockquote often wraps the sentence in quotation marks of its own; the
  // source does not carry them.
  .replace(/^"+/, '').replace(/"+$/, '')
  .trim()

/** The corpus as one normalised haystack, plus a per-file index for reporting. */
function loadMirror() {
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
    const text = normalise(fs.readFileSync(f, 'utf8'))
    // Case is not what a citation check is about, and a table heading will
    // title-case a word the prose does not.
    return { file: f, text, lower: text.toLowerCase() }
  })
}

/** Quotations in one reading, with the line they came from.
 *
 *  A blockquote WRAPS: three `>` lines are one sentence, and checking them
 *  separately splits it mid-clause so nothing matches. Consecutive `>` lines
 *  join into one quotation; a blank `>` ends it. */
function quotations(text) {
  const out = []
  const lines = text.split(/\r?\n/)
  let inCode = false
  let block = null

  const flush = () => {
    if (block) {
      // A trailing `— path` attributes the quotation to an image.
      const attributed = /^(.*?)[—-]\s*([\w./-]+\.(?:png|jpg|jpeg|gif|svg))\s*$/s.exec(block.text)
      const body = normalise(attributed ? attributed[1] : block.text)
      if (body.length >= MIN_LEN) {
        out.push({ at: block.at, text: body, image: attributed ? attributed[2] : null })
      }
    }
    block = null
  }

  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) { inCode = !inCode; flush(); return }
    if (inCode) return

    const bq = /^\s*>\s?(.*)$/.exec(line)
    if (bq) {
      if (bq[1].trim() === '') flush()
      else if (block) block.text += ' ' + bq[1]
      else block = { at: i + 1, text: bq[1] }
      return
    }
    flush()

    // Inline "double-quoted spans". A prose sentence cannot carry a trailing
    // attribution, so an image path anywhere in the same paragraph attributes
    // every inline quote in it.
    const nearby = /([\w./-]+\.(?:png|jpg|jpeg|gif|svg))/.exec(line)
      ?? /([\w./-]+\.(?:png|jpg|jpeg|gif|svg))/.exec(lines[i + 1] ?? '')
    for (const m of line.matchAll(/[“"]([^“”"]{25,})[”"]/g)) {
      out.push({ at: i + 1, text: normalise(m[1]), image: nearby ? nearby[1] : null })
    }
  })
  flush()
  return out
}

/** A quotation may elide its middle; each fragment must still appear. */
const fragments = (q) => q.split(/…|\.\.\./).map((f) => f.trim()).filter((f) => f.length >= MIN_LEN)

const mirror = loadMirror()
const readings = fs.readdirSync(READINGS).filter((f) => f.endsWith('.md') && f !== 'README.md')

/** Does the reading ask to be checked? */
const isStrict = (text) => /^---[\s\S]*?\bverify:\s*strict\b[\s\S]*?^---/m.test(text)

let checked = 0
let legacy = 0
const failures = []
/** Pages a reading's quotations actually resolve to, per reading. */
const leanedOn = new Set()
const declared = []
/** Named in a header, quoted nowhere. */
const unused = []
/** `mirror/foundry/x/y.md` and a header's `x/y` are the same page. */
const slugOf = (f) => f.split('\\').join('/').replace(/^.*mirror\//, '').replace(/\.md$/, '')

for (const name of readings) {
  const text = fs.readFileSync(path.join(READINGS, name), 'utf8')
  const strict = isStrict(text)
  if (!strict) { legacy += 1; continue }

  for (const q of quotations(text)) {
    if (q.image) {
      checked += 1
      // An image quotation is checked by provenance: the screenshot has to be
      // on disk, under the mirror, where a reader can open it and look.
      const onDisk = path.join(MIRROR, q.image)
      if (!fs.existsSync(onDisk) && !fs.existsSync(q.image)) {
        failures.push({ name, at: q.at, why: `image not on disk: ${q.image}` })
      }
      continue
    }
    const parts = fragments(q.text)
    if (parts.length === 0) continue
    checked += 1
    const unfound = parts.filter((p) => !mirror.some((m) => m.lower.includes(p.toLowerCase())))
    for (const u of unfound) {
      failures.push({ name, at: q.at, why: `not in any mirrored page: "${u.slice(0, 90)}"` })
    }
    // Which page did this quotation come from? EVERY page that carries the
    // sentence, not the first one the walker reaches. Foundry republishes
    // paragraphs across pages — `automate/security` and `automate/permissions`
    // share their execution-permission list word for word — and crediting only
    // the first reported 15 pages as unquoted that the reading quotes verbatim.
    for (const p of parts) {
      for (const m of mirror) {
        if (m.lower.includes(p.toLowerCase())) leanedOn.add(slugOf(m.file))
      }
    }
  }

  // ── what the reading CLAIMS to have read ──────────────────────────────────
  //
  // Every real error this guard did not catch came from the same place: a
  // decision taken on a page that was skimmed or never opened, while the
  // header said otherwise. Three readings listed pages they did not rest on
  // — one of them listed eighteen — and the questions that later blocked the
  // build were sitting in those pages.
  //
  // It WARNS rather than fails: older readings carry long page lists this
  // would fail wholesale, and a guard that fails on its own backlog gets
  // switched off.
  //
  // Nothing here can prove a page was read. What it can do is make the claim
  // PER PAGE and comparable: a page named in the header that no quotation in
  // the whole reading comes from is, in practice, a page that was listed
  // rather than used.
  //
  // A HEADER MAY SAY IT DID NOT READ SOMETHING, and that has to count. The
  // message at the bottom has always offered "say in the header that it was
  // skimmed" as the remedy, and until now saying so changed nothing — a
  // reading whose header read "Named and NOT opened:" was flagged for exactly
  // the honesty being asked for. So the header is read in paragraphs, and a
  // paragraph that disclaims rather than claims is not a claim.
  const header = text.split('\n## ')[0]
  const DISCLAIMED = /skim|not (re-?)?read|never (opened|read)|not opened|deferred|consulted|not quoted|discarded|nothing (below|here)/i
  const claiming = header.split(/\n\s*\n/).filter((para) => !DISCLAIMED.test(para)).join('\n')
  for (const m of claiming.matchAll(/`([a-z0-9][\w./-]*\/[\w./-]+)`/gi)) {
    const claim = slugOf(m[1])
    // Images are provenance-checked above; a bare directory is a pointer, not
    // a page; and a path with no mirrored file behind it is a reference to
    // something else entirely (a script, a migration, another reading).
    if (/\.(png|jpg|jpeg|gif|svg)$/i.test(claim) || claim.endsWith('/')) continue
    if (!mirror.some((m) => slugOf(m.file) === claim)) continue
    declared.push({ name, claim })
  }
  for (const d of declared.filter((d) => d.name === name)) {
    if (!leanedOn.has(d.claim)) unused.push({ name, claim: d.claim })
  }
  leanedOn.clear()
  declared.length = 0
}

console.log(`${readings.length} readings · ${mirror.length} mirrored pages`)
console.log(`${checked} quotations checked in ${readings.length - legacy} strict reading(s)`)
if (legacy > 0) {
  console.log(`${legacy} reading(s) predate this guard and are not checked — add \`verify: strict\` to opt one in`)
}

if (unused.length > 0) {
  console.warn(`
${unused.length} page(s) named in a reading's header that no quotation rests on:
`)
  for (const u of unused.slice(0, 20)) console.warn(`  ${u.name}  —  ${u.claim}`)
  if (unused.length > 20) console.warn(`  …and ${unused.length - 20} more`)
  console.warn('\nA page listed as read and never quoted is usually a page that was listed.')
  console.warn('Either quote what it contributed, or say in the header that it was skimmed.')
}

if (failures.length > 0) {
  console.error(`\n${failures.length} citation(s) could not be traced:\n`)
  for (const f of failures.slice(0, 25)) console.error(`  ${f.name}:${f.at}  ${f.why}`)
  if (failures.length > 25) console.error(`  …and ${failures.length - 25} more`)
  console.error('\nA citation that cannot be traced is the failure this exists to prevent.')
  console.error('Fix the quote, mirror the page, or attribute it to the screenshot it came from.')
  process.exit(1)
}

console.log('every checked citation traces to a mirrored page or a screenshot on disk')
