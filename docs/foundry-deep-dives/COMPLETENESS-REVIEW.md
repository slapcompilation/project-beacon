# Deep-dive captures — completeness re-parse (2026-07-21)

A second full pass over all nine source PDFs (`source/<NN>/`) against their capture files, to
confirm nothing load-bearing was missed. Requested bar: flag anything, "even if trivial."

## Method

Every lesson PDF was re-extracted to text and read against its capture. Sessions 1–2 had already
been cross-verified during initial capture (two minor recoveries folded in then). This pass re-read
3–5 in full, confirmed every source lesson in 6–9 is represented in its capture, and close-read the
meta/recap lessons in the feature-dense sessions (Quiver Configurations + Review Your Logic, Contour
Recap) where a glossed capability was most likely to hide.

## Verdict: captures are complete at the lesson level

Every lesson across all nine sessions is represented, and every load-bearing concept, step, parameter
value, and fork-relevant detail is in the captures. **No substantive gap was found** — nothing that
changes a Beacon verdict, a Track-2 fork, or the build backlog.

The captures are condensed-by-design ("in our words" with a Beacon-mapping section), so they
intentionally omit trivia that doesn't affect our understanding. The re-parse surfaced only that
class of omission:

| Session | Trivial-only omissions (do not affect any verdict) |
|---|---|
| 3 · Code Repos | exact aggregation alias `avg_claim_cost`; the "add ancestors to the lineage graph via the little arrow on the node" tip; the amber "new commit … may conflict" bar reappears in the Create-Transform lesson too |
| 4 · Workshop | exercise-specific data values (e.g. "April 24th has the most arrivals"); the note that sections can be resized by maximising the window / zoom |
| 5 · Data Connection | per-connector "Learn more" doc links; the sandbox URLs/credentials (deliberately omitted for copyright/secrecy) |
| 6 · Security | the exact course group name convention; the Discoverer-role wording nuance already captured |
| 7 · Contour | numeric answers to the inspection exercises; the exact board-toolbar "Display as categories" vs "Actions" default toggle (captured as a nav tip) |
| 8 · Quiver | the config panel's exact tab order (Data/Display/Type/Objects/Export — now noted); "New Quiver" toggle already flagged OPEN |
| 9 · Data Protection | the exact acknowledgment wording; Cipher cryptosystem "Probabilistic + Key Derivation" already captured |

## What this means

The nine captures + the playbook + the doc-ingestion roadmap remain the reliable record. The
Foundry-parity build (Tracks 1+2, document copilot, reverse lineage, Search Around) rests on complete
notes. The upcoming **Speedrun** discussion — what a full end-to-end workflow looks like and whether
Beacon has all the mandatory steps — can proceed against these captures without a coverage gap to
worry about.

All OPEN items from the original captures remain open (they were unknowns in the source, not
omissions): Foundry-branches-vs-repo-branches, Code Workspaces, the Dataset join-method for link
types, Quiver time-series/forecast + writeback, Vertex simulation, and the export/writeback paths
deferred by the source courses themselves.
