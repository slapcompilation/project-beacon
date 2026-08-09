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
  .replace(/<[^>]+>/g, ' ')
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
  }
}

console.log(`${readings.length} readings · ${mirror.length} mirrored pages`)
console.log(`${checked} quotations checked in ${readings.length - legacy} strict reading(s)`)
if (legacy > 0) {
  console.log(`${legacy} reading(s) predate this guard and are not checked — add \`verify: strict\` to opt one in`)
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
