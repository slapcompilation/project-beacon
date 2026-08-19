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
// A migration header has a third kind. A migration correcting an earlier one
// quotes what THAT one said, and our own prose is in no mirrored page by
// construction. Such a quotation is allowed when it appears verbatim in a
// migration with a lower version, and the run says which one — it cannot pass
// off a false Foundry citation, because the earlier migration's own quotations
// were checked when it was added.
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
import { spawnSync } from 'node:child_process'

const READINGS = 'docs/foundry-reference/readings'
const MIRROR = 'docs/foundry-reference/mirror'
const MIGRATIONS = 'supabase/migrations'
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
  // The docs site marks external links with an arrow INSIDE the link text
  // (`[Palantir Rubix ↗](https://…)`), so a reading that quotes the words
  // never matches the glyph. It is chrome, not content.
  .replace(/\s*↗/g, '')
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
    // Deliberately NOT parity-paired the way sqlQuotations is. Reading prose
    // carries unbalanced quote marks within a line — an inch mark, a quotation
    // opened here and closed two lines down — and pairing on them shifted every
    // subsequent span by one and reported 309 phantom citations. A migration
    // header is disciplined enough for parity; a reading is not.
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
/** Named as a page, and is neither a mirrored page nor a file in this repo. */
const misattributed = []
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
    if (!mirror.some((m) => slugOf(m.file) === claim)) {
      // It named something that is not a mirrored page. That is fine when it is
      // a real file in this repo — a script, a migration, another reading — and
      // is a WRONG CITATION when it is neither. 531 attributes a quote to
      // `builds-and-schedules/overview`, which is no page and no file; the quote
      // is real but its provenance is invented, and this branch used to skip it.
      if (!fs.existsSync(m[1]) && !fs.existsSync(path.join(READINGS, m[1]))) {
        misattributed.push({ name, claim: m[1] })
      }
      continue
    }
    declared.push({ name, claim })
  }
  for (const d of declared.filter((d) => d.name === name)) {
    if (!leanedOn.has(d.claim)) unused.push({ name, claim: d.claim })
  }
  leanedOn.clear()
  declared.length = 0
}

// ── NEW MIGRATIONS, where a citation becomes SCHEMA ────────────────────────
//
// This guarded `readings/` only, and the founding failure it exists to prevent
// did not happen in a reading: `object_type_impact` was built into the schema on
// a quote that did not exist. Migrations carry ~1,150 quotations and not one was
// ever checked.
//
// ONLY THE NEW ONES. Applied migrations are immutable and run once, so a
// citation in one can be corrected forward but never edited — failing on 540
// files would be failing on a backlog nobody can fix, and a guard like that gets
// switched off. Checking what a pull request ADDS stops it getting worse, which
// is the half that is actually available.
//
// The quotation rules differ from a reading's, because a migration comment is
// prose in `--` lines rather than markdown: consecutive comment lines join, a
// blank comment line ends the paragraph (pairing quote marks across a 60-line
// header matches the prose BETWEEN two citations and reports it as one), and
// anything that looks like code is skipped.
const addedMigrations = () => {
  // BOTH forms, unioned. `origin/main...HEAD` sees what the branch has
  // committed, which is what CI has; plain `origin/main` sees the working tree,
  // which is what a migration being written right now is. Taking only the first
  // that exits 0 returned empty for uncommitted work and checked nothing —
  // found by writing a migration with an invented quote and watching it pass.
  const found = new Set()
  const collect = (args) => {
    const r = spawnSync('git', args, { encoding: 'utf8' })
    if (r.status !== 0) return
    for (const l of r.stdout.split(/\r?\n/)) {
      const f = l.trim()
      if (f.endsWith('.sql')) found.add(f)
    }
  }
  for (const base of ['origin/main...HEAD', 'origin/main']) {
    collect(['diff', '--name-only', '--diff-filter=A', base, '--', 'supabase/migrations'])
  }
  // `git diff` NEVER lists an untracked file, so the working-tree form above did
  // not in fact see "a migration being written right now" — only one already
  // staged. A new file is the commonest case there is, and it was the one this
  // checked last.
  collect(['ls-files', '--others', '--exclude-standard', '--', 'supabase/migrations'])
  return [...found]   // empty when there is no origin/main — a fork, a fresh clone
}

