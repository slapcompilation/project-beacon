# Engineering Handbook — the deltas

Status: **adopted, 2026-07**. CLAUDE.md is the enforceable spec (ontology,
tools, actions, agents, scope, evals). This doc holds ONLY what CLAUDE.md does
not already cover — distilled from an external "Software Development Protocol"
draft and the Foundry ontology deep-dive walkthrough, minus everything those
sources shared with what we already enforce.

## 1. Typed lifecycles — no vague status fields

Every stateful node declares its legal transitions; actions are the only
transition operators.

```
PurchaseOrder: draft → pending_approval → approved → sent → received → closed
```

Today `Proposal`, `PurchaseOrder`, `Case`, and `RestockRequest` carry status
strings whose transitions are implied by whichever action happens to write
them. The target: each node type declares its state machine in
`packages/reality-graph`, and action submission criteria reject illegal
transitions (`REJECT_RESTOCK` on a `closed` request fails validation, not
review). Tracked as backlog item A8.

## 2. The surface is part of reality

Lesson paid for in July 2026: the map was ontologically perfect for a week —
tiles serving, actions audited, zero console errors — while operators saw a
0-pixel-tall black box (PRs #310–#314). A system can be correct and invisible.

- Decision-critical surfaces ship a smoke test: the thing renders at nonzero
  size, its interactive elements exist, the console is clean.
- A production deploy isn't done until the served bundle is verified to
  contain the change (curl the chunk, grep the marker — not "the build is green").
- Debugging playbook for "it's blank but the network is healthy": measure the
  DOM first — wrapper size, canvas size, marker count, WebGL — one console
  snippet before any backend forensics.

## 3. The ontology is also the interface

Foundry's real power move: a new hire answers operational questions by
filtering and pivoting generic surfaces, with zero bespoke pages. The ontology
doesn't just sit under the UI — it generates it.

- Generic explorer / pivot / lineage surfaces are roadmapped
  (AIP-PARITY-ROADMAP steps 4.3, 4.7).
- New rule from the walkthrough: **presentation and documentation metadata are
  ontology citizens.** Each node type declares its icon and title property;
  each property carries a one-line description that surfaces as a tooltip.
  "What does this field mean?" is answered by the graph, not a training doc.
  Tracked as backlog item A10.

## 4. Two additions to the PR checklist

Appended to CLAUDE.md's "Adding features" checklist:

- **Can an AI agent use it?** If not, say why. Human-only surfaces are the
  exception and must be justified, not the default.
- **Infrastructure carve-out.** A PR with no ontology object or business
  action (build tooling, CSS fixes, CI) says so plainly instead of inventing
  one. "Which object?" gates features, not fixes — a checklist that forces
  fake answers trains people to stop reading it.
