# Foundry Deep Dives — capture ledger

Follow-on to [FOUNDRY-PLAYBOOK.md](../FOUNDRY-PLAYBOOK.md). The user delivers each Palantir deep-dive
session (steps + screenshots) in order; each gets its own capture file here.

## Capture protocol (non-negotiable)

1. **Verbatim first, analysis second.** Each file records the session's exact steps, UI names, menu
   paths, parameter values, and screenshot contents *as given* — before any Beacon mapping.
2. **No assumption-fill.** Anything the session doesn't show is written as `OPEN: …`, never guessed.
   An OPEN item is a question for the user or a later session — not a blank to improvise over.
3. **Beacon mapping is a separate section** at the bottom of each file (what it confirms / changes /
   adds in the playbook scorecard, the doc-ingestion spec P1–P10, or the build backlog).
4. **After each session:** update the status table below + fold verdict changes back into
   [FOUNDRY-PLAYBOOK.md](../FOUNDRY-PLAYBOOK.md) and
   [DOCUMENT-INGESTION-ROADMAP.md](../DOCUMENT-INGESTION-ROADMAP.md).

## Sessions

| # | Session | Length | Capture file | Status | Expected to inform |
|---|---|---|---|---|---|
| 1 | Creating Your First Ontology | 60–90m | [`01-ontology.md`](01-ontology.md) | ✅ captured 2026-07 | **P6 partially settled**: PK discipline (deterministic, never random), title rule (Chunk=summary, Entity=entityName), declare cardinality as modeled + both-direction traversal names. Still open: entity categories. Confirms Action Registry + Proposal-flywheel parity |
| 2 | Building Your First Pipeline | 60–90m | `02-pipeline-builder.md` | ⬜ pending | **P1–P5** ingest transforms (chunking, LLM struct, embed target); pipeline best practices |
| 3 | Transforming data with Code Repositories | 60m | `03-code-repositories.md` | ⬜ pending | our code-as-ontology stance vs their pro-code path; CI/branch parity claims |
| 4 | Building Your First Application (Workshop) | 60–90m | `04-workshop.md` | ⬜ pending | P9/P10 surfaces; variables/widgets grammar; NL-authoring leapfrog scope |
| 5 | Creating Your First Data Connection | 45–60m | `05-data-connection.md` | ⬜ pending | data-integration parity (sources, sync, health) — [project_data_integration_parity] |
| 6 | Governance — Security Primitives | 45–60m | `06-security-primitives.md` | ⬜ pending | markings/restricted views vs our RLS + scope model; multi-tenant echelon |
| 7 | Data Analysis in Contour | 60–90m | `07-contour.md` | ⬜ pending | tabular analysis surface — do we need one, or do Insights lenses cover it |
| 8 | Data Analysis in Quiver | 60–90m | `08-quiver.md` | ⬜ pending | object-centric analysis; Vertex/Search-Around adjacency (backlog #2/#4) |
| 9 | Data Protection Tools | 45–60m | `09-data-protection.md` | ⬜ pending | download controls / scans / obfuscation vs our audit + advisor posture |

## Standing decisions parked on these sessions

- **P5 fork** — embed the per-chunk `summary` (Foundry-exact) vs full chunk text → session 2.
- **P6 fork** — Chunk + Entity as first-class node types; hospitality entity categories → session 1.
- **P7 fork** — resolution layer placement (`Entity —resolved_to→ Variant/Supplier`) → sessions 1 + 2.

Execution of the doc-ingestion spec (Track 1, P1–P4) starts after the forks are settled.
