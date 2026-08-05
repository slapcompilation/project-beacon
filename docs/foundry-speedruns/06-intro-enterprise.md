# 06 · Introduction to Foundry for Enterprise Organizations

Source: `source/06-introduction-to-foundry-for-enterprise-organizations/` (22 lesson PDFs).
Conceptual/architecture course — the "what and why" of Foundry + AIP, no hands-on steps. Delivered
alongside the Speedruns; captured here because it is Foundry's own definitive statement of the
platform's **mandatory capabilities**, which makes it the reference for the coverage check.

Protocol: verbatim-first, then Beacon mapping, then a **mandatory-capability coverage ledger** (the
concept-level analog of the speedruns' mandatory-step ledger). Page-cite by lesson title.

---

## Verbatim capture (condensed, faithful to the lesson text)

### Part 0 — Vision

- **Course Overview** — "the conceptual foundations of Foundry and AIP … its mission, its
  architecture, and its approach to turning enterprise data into operational decisions." Audience is
  data engineers, floor operators, and business leaders alike.
- **The Enterprise Autonomy Vision** — the ambition is "maximally ambitious": an enterprise where
  "thousands of AI agents wield thousands of specific tools across every workflow." Framed as a
  concrete engineering target, not aspiration. Deployed in hospital staff scheduling, insurance
  underwriting, shipyard build ops, defense/intel. "Forward-deployed … working backwards from the
  hardest problems … a radical orientation around the outcome."
- **AI Labor: A New Category** — two traditional categories of effort (human effort/thought;
  traditional computation — databases, rule engines, scheduled jobs). AI introduces a third, **AI
  Labor**, "a conceptual bridge between the two." Building AI ops is "a rigorous form of alchemy:
  figuring out the right balance between human effort, AI labor, and traditional computation for each
  step" — and that balance **shifts over time** as agents get better tools/context and trust builds.
  The platform's design principle: an architecture where the three "can be composed, recomposed, and
  progressively automated — all on a shared foundation — Ontology."
- **The Evolution from Linear to Decision-Centric Systems** — most orgs run data like an assembly
  line (producers → integration → transformation → reporting → decision-makers). Gaps: learnings
  aren't captured back; decisions aren't materialized into action ("swivel-chair into a completely
  different system"); no feedback loop between front-line operators and analytics teams. Foundry is
  "a decision-centric operating system where data flows in, decisions emerge, actions are taken, and
  the results feed back to improve future decisions."

### Part 1 — The Ontology at the center

- **High-Level Architecture** — "more than a data lake … ML platform … application builder. It takes
  a unified architecture … organized around one central concept: the Ontology." Around it sit the
  services needed at enterprise scale. The whole is **AI Infrastructure** — "the layer between raw AI
  capabilities and actual enterprise outcomes." A model alone "can't understand your business, respect
  your governance policies, integrate with your existing systems, or take actions."
- **What is the Ontology?** — "the nouns and verbs that make up your business" (plants/warehouses,
  patients/providers). A **semantic layer** bridging raw source-system data ↔ everyday business
  language, "not how your IT systems need it structured … but how the real world actually works."
- **The Ontology as the Shared World** — different from a warehouse/semantic layer because it serves
  four audiences simultaneously: **humans** (business terminology — "Warehouse X" with "42 days of
  supply"), **AI** (business context — a warehouse is low, connected to plants, has a lead-time
  constraint, and actions are available), **systems** (single source of truth ending app
  fragmentation), **governance** (visibility into what data exists, who has access, what actions,
  by whom/what).
- **The Three Pillars** — to make decisions you need: **Data** (what IS — all modalities unified into
  business objects), **Logic** (how to THINK — rules, ML models, optimizers, all compute modeled in
  the Ontology, callable by humans and AI alike), **Action** (what you can DO — write-backs modeled
  with "full governance guardrails," available to both). Plus a **common security & governance
  framework** "beyond simple role-based access controls to include purpose-based controls, data
  markings, classifications, and comprehensive audit." This is what enables **composability** —
  same shared world → "smoothly dial up and down the distribution of labor."

### Part 2 — What feeds the Ontology

- **2.1 Data Sources** — full spectrum (ERP/CRM transactional, IoT/sensor, geospatial, unstructured
  docs/images/logs, relational). **300+ native connectors** (SAP, Salesforce, ServiceNow); frameworks
  for custom sources. **Multimodal Data Plane (MMDP)** — Virtual Tables let Foundry work with data in
  Snowflake/Databricks/BigQuery **without copying** (zero-copy federation); **pushdown compute** sends
  computation to the data. Open standards (Iceberg, Parquet, CSV; REST/JDBC/S3). "Isn't asking you to
  abandon your data lake — it's asking you to connect it."
- **2.2 Logic Sources** — range from spreadsheet rules and **SOPs / tribal knowledge**, up to ML
  forecasting models, third-party route optimizers, custom algorithms. Models built in-platform or
  brought in via **containerized (Docker) runtimes**. Compute-agnostic build framework mixes
  third-party runtimes (MMDP for compute).
- **2.3 Systems of Action** — "data and logic are only valuable if they lead to action." Write
  decisions back into the systems that run operations (stock transfer order, accelerate shipment,
  adjust production schedule) — each action "needs to land in the right enterprise system." Actions
  are **governed** (permissions control who/what can execute) and **auditable**.

### Part 3 — What's built on top

- **3.1 Analytics & Workflows** — "the first thing most orgs build is visibility." Workflows
  orchestrate activity across the Ontology (one workflow spans supplier monitoring, inventory
  allocation, production scheduling, delivery). Real-time analytics reflect the **live state** of
  business objects "complete with the logic and computed properties" — not static warehouse reports.
  Low-code/no-code/pro-code workbench. Key inversion: in traditional BI "analytics are an end in
  themselves"; in Foundry "analytics are a byproduct of the workflows" and decisions act immediately
  in the same environment.
- **3.2 Automations & Progressive Automation** — automations combine generative AI with full Ontology
  context. **Reasoning with business logic**: an LLM interprets an unstructured maintenance report,
  then **calls a deterministic failure-prediction model** for the risk score — "the LLM isn't
  operating alone. It's orchestrating across multiple sources of logic — some AI, some rule-based,
  some model-driven, some human." **Orchestrating complex actions**: the agent is "embedded directly
  into the business process, reasoning with the same logic and taking actions through the same
  governed channels a human operator would use." **AIP Evals**: "observability isn't optional. It's
  the foundation that makes everything else trustworthy."
- **3.3 Products & SDKs** — capabilities packaged into products for internal operators, external
  customers, or other systems. **OSDK** (Ontology SDK) — generated SDK giving programmatic access
  from any language (React apps, Python/Java backends, OpenAPI); "turns your Ontology into an SDK of
  your business." Existing apps "don't need to be replaced; they can be enhanced." Plus streaming/
  batch connectors with export plugins, webhooks for real-time write-back, and external transforms.

### Part 4 — Cross-cutting foundations

- **From Frontier Models to Enterprise Outcomes** — the gap between what a frontier model provides and
  what an enterprise needs is "enormous." Punchline: **"If a frontier model is the brain of your
  Enterprise Agents, Ontology is its body."**
- **Common Foundation for Human + AI Collaboration** — "not human OR AI, but human AND AI, in the
  right composition." The Ontology lets the mix shift over time "without breaking the underlying
  architecture."
- **Branching: Safe Change Management** — "Foundry and AIP are platforms for builders." When humans
  and AI agents build on the same platform you need a mechanism that "prevents changes from breaking
  production until they've been reviewed" — a **global branching model**. Explicit distinction:
  **"runtime controls govern what agents and users can do in production; branching governs what
  changes make it to production in the first place."**
- **Security & Governance Layer** — "woven into every interaction … not a bolt-on." Beyond RBAC:
  **purpose-based controls** (restrict by *why*, not just *who* — same records, different permitted
  uses and visible fields), **data markings & classifications** (sensitivity labels "travel with the
  data through every transformation, every dashboard, every automation … don't get left behind" —
  restricted-at-ingestion stays restricted when passed to an LLM), **active controls** (dynamic,
  context-based enforcement), **comprehensive audit** of human AND AI activity — "the foundation for
  the trust that enables progressive automation. You can't confidently expand AI autonomy if you can't
  see exactly what the AI did and why."
- **Apollo — Software Delivery Layer** — autonomous deployment/management. Defining capability is
  **deployment flexibility**: public cloud (AWS/Azure/GCP), on-prem, edge, hybrid, and fully
  air-gapped. Handles continuous delivery, config management, operational monitoring across all.
- **The Role of Evals in Progressive Automation** — "each phase transition requires evidence. You
  can't move from human-led to AI-led on faith." Teams run eval suites before each phase transition;
  continuous monitoring/benchmarking guards against degradation. "Progressive automation as the
  strategy and Evals as the evidence mechanism creates a principled, defensible path from human-led
  operations to increasingly autonomous workflows — at whatever pace is appropriate."
- **Course wrap-up** — "data, logic, and actions flowing into the Ontology. Analytics, automations,
  products built on top. Security and governance woven through. Any storage, any compute, any model —
  no lock-in. … Start with humans in the lead. Layer in AI where it earns trust. Expand autonomy as
  the evidence builds."
- **Resources & Next Steps** — suggested next: **Speedrun: Your First End-to-End Workflow**, Foundry
  & AIP Aware cert, Palantir Learn tracks.

---

## Beacon mapping

**What it confirms (no change).** This course is, almost line for line, the thesis in Beacon's
`CLAUDE.md`. Independent Palantir confirmation of the core stance:

- The **three pillars = Beacon's three load-bearing layers.** Data (nodes+edges), Logic (Logic Tool
  Registry), Action (Action Registry) — all rooted in one Ontology, all dual-callable by humans and
  AI. This is our exact framing ("LLMs are glue … they never do retrieval, math, or writes directly").
- **"AI Labor as a third category," composed and progressively automated** = our calibration pillar +
  `decideAutoExecution` + trust budget + gated autonomy. Foundry's "start with humans in the lead,
  expand autonomy as evidence builds" is our `triggered_by` ladder and per-action auto-execution
  threshold, precisely.
- **Evals as the evidence for each autonomy phase transition** = our eval-gated release spine
  (`promote_agent` server-verifies production against `model_eval_runs`; a production release is
  required before auto-execution). Foundry states the exact mechanism we already ship.
- **"LLM calls a deterministic model in its reasoning chain"** = `runToolLoop` + restock_advisor
  `reasoning:'llm'` calling typed Logic Tools with basis+confidence. Verbatim parity.
- **Ontology as shared world serving humans/AI/systems/governance** = typed nodes with computed
  properties + provenance + the audit log on every Object View right rail.
- **Branching = "what changes reach production" vs runtime controls = "what agents can do in
  production."** We have BOTH: release stages (sandbox→staging→production) + git/PR/CI for builder
  changes, and `decideAutoExecution` + constraints for runtime. The two-axis governance is not
  something we were framing explicitly — worth adopting the language.
- **"Model is the brain, Ontology is the body."** Keep this line — it is the cleanest one-sentence
  statement of Ontology-Augmented Generation we sell.

**What it adds / sharpens (the one real gap).** The Security & Governance lesson names two controls
Beacon does **not** have, and they are exactly the parked **P8 sensitivity/PII question** from
deep-dive sessions 6 (marking inheritance) and 9 (scanner):

- **Data markings / classifications that propagate through transforms** — a sensitive source Document
  should taint its chunks, entities, and any proposal/rationale that cites it, and that marking must
  survive being passed to an LLM. We have provenance edges but no sensitivity label that travels.
- **Purpose-based access controls** — restrict by *why* not just *who*. Our RLS is scope+role
  (who/where), not purpose. Lower priority for hospitality than markings, but named as mandatory.

This course independently re-raises P8, so it is confirmed as a real capability gap (not a
nice-to-have) — promoted from "parked question" to "named backlog item." See ledger row G-16/G-17.

**What is out of scope for a vertical product (deliberate non-goals).** Several named capabilities are
horizontal-platform / scale-infrastructure that a single-tenant hospitality SaaS on Supabase does not
need, and adopting them would be cargo-culting:

- **MMDP / Virtual Tables / zero-copy federation / pushdown compute** — we own our Postgres; we don't
  federate to Snowflake/Databricks. N/A by design.
- **Apollo multi-environment delivery (on-prem/edge/air-gapped)** — we're a managed cloud deployment.
  N/A unless an enterprise customer demands on-prem.
- **OSDK for third-party developers** — Beacon *is* the operational app; we're not selling an SDK of
  someone else's ontology. Partial-by-design (our internal typed registries are the analog).
- **300+ enterprise connectors** — we need PMS/POS (Mews/Square), not SAP/ServiceNow breadth. The
  connector *pattern* (session 5) is what matters, not the count.

---

## Mandatory-capability coverage ledger

Every load-bearing capability the course names, with a Beacon verdict.
✅ have it · ⚠️ partial / by-design-narrower · ❌ gap · ⬜ deliberate non-goal (horizontal-platform).

| # | Foundry capability (course) | Beacon | Where / note |
|---|---|---|---|
| C-1 | Ontology as the center — nouns+verbs, semantic layer | ✅ | Reality Graph: typed nodes + named edges, `packages/ontology` |
| C-2 | Shared world serving humans + AI + systems + governance | ✅ | Dual-callable tools/actions; audit on every Object View |
| C-3 | **Data pillar** — all modalities → business objects | ✅ | Structured ops nodes; ⚠️ geospatial = maps only; unstructured via doc-ingest |
| C-4 | **Logic pillar** — rules/ML/optimizers callable by human+AI | ✅ | Logic Tool Registry (basis+confidence+traversableLinks) |
| C-5 | **Action pillar** — governed, auditable write-backs | ✅ | Action Registry + immutable StockLog, submission criteria, `triggered_by` |
| C-6 | Composability — dial the human/AI mix per step | ✅ | `decideAutoExecution` per-action threshold + approval tiers |
| C-7 | Data source breadth (ERP/POS/IoT/unstructured) | ⚠️ | Mews/Square webhooks + ingest fns; connector *pattern* proven (dd-5), not 300 connectors |
| C-8 | Logic source range — incl. SOPs / tribal knowledge | ✅ | Principles (tribal knowledge) + Constraints (NL rules) + objectives (ML adapters) |
| C-9 | Containerized model runtimes | ⚠️ | Tool `kind:'container'` in the vocabulary; not exercised end-to-end |
| C-10 | Systems of action — land writes in real systems | ⚠️ | Internal writes ✅; external write-back (order in a PMS) = webhook/export story, partial |
| C-11 | Analytics as byproduct of workflows (live objects, not static reports) | ✅ | Insights lenses + computed properties reflect live state |
| C-12 | Low/no/pro-code authoring | ✅ | Authoring ladder — NL-native builder + code; no-code demand-gated |
| C-13 | LLM orchestrates deterministic models in its reasoning chain | ✅ | `runToolLoop`, restock_advisor `reasoning:'llm'` |
| C-14 | Agents embedded in the business process (not standalone) | ✅ | Agent framework: blocks, numbered task prompts, `request_clarification`, trace-as-surface |
| C-15 | **AIP Evals — observability over all agentic workflows** | ✅ | Eval pipeline → `model_eval_runs`; cases + diff + cohorts |
| C-16 | **Progressive automation — expand autonomy as trust earns** | ✅✅ | Calibration pillar + trust budget + gated autonomy = our signature |
| C-17 | **Evals as the evidence gate for each phase transition** | ✅ | Release gate: `promote_agent` verifies production vs evals before auto-exec |
| C-18 | **Branching — changes reviewed before they reach production** | ✅ | Release stages sandbox→staging→production + git/PR/CI |
| C-19 | Runtime controls vs branching (two-axis governance) | ✅ | Runtime = constraints + `decideAutoExecution`; build = release stages. *Adopt the framing.* |
| C-20 | Comprehensive audit of human AND AI activity | ✅✅ | Immutable StockLog, agent run traces, cycle metrics — our self-apply bar |
| C-21 | Role-based access control | ✅ | Scope-aware RLS: `auth_org_id()` + `auth_hotel_id()`, role hierarchy |
| C-22 | **Purpose-based controls (restrict by *why*)** | ❌ | Gap — RLS is who/where, not purpose. Named mandatory; low priority for our vertical |
| C-23 | **Data markings / classifications that propagate through transforms** | ❌ | Gap = parked **P8** (dd-6 marking inheritance + dd-9 scanner). Promote to backlog |
| C-24 | Active (dynamic, context-based) controls | ⚠️ | Constraints evaluate at submission (context-aware); not a general marking-propagation engine |
| C-25 | Products & SDKs — OSDK for external developers | ⬜ | Non-goal — Beacon is the app, not an SDK vendor |
| C-26 | Multimodal Data Plane / zero-copy federation / pushdown | ⬜ | Non-goal — we own our Postgres, no external-lake federation |
| C-27 | Apollo — multi-env delivery (cloud/on-prem/edge/air-gapped) | ⬜ | Non-goal — managed cloud; revisit only on an on-prem enterprise ask |

**Score:** of the 24 in-scope capabilities (excluding the 3 ⬜ horizontal-platform non-goals),
**19 ✅ / 4 ⚠️ / 2 ❌.** The two ❌ (C-22 purpose-based controls, C-23 data-marking propagation) are
the same P8 sensitivity/governance thread already flagged twice in the deep dives — now confirmed a
third time by Foundry's own mandatory-capability list. Everything the course frames as the *core* of
the platform — Ontology-centered three pillars, LLM-orchestrates-deterministic-logic, agents in the
process, evals-gated progressive automation, branching + runtime two-axis governance, full audit —
Beacon already has, several at ✅✅.

---

## Actionable takeaways

1. **Promote P8 to a named backlog item** — data markings/classifications that propagate Document →
   chunk → entity → proposal/rationale and survive being passed to an LLM (C-23). This is the single
   genuinely-relevant gap the course surfaces. Purpose-based controls (C-22) ride behind it, lower
   priority.
2. **Adopt the two-axis governance language** (C-19): "branching governs what reaches production;
   runtime controls govern what agents may do in production." We ship both; we don't say it this
   cleanly. Worth threading into the release-gate + constraint docs.
3. **Keep the line** "the model is the brain, the Ontology is the body" — cleanest one-sentence pitch
   for our OAG stance.

No OPEN items — this is a concepts course with no hidden hands-on steps. The mandatory *procedural*
steps come from the five hands-on speedruns (awaiting PDFs); this course supplies the mandatory
*capability* checklist they will be assembled from.
