# Substrate reference

`../foundry-reference/` says **what** to build. This says what we can build it
**with**.

It exists because guessing at the substrate cost real work. Twice in one day I
reasoned about Supabase from memory instead of evidence: once producing a
design that changed what a Foundry concept *is* (function logic as SQL), and
once writing "no isolate is available on this platform" into a reading as
fact — when WebAssembly had been there the whole time, and the docs say so.
`functions/limits.md` states outright that "Web Worker API (or Node `vm` API)
are not available", which is the exact thing that cost a design cycle to
discover by probing.

## The corpus

- `all-supabase-urls.txt` — every guide page in the sitemap (653).
- `mirror/<section>/<page>.md` — the authors' own markdown, dated, for the ten
  sections that bear on this build: functions, database, api, cron, queues,
  realtime, security, storage, auth, platform (439 pages).

Refresh with `node scripts/mirror-substrate-docs.mjs [--refresh] <section>…`,
or `--urls` to re-read the sitemap.

## The rule that makes this useful

**A mirrored page is a candidate, not a proof.** The docs describe the
product; we run one deployment of it, on one plan, at one version, behind
whatever flags our project has. Two failure modes, both real here:

- *Documented but absent* — the page describes a capability our instance does
  not expose.
- *Absent from the docs but present* — WebAssembly worked before I found the
  page that says it is supported.

So: **grep the mirror to find the candidate, probe our own project to confirm
it**, and mark which one a claim rests on. `readings/substrate-capabilities.md`
carries that mark for every capability we depend on.
