# The docs, and what each one is for

Twenty-nine files had accumulated with no index, several describing work that
finished weeks ago and two describing a direction we have since taken the other
way. This is the spine: **what is live, what is open, and what is a record of
something already done.**

`CLAUDE.md` at the repo root is the enforceable spec and outranks everything
here. These are the maps and the working notes.

## Status means

- **LIVE** — describes how the system works now, or a decision still in force.
  Change it when the system changes.
- **OPEN** — work scoped but not finished. The backlog.
- **RECORD** — finished. Kept because the reasoning is worth having, not because
  anything is pending. Do not plan from these.

---

## Start here

| doc | status | what it is |
|---|---|---|
| [DELIVERABLE-MAP.md](./DELIVERABLE-MAP.md) | LIVE | **What to build next, in dependency order.** Verified against code, not against the other docs — it corrects three of them. Start here for sequencing. |
| [CAPABILITY-CHAIN.md](./CAPABILITY-CHAIN.md) | LIVE | **How everything connects.** Every layer consumes the one below and adds exactly one thing. The dependency graph, one need traced end to end, and what is left. |
| [DIVERGENCES.md](./DIVERGENCES.md) | LIVE | **Where we deliberately differ from Foundry**, each with the mirrored citation and the condition that undoes it. |
| [foundry-reference/](./foundry-reference/) | LIVE | 438 mirrored pages + the URL index. **Grep here before designing anything.** `node scripts/mirror-foundry-docs.mjs <section>` adds more. |
| [ROADMAP.md](./ROADMAP.md) | LIVE | The north star and the phase history. |

## Live specs

| doc | status | what it is |
|---|---|---|
| [WORKSHOP-PLAN.md](./WORKSHOP-PLAN.md) | LIVE | Application building, W1–W7 + G1. The phases shipped; the file stays live because it is where Workshop's copied semantics and limits are written down. |
| [FOUNDRY-PLAYBOOK.md](./FOUNDRY-PLAYBOOK.md) | LIVE | The end-to-end Foundry tutorial, consolidated. Reference. |
| [FOUNDRY-CAPABILITY-AUDIT.md](./FOUNDRY-CAPABILITY-AUDIT.md) | LIVE | A systematic walk of Foundry's capabilities in its own docs order. The source the implementation map was built from. |
| [ENGINEERING-HANDBOOK.md](./ENGINEERING-HANDBOOK.md) | LIVE | Deltas from CLAUDE.md — how we work, not what we build. |
| [GENERATED-OBJECT-VIEWS.md](./GENERATED-OBJECT-VIEWS.md) | LIVE | Object Views generated from registration. Still how new node types get a page. |
| [CONTRACT-MODEL.md](./CONTRACT-MODEL.md) | LIVE | The contract shape, tested against a real Greek supply agreement. Waiting on a real invoice/PO to finish the reconciliation half. |
| [STUDIO-AUTHORING-PLAN.md](./STUDIO-AUTHORING-PLAN.md) | LIVE | "Copy what Foundry IS" — the direction W6 and W7 executed. |

## Open

| doc | status | what is left |
|---|---|---|
| [PREDICTION-COHERENCE-ROADMAP.md](./PREDICTION-COHERENCE-ROADMAP.md) | OPEN | Q5 only — prove it, close the loop visibly. Q0–Q4 shipped. |
| [AIP-OPERATE-INLINE.md](./AIP-OPERATE-INLINE.md) | OPEN | P1: the row badge and slide-over. P0 signal spine shipped. |
| [DOCUMENT-INGESTION-ROADMAP.md](./DOCUMENT-INGESTION-ROADMAP.md) | OPEN | Ingestion stops at `ocr`; the later stages are unbuilt. |
| [OPERATIONS-RESTRUCTURE.md](./OPERATIONS-RESTRUCTURE.md) | OPEN | Spec for review, not built. |
| [STUDIO-RESTRUCTURE.md](./STUDIO-RESTRUCTURE.md) | OPEN | Ontology/applications split; partially delivered by the Studio IA work. |
| [AUTOMATE-COMPOSER-SPEC.md](./AUTOMATE-COMPOSER-SPEC.md) | OPEN | Demand-gated. Records the signals we are watching for. |
| [ONTOLOGY-PARITY-GAPS.md](./ONTOLOGY-PARITY-GAPS.md) | OPEN | Interfaces and shared properties remain; the two-ontology split closed. |
| [OPTIMIZATION-ROADMAP.md](./OPTIMIZATION-ROADMAP.md) | OPEN | The monitor metric/trigger pattern generalised to other detectors. |

## Records — finished, kept for the reasoning

| doc | what it recorded |
|---|---|
| [IMPLEMENTATION-MAP.md](./IMPLEMENTATION-MAP.md) | Every gap from the capability audit, ordered by dependency. **Closed.** |
| [SHAPE-AUDIT-ROADMAP.md](./SHAPE-AUDIT-ROADMAP.md) | The 285-migration sweep and the shape ratchet it produced. Items A–E done. |
| [APP-BUILDING-GAP.md](./APP-BUILDING-GAP.md) | The gap analysis that led to the Workshop arc. Delivered by WORKSHOP-PLAN. |
| [LINK-TYPE-AUDIT.md](./LINK-TYPE-AUDIT.md) | Input to the link-type work; one edge type per relationship, DB-enforced. |
| [LEGACY-REDUCTION-AUDIT.md](./LEGACY-REDUCTION-AUDIT.md) | The July surface triage. |
| [SCALE-TEST.md](./SCALE-TEST.md) | A dated load result — 50 hotels ≈145s, near the 150s edge timeout. |
| [AIP-RESTRUCTURE.md](./AIP-RESTRUCTURE.md) | The dock → destinations IA decision. |
| [AIP-UX-RESTRUCTURE.md](./AIP-UX-RESTRUCTURE.md) | The parity board; Phases 0–3 delivered. |
| [AIP-PARITY-ROADMAP.md](./AIP-PARITY-ROADMAP.md) | The earlier parity plan the capability audit superseded. |

---

## The guards these docs cannot replace

Prose rots; the gates do not. Before trusting anything above, the machine checks
are what actually hold:

| command | catches |
|---|---|
| `pnpm check:shape` | a table or function nothing reaches |
| `pnpm check:vocabulary` | a CHECK value no code, data or declaration consumes |
| `pnpm check:modules` | a module reference held by name in jsonb that points nowhere |
| `pnpm check:rpcs` | an RPC name the app calls that does not exist |
| `pnpm check:edge` | edge functions that do not parse |
| `pnpm db:contracts` | RLS and security invariants, including cross-hotel scope |
