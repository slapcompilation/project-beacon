# Foundry reference

A working reference to Palantir Foundry's own documentation, for when we need to
check how Foundry actually maps a concept before mirroring it in Beacon. Companion
to `docs/foundry-deep-dives/` and `docs/foundry-speedruns/` (those are captured
walkthroughs; this is the docs map + selected source text).

## What's here

- **[`INDEX.md`](./INDEX.md)** — every Foundry doc URL (3,696), grouped by capability
  area. The navigable map: find the section, drill in.
- **[`all-foundry-urls.txt`](./all-foundry-urls.txt)** — the same URLs as a flat list.
  `grep` it to jump straight to the page for a topic.
- **`mirror/`** — full text of the load-bearing conceptual sections, saved as markdown
  so they're searchable offline. Curated, not the whole site — API reference and
  localized trees are left as links in the index. **311 pages (2026-07-23)** across:
  ontology core (`ontologies`, `ontology`, `ontology-manager`, `action-types`,
  `object-views`, `object-monitors`, `object-link-types`, `interfaces`, `logic`,
  `object-edits`, `functions`) + pipelines (`data-integration`, `building-pipelines`,
  `pipeline-builder`). Grep `mirror/` for a concept; each file carries its source URL.

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