const sqlQuotations = (sql) => {
  const out = []
  let buf = []
  let start = 0
  const flush = () => {
    if (buf.length > 0) {
      const text = buf.join(' ').replace(/\s+/g, ' ')
      // PAIR the quote marks in order. `/"([^"]{30,})"/g` skipped a quotation
      // shorter than the minimum and then matched from ITS closing mark to the
      // next opening one — inventing a citation out of the prose BETWEEN two
      // quotes. 586 was reported for `— and name · string · required,`, which
      // no one wrote as a quotation and no page could ever contain.
      // A migration may cite a screenshot too, and until now it had no way to:
      // only readings had the `— path.png` form, while the header comment of
      // this file says screenshots carry the most weight of anything here. Same
      // rule as a reading — the file must exist on disk.
      const shot = /[—-]\s*([\w./-]+\.(?:png|jpg|jpeg|gif|svg))\s*$/.exec(text)
      const spans = text.split('"').filter((_, i) => i % 2 === 1)
      for (const span of spans) {
        const t = normalise(span)
        if (t.length < 30) continue
        if (!/[{}]|=>|import |CREATE |SELECT /.test(t)) {
          out.push({ at: start, text: t, image: shot ? shot[1] : null })
        }
      }
    }
    buf = []
  }
  sql.split(/\r?\n/).forEach((l, i) => {
    const c = /^\s*--\s?(.*)$/.exec(l)
    if (c === null) { flush(); return }
    if (c[1].trim() === '') { flush(); return }
    if (buf.length === 0) start = i + 1
    buf.push(c[1])
  })
  flush()
  return out
}

let migChecked = 0
const quotedFromUs = []
const added = addedMigrations()

/** The leading version of a migration path, or null. */
const migrationVersion = (f) => (/(\d{3}[a-z]?)_/.exec(path.basename(f)) ?? [])[1] ?? null

/** Every migration already on disk, for quotations that cite our own past. */
const earlier = fs.readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => ({
    version: migrationVersion(f) ?? '',
    // Strip the comment markers first: a sentence in a migration header wraps
    // across `--` lines, so the raw file never contains it contiguously.
    lower: normalise(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')
      .replace(/^\s*--\s?/gm, '')).toLowerCase(),
  }))
for (const file of added) {
  if (!fs.existsSync(file)) continue
  const sql = fs.readFileSync(file, 'utf8')

  // A migration's header attributes its quotes the same way a reading does, and
  // gets the same question asked of it: a name that looks like a page must BE
  // one. 531 attributed a real sentence to `builds-and-schedules/overview` —
  // no such page, no such file, and the quote itself traced fine, so nothing
  // caught it. Backticked here, since SQL comments carry paths in prose.
  for (const m of sql.matchAll(/`([a-z0-9][\w./-]*\/[\w./-]+)`/gi)) {
    const claim = slugOf(m[1])
    if (/\.(png|jpg|jpeg|gif|svg)$/i.test(claim) || claim.endsWith('/')) continue
    if (mirror.some((x) => slugOf(x.file) === claim)) continue
    if (fs.existsSync(m[1]) || fs.existsSync(path.join(READINGS, m[1]))) continue
    misattributed.push({ name: path.basename(file), claim: m[1] })
  }

  for (const q of sqlQuotations(sql)) {
    if (q.image) {
      migChecked += 1
      const onDisk = path.join(MIRROR, q.image)
      if (!fs.existsSync(onDisk) && !fs.existsSync(q.image)) {
        failures.push({
          name: file.replace(/^supabase\/migrations\//, ''),
          at: q.at,
          why: `image not on disk: ${q.image}`,
        })
      }
      continue
    }
    const parts = fragments(q.text)
    if (parts.length === 0) continue
    migChecked += 1
    for (const p of parts) {
      if (mirror.some((m) => m.lower.includes(p.toLowerCase()))) continue
      // A migration correcting an earlier one quotes what that one SAID, and
      // our own prose is in no mirrored page by construction. That is a
      // different claim from citing Foundry, so it gets a different — and still
      // verified — form: the sentence must appear verbatim in a migration that
      // already exists. It cannot smuggle a false citation past this, because
      // the earlier migration's own quotations were checked when it was added.
      const source = earlier.find((e) => e.version < (migrationVersion(file) ?? '')
        && e.lower.includes(p.toLowerCase()))
      if (source) { quotedFromUs.push({ file, at: q.at, from: source.version }); continue }
      failures.push({
        name: file.replace(/^supabase\/migrations\//, ''),
        at: q.at,
        why: `not in any mirrored page: "${p.slice(0, 90)}"`,
      })
    }
  }
}


console.log(`${readings.length} readings · ${mirror.length} mirrored pages`)
if (added.length > 0) {
  console.log(`${migChecked} quotation(s) checked in ${added.length} new migration(s)`)
}
if (quotedFromUs.length > 0) {
  // Named, never silent: an exemption nobody sees is how a guard gets hollowed.
  console.log(`${quotedFromUs.length} quotation(s) traced to an earlier migration instead: ${
    [...new Set(quotedFromUs.map((q) => q.from))].sort().join(', ')}`)
}
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

if (misattributed.length > 0) {
  console.warn(`
${misattributed.length} name(s) cited as a page that is neither mirrored nor a file here:
`)
  for (const u of misattributed) console.warn(`  ${u.name}  —  ${u.claim}`)
  console.warn('\nThe quote may be real while its provenance is invented — the failure')
  console.warn('CLAUDE.md calls the most expensive. Cite the page the sentence is ON.')
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
