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
Guide 6 is a conceptual intro course (not a hands-on speedrun) the user added — it supplies the
mandatory-*capability* checklist the five hands-on speedruns are assembled from.

| # | Speedrun | Length | Teaches (verbatim blurb) | Capture file | Status |
|---|---|---|---|---|---|
| 1 | Your First End-to-End Workflow | 60–90m | Build an end-to-end Foundry workflow from raw data to operational application as an introduction to core platform concepts. | [`01-end-to-end-workflow.md`](01-end-to-end-workflow.md) | ✅ captured 2026-07-21 · 13/13 |
| 2 | Your First AIP Workflow · **registered** | 60–90m | Build an operational AI-powered workflow to parse PDF media sets using Foundry's AIP components. | [`02-aip-workflow.md`](02-aip-workflow.md) | ✅ captured 2026-07-21 · 12✅/1⚠️ |
| 3 | Your First Agentic AIP Workflow | ~60m | Leverage AIP and the Ontology for an agentic workflow and AIP-human teaming. | [`03-agentic-aip-workflow.md`](03-agentic-aip-workflow.md) | ✅ captured 2026-07-21 · 13/13 |
| 4 | Your First Ontology Function | 45–60m | Develop TypeScript-based Functions to pull data from and update Ontology Objects via a Workshop app. | [`04-ontology-function.md`](04-ontology-function.md) | ✅ captured 2026-07-21 · 11/11 |
| 5 | Mining Your First Business Process | 60–90m | Use Foundry's Machinery application to visualize business processes, identify bottlenecks, and create alerts. | [`05-business-process-mining.md`](05-business-process-mining.md) | ✅ captured 2026-07-21 · 6✅/1⚠️/4❌ |
| 6 | Introduction to Foundry for Enterprise Organizations · **concepts** | ~22 lessons | Conceptual foundations — mission, architecture, the three pillars, progressive automation, evals, governance. No hands-on steps. | [`06-intro-enterprise.md`](06-intro-enterprise.md) | ✅ captured 2026-07-21 |

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
- **6 · Enterprise Intro (concepts)** — the mandatory-*capability* checklist: Ontology-centered three
  pillars, LLM-orchestrates-deterministic-logic, agents-in-process, evals-gated progressive
  automation, branching + runtime two-axis governance, full audit.

## Cross-guide mandatory-step rollup — the verdict

All six captured (2026-07-21). The five hands-on speedruns contribute **57 mandatory workflow steps**;
Beacon covers **51 ✅ fully, 2 ⚠️ partial, 4 ❌ missing.** The concept course (guide 6) scored the
capability checklist at 19✅/4⚠️/2❌ over 24 in-scope capabilities. Read together, the picture is
unambiguous:

**Guides 1–4 are Beacon's architecture, step for step.** The end-to-end spine (ingest → pipeline →
ontology → action → app), the PDF→chunk→embed→entity→OAG→graph pipeline, the agent→eval→automate loop,
and functions-on-objects→function-backed-action are the exact patterns in `CLAUDE.md`. Every mandatory
step in guides 1, 3, 4 is ✅ (13/13, 13/13, 11/11); guide 2 is 12✅ with the lone ⚠️ being an OCR
fallback for scanned PDFs. Several steps Beacon does *better* (dual-callable Logic Tools; eval-gated
release before automate).

**Two forks the deep dives left open are now settled by guide 2:**
- **P5 (embed target) → embed the summary.** Foundry embeds the LLM `summary` column, not the raw
  chunk — exactly what Beacon does. Settled.
- **P6 (entity categories) → a prompt-level enum.** Foundry injects a fixed category taxonomy into the
  extraction prompt (5 medical categories). Our hospitality analog is a prompt constant, not a schema
  change.

**The gaps cluster into exactly two named backlog items — no scattered holes:**

| Gap | From | What's missing | Substrate we already hold | Proposed item |
|---|---|---|---|---|
| **Process mining** | Guide 5 (Machinery) | Turn the lifecycle transition log into per-state count/duration/throughput + per-transition lead-time + path explorer + bottleneck discovery | ✅ state machines (`LIFECYCLES`), ✅ enforcement (`enforce_lifecycle`), ✅ alerting (monitors + cycle), ✅ graph UI (`SearchAroundGraph`) — missing only a transition **event log** + the analytics layer | **P11: Process Mining** |
| **Sensitivity governance** | Guide 6 (concepts) + deep-dive sessions 6 & 9 | Data markings/classifications that propagate Document→chunk→entity→proposal and survive being passed to an LLM; purpose-based access controls | ✅ provenance edges, ✅ scope/role RLS | **P8: Sensitivity/PII marking** (already parked, now confirmed 3× — promote) |

Everything else Foundry teaches as mandatory, Beacon has. The two remaining items are additive layers
on substrate we already own — the recurring "audit finds the thin missing layer, not a rearchitecture"
pattern. **P11 is the higher-value, lower-cost of the two** (we hold four of its five pieces) and is
the natural next build; **P8** rides on the governance thread the deep dives already flagged.

Deliberate non-goals (scored ❌ nowhere because they're out of scope for a vertical product): OSDK for
third-party developers, Multimodal Data Plane federation, Apollo multi-environment delivery — all
horizontal-platform scale-infrastructure (see guide 6 ledger).
