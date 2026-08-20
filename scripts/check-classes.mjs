// Every class a component names has to exist in the stylesheet.
//
// There is no Tailwind here and no build step — "No Tailwind. Slate styles
// Blueprint with CSS … so ours live in apps/web/src/styles/globals.css" — so a
// Tailwind-shaped class nobody wrote a rule for is an inert string. It does not
// fail to compile, it does not warn, it just silently does nothing.
//
// The utilities block says of itself "Hand-written, and generated once from the
// classes this app actually uses". Generated ONCE is the whole problem: by the
// time this guard was written, 88 class names had been added with no rule
// behind them, across 139 sites — among them `overflow-x-auto` on a wide panel
// and `!border-violet-400`, which was the object types list's entire selected
// state.
//
// The compiler cannot do this job, because className is a string. That is the
// test CLAUDE.md sets for whether a guard should exist.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'apps/web/src'
const CSS = path.join(ROOT, 'styles/globals.css')

const css = fs.readFileSync(CSS, 'utf8')
// A selector in the stylesheet: `.foo`, `.\!p-0`, `.w-1\.5`, `.dark .bp6-x`.
const defined = new Set()
for (const m of css.matchAll(/\.((?:\\.|[\w-])+)/g)) defined.add(m[1].replace(/\\/g, ''))

const files = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) files.push(p)
  }
})(ROOT)

const used = new Map()
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const blobs = []
  for (const m of src.matchAll(/className\s*=\s*"([^"]*)"/g)) blobs.push(m[1])
  for (const m of src.matchAll(/className\s*=\s*\{([\s\S]*?)\}\s*(?:\/?>|\s[\w-]+=)/g)) {
    // A string on the right of a comparison is an operand, not a class —
    // `e.edge === 'link_type' ? …` names an edge kind, not a rule.
    const expr = m[1].replace(/[=!]==?\s*['"`][^'"`]*['"`]/g, '')
    for (const q of expr.matchAll(/['"`]([^'"`$]*)['"`]/g)) blobs.push(q[1])
  }
  for (const blob of blobs) {
    for (const tok of blob.split(/\s+/)) {
      if (!tok || !/^!?[a-z][\w:./[\]#%-]*$/i.test(tok)) continue
      if (!used.has(tok)) used.set(tok, new Set())
      used.get(tok).add(f)
    }
  }
}

// Blueprint ships its own; the rest are real state hooks with no rule of ours.
const KNOWN = /^(bp6-|bp5-|dark$|group$|peer$|sr-only$)/
const dead = []
for (const [tok, where] of used) {
  const bare = tok.replace(/^!/, '')
  if (KNOWN.test(bare) || defined.has(bare) || defined.has(tok)) continue
  dead.push([tok, [...where].sort()])
}
dead.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))

const sites = dead.reduce((a, d) => a + d[1].length, 0)
console.log(`${used.size} class(es) named in ${files.length} component file(s)`)
console.log(`${defined.size} defined in ${CSS}`)

if (dead.length === 0) {
  console.log('every class a component names has a rule behind it')
  process.exit(0)
}

console.error(`\n${dead.length} class(es) with no rule, across ${sites} site(s):\n`)
for (const [tok, where] of dead.slice(0, 30)) {
  console.error(`  ${tok}`)
  for (const f of where.slice(0, 3)) console.error(`      ${f}`)
  if (where.length > 3) console.error(`      …and ${where.length - 3} more file(s)`)
}
if (dead.length > 30) console.error(`  …and ${dead.length - 30} more class(es)`)
console.error(`
A class with no rule does not fail to compile and does not warn — it silently
does nothing. Add the rule to globals.css, or use one of the tokens that exists;
colours come from Blueprint's palette through our tokens, never from a Tailwind
palette name.`)
process.exit(1)
