#!/usr/bin/env node
// Proves production serves the expected commit: fetch the site, read the
// <meta name="beacon-build"> the build baked in, compare to --sha.
// --wait N polls up to N minutes (Vercel builds take a few). Exit 1 on
// mismatch or timeout — "merged" is not "deployed" until this passes.
//
//   node scripts/verify-deploy.mjs --sha <full-sha> [--site URL] [--wait 12]

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : null)).filter(Boolean),
)
const site = args.site ?? 'https://project-beacon-web.vercel.app'
const expected = args.sha
const waitMin = Number(args.wait ?? 0)
if (!expected) { console.error('usage: verify-deploy.mjs --sha <sha> [--site URL] [--wait minutes]'); process.exit(2) }

const deadline = Date.now() + waitMin * 60_000
for (;;) {
  let served = '(fetch failed)'
  try {
    const html = await (await fetch(site, { headers: { 'cache-control': 'no-cache' } })).text()
    served = /name="beacon-build" content="([^"]*)"/.exec(html)?.[1] ?? '(no beacon-build meta — pre-gate build)'
  } catch (e) { served = `(fetch failed: ${e.message})` }

  if (served === expected) { console.log(`OK — production serves ${expected}`); break }
  if (Date.now() >= deadline) {
    console.error(`FAIL — expected ${expected}, production serves: ${served}`)
    process.exitCode = 1
    break
  }
  console.log(`waiting… production serves: ${served}`)
  await new Promise((r) => setTimeout(r, 20_000))
}
