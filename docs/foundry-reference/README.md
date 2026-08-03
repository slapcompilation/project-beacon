# Foundry reference

A working reference to Palantir Foundry's own documentation, for when we need to
check how Foundry actually maps a concept before mirroring it in Beacon. Companion
to `docs/foundry-deep-dives/` and `docs/foundry-speedruns/` (those are captured
walkthroughs; this is the docs map + selected source text).

## What's here

- **[`INDEX.md`](./INDEX.md)** — Foundry doc URLs grouped by capability (from the 3,696-URL sitemap pass; the flat list below is now larger)
  area. The navigable map: find the section, drill in.
- **[`all-foundry-urls.txt`](./all-foundry-urls.txt)** — the same URLs as a flat list.
  `grep` it to jump straight to the page for a topic.
- **`mirror/`** — full text of the load-bearing conceptual sections, saved as markdown
  so they're searchable offline. Curated, not the whole site — API reference and
  localized trees are left as links in the index. **438 pages** across:
  ontology core (`ontologies`, `ontology`, `ontology-manager`, `action-types`,
  `object-views`, `object-monitors`, `object-link-types`, `interfaces`, `logic`,
  `object-edits`, `functions`) + pipelines (`data-integration`, `building-pipelines`,
  `pipeline-builder`) + **application building (`workshop`, `app-building`, 127 pages,
  2026-08-03)**. Grep `mirror/` for a concept; each file carries its source URL.

  Add or refresh a section with **`node scripts/mirror-foundry-docs.mjs <section>`**.
  It reads each page's own source markdown out of `__NEXT_DATA__` rather than
  converting HTML, so what lands is what the authors wrote.

## Two sources, because the sitemap is incomplete

`all-foundry-urls.txt` merges the sitemap pass (3,696) with a **link crawl** of
`ontology`, `dev-toolchain`, `app-building`, `observability`, `analytics`,
`devops`, `security` and `administration` (3,763 reachable pages, 2026-07-30).

The crawl found **1,063 URLs the sitemap never listed** — 218 under `quiver`
alone — and the sitemap holds ~996 the crawl cannot reach from those eight roots.
Neither source is complete on its own, which is why both are merged.
`ontology/ontology-structural-guidance`, which settled the object-backed-link
question, was missing from the sitemap pass entirely. **Do not treat the index as
exhaustive.**

## How it's kept honest

- Source: `https://www.palantir.com/docs/sitemap.xml`, fetched 2026-07-23. Docs drift;
  treat mirrored text as a dated snapshot and re-fetch a page when precision matters.
- The public sitemap is capped at 5,000 entries and skews to API + localized pages, so
  the English conceptual URLs were recovered by stripping `zh`/`jp`/`kr` locale prefixes
  to their canonical form.
- This is for our own reference while building — not for redistribution.

## Two ways to use it

1. **On-demand** — for a one-off doubt, fetch the specific page live (freshest, no upkeep).
2. **Mirror** — for sections we cross-reference repeatedly, read `mirror/` offline.
