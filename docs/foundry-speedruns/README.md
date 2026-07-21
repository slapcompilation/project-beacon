# Foundry Speedruns — workflow capture ledger

Companion to [FOUNDRY-PLAYBOOK.md](../FOUNDRY-PLAYBOOK.md) and the feature-by-feature
[deep-dive captures](../foundry-deep-dives/README.md). Where the deep dives take one Foundry tool at a
time, each **Speedrun** assembles those tools into a **complete end-to-end workflow** — raw data →
operational application, or PDF set → agentic answer. That makes these the reference for the question
we set out to answer: *what does a full Foundry workflow look like end to end, and does Beacon have
every mandatory step?*

The user delivers each Speedrun as exported lesson PDFs; each guide gets its own capture file here.

## Source PDFs (local-only)

Each guide's lesson pages are exported via browser print-to-PDF into `source/<NN-guide>/`, numbered in
lesson order. That folder is **gitignored** (`.gitignore` → `docs/foundry-speedruns/source/`) — the
courses are Palantir's copyrighted material; only our own condensed capture notes are committed.
Capture files cite `source PDF + page` for every claim, so any later fork decision is re-verified
against the exact source.

## Capture protocol (same non-negotiables as the deep dives, plus a workflow lens)

1. **Verbatim first, analysis second.** Record the exact steps, UI names, menu paths, parameter
   values, and screenshot contents *as given* — before any Beacon mapping.
2. **No assumption-fill.** Anything the guide doesn't show is written as `OPEN: …`, never guessed.
3. **Beacon mapping is a separate section** at the bottom of each file.
4. **Workflow-step ledger (new for speedruns).** Because a speedrun is an assembled pipeline, each
   capture ends with a **numbered list of the mandatory steps** the guide walks, and for each step a
   verdict: `✅ Beacon has it` / `⚠️ partial` / `❌ gap`. The cross-guide rollup below is the
   deliverable — the definitive check that Beacon can run every workflow Foundry teaches.

## Guides

Ordered as they appear on the Palantir Speedruns page. "Registered" = the two the user has enrolled in.

| # | Speedrun | Length | Teaches (verbatim blurb) | Capture file | Status |
|---|---|---|---|---|---|
| 1 | Your First End-to-End Workflow | 60–90m | Build an end-to-end Foundry workflow from raw data to operational application as an introduction to core platform concepts. | `01-end-to-end-workflow.md` | ⏳ awaiting PDFs |
| 2 | Your First AIP Workflow · **registered** | 60–90m | Build an operational AI-powered workflow to parse PDF media sets using Foundry's AIP components. | `02-aip-workflow.md` | ⏳ awaiting PDFs |
| 3 | Your First Agentic AIP Workflow | ~60m | Leverage AIP and the Ontology for an agentic workflow and AIP-human teaming. | `03-agentic-aip-workflow.md` | ⏳ awaiting PDFs |
| 4 | Your First Ontology Function | 45–60m | Develop TypeScript-based Functions to pull data from and update Ontology Objects via a Workshop app. | `04-ontology-function.md` | ⏳ awaiting PDFs |
| 5 | Mining Your First Business Process | 60–90m | Use Foundry's Machinery application to visualize business processes, identify bottlenecks, and create alerts. | `05-business-process-mining.md` | ⏳ awaiting PDFs |

## Why each guide matters to Beacon (pre-capture hypothesis — confirm/revise against the PDFs)

- **1 · End-to-End** — the canonical mandatory-step spine (ingest → pipeline → ontology → app). The
  master checklist every other guide is a specialization of.
- **2 · AIP / parse PDF media sets** — directly overlays our doc-ingestion arc (Tracks 1+2, document
  copilot, reverse lineage). The sharpest test of whether our parse→embed→entity→answer path is
  Foundry-complete.
- **3 · Agentic AIP + human teaming** — maps to our agent framework (blocks, numbered task prompts,
  `request_clarification`, trace-as-surface) and the approval boundary.
- **4 · Ontology Function via Workshop** — their Logic-Tool-plus-Action-in-an-app loop; tests our
  Logic Tool Registry + Action Registry dual-callable story end to end.
- **5 · Machinery / business-process mining** — process visualization, bottleneck detection, alerts →
  our monitors (metric+trigger), constraint engine, and intelligence cycle.

## Cross-guide mandatory-step rollup

_Filled in once the captures land — the consolidated table of every mandatory workflow step across all
five speedruns and Beacon's coverage verdict for each._
