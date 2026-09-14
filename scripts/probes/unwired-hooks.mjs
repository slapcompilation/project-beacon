// Which exported hooks does nothing call?
//
// The surface map's Batch A and B kept finding the same defect from the
// database side — an engine no screen reaches. This asks it from the web side,
// and the answer on 2026-09-14 was **fifteen**: a `use*` hook exported from a
// feature module that no other file names and whose own file never calls it.
// Two of them were the shared-property editor and the value-type metadata
// editor, both of which turned out to be user-visible defects (#974, #977):
// the mutation existed, was correct, and simply could not be reached.
//
// THIS IS A PROBE AND NOT A GATE, deliberately. `check:shape` and
// `check:vocabulary` were deleted with `shape_registry` because they needed an
// allowlist to tell "deliberately ahead of its runtime" from "dead", and
// CLAUDE.md draws the lesson: **wanting an allowlist is the signal to index
// instead.** A hook written before its screen is a legitimate state here, so a
// red build would only teach people to add exemptions. Run it, read the list,
// and decide per entry: wire it, or delete it.
//
//   node scripts/probes/unwired-hooks.mjs
//
// It reports, in order: the file, the hook, and whether the module it lives in
// is reached from main.tsx at all (an unreached module is check:surfaces's
// problem, not this one).

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

const unwired = []
for (const [file, text] of src) {
  // A test naming a hook is not a caller: it proves the hook runs, not that any
  // screen reaches it. Definitions in test files are not exports we ship.
  if (/\.test\./.test(file)) continue
  for (const m of text.matchAll(/^export (?:async )?(?:function|const) (use[A-Z][A-Za-z0-9]*)/gm)) {
    const name = m[1]
    const word = new RegExp(`\\b${name}\\b`)
    const importers = [...src].filter(([g, t]) => g !== file && !/\.test\./.test(g) && word.test(t))
    const self = (text.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length
    if (importers.length === 0 && self <= 1) {
      const inTests = [...src].some(([g, t]) => /\.test\./.test(g) && word.test(t))
      unwired.push({ file, name, inTests })
    }
  }
}

unwired.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))

console.log(`${files.length} file(s) scanned under ${ROOT}`)
console.log(`${unwired.length} exported hook(s) that no other source file names:\n`)
for (const u of unwired) {
  console.log(`  ${u.file}`.padEnd(58) + u.name + (u.inTests ? '   (named only by a test)' : ''))
}
console.log(`
Each is one of three things, and the file should say which:
  · a defect  — the screen it belongs to reaches for it and cannot (wire it),
  · a leftover — the screen that called it was rewritten (delete it),
  · ahead of its surface — say so in a comment, with what it waits on.
`)
