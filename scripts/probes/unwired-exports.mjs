// Which exported hooks and components does nothing call?
//
// The surface map's Batch A and B kept finding the same defect from the
// database side — an engine no screen reaches. This asks it from the web side,
// and the answer on 2026-09-14 was **fifteen**: a `use*` hook exported from a
// feature module that no other file names and whose own file never calls it.
// Two of them were the shared-property editor and the value-type metadata
// editor, both of which turned out to be user-visible defects (#974, #977):
// the mutation existed, was correct, and simply could not be reached.
//
// IT USED TO LOOK ONLY AT HOOKS, AND THAT WAS A HOLE. Batch C found
// `WidgetConfigPanel` — Workshop's whole right-hand settings panel, written,
// exported and imported by nothing — and this probe could not see it, because
// it is a component. The map recorded the blind spot in §4 and predicted the
// fix would be "easy to widen the pattern and hard to widen the judgement".
// The judgement turned out fine: widening to exported PascalCase components
// reports **two** across 141 files, not a wall of noise. Both are real.
//
// The first attempt reported 79, which was a broken detector and not 79
// orphans — the word-boundary regex had been mangled by shell escaping, so
// nothing matched its importers and everything looked orphaned. Written to a
// file instead of an inline `node -e`, the same logic gives two. **A probe
// that reports most of the codebase is measuring itself.**
//
// THIS IS A PROBE AND NOT A GATE, deliberately. `check:shape` and
// `check:vocabulary` were deleted with `shape_registry` because they needed an
// allowlist to tell "deliberately ahead of its runtime" from "dead", and
// CLAUDE.md draws the lesson: **wanting an allowlist is the signal to index
// instead.** A hook written before its screen is a legitimate state here, so a
// red build would only teach people to add exemptions. Run it, read the list,
// and decide per entry: wire it, or delete it.
//
//   node scripts/probes/unwired-exports.mjs
//
// It reports, in order: the file, the export, and whether a test is the only
// thing that names it (which proves the code runs, not that a screen reaches
// it).

import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'apps/web/src'

const files = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p.split(path.sep).join('/'))
  }
})(ROOT)

const src = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]))

// A hook is `useThing`; a component is `Thing`. A SCREAMING_CONST is neither —
// requiring a lowercase second letter drops `OPTIONS` and `DEFAULT_ROLES`
// without needing to know what they are.
const kindOf = (name) =>
  /^use[A-Z]/.test(name) ? 'hook' : /^[A-Z][a-z]/.test(name) ? 'component' : null

const unwired = []
for (const [file, text] of src) {
  // A test naming an export is not a caller: it proves the export runs, not
  // that any screen reaches it. Definitions in test files are not shipped.
  if (/\.test\./.test(file)) continue
  for (const m of text.matchAll(/^export (?:async )?(?:function|const) ([A-Za-z][A-Za-z0-9]*)/gm)) {
    const name = m[1]
    const kind = kindOf(name)
    if (!kind) continue
    const word = new RegExp(`\\b${name}\\b`)
    const importers = [...src].filter(([g, t]) => g !== file && !/\.test\./.test(g) && word.test(t))
    const self = (text.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length
    if (importers.length === 0 && self <= 1) {
      const inTests = [...src].some(([g, t]) => /\.test\./.test(g) && word.test(t))
      unwired.push({ file, name, kind, inTests })
    }
  }
}

unwired.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))

const n = (k) => unwired.filter((u) => u.kind === k).length
console.log(`${files.length} file(s) scanned under ${ROOT}`)
console.log(`${unwired.length} exported symbol(s) that no other source file names — ${n('hook')} hook(s), ${n('component')} component(s):\n`)
for (const u of unwired) {
  console.log(`  ${u.file}`.padEnd(58) + `${u.name} (${u.kind})` + (u.inTests ? '   [named only by a test]' : ''))
}
console.log(`
Each is one of three things, and the file should say which:
  · a defect  — the screen it belongs to reaches for it and cannot (wire it),
  · a leftover — the screen that called it was rewritten (delete it),
  · ahead of its surface — say so in a comment, with what it waits on.
`)
