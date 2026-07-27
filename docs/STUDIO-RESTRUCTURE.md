# Studio restructure — applications over one ontology

Scoped 2026-07-27 after cross-checking `docs/foundry-reference/` on what Foundry
treats as *ontology* versus what it treats as an *application*.

## The finding

Foundry draws a line we blurred.

**The ontology** is the shared vocabulary — object types, properties, link types,
action types, interfaces, functions. Roughly eight doc paths.

**Applications** consume it. Workshop (96 doc pages), Quiver (77), Slate (47),
Contour (33), Automate (23), Map, Notepad, Vertex, Forms, Reports — 40+ products.
Automate is an *application*. Palantir never modelled automations as object types.

The rule Foundry actually enforces is stricter and more useful than "everything is
an object": **an application owns no domain facts.** Automate's condition is an
object set; its effect is an Action type; it stores config and nothing else.

Ours pass that test:

| Surface | Owns domain data? | What it really is |
|---|---|---|
| Automations | No — config only; reads variant properties, emits `BeaconAction` | An application, same shape as Foundry Automate |
| Monitors | No — threshold in `org_policy`, metric in code, emits `BeaconAction` | **The same application, second door** |
| Calibration | No storage — math over `proposals` | A derived aggregation over the Proposal object |
| Flywheel | No storage — reads proposals, principles, `influenced_by` edges | A dashboard |

So there is no rogue second ontology. **The problem is the information
architecture, not the layers.**

## What went wrong

We gave every *noun* its own tab: 20 Studio tabs in a flat list, mixing four
unlike things.

1. Ontology editing — Object Types, Ontology, System Map
2. Applications — Automations, Monitors, Agents, Forecast Lab, Scenarios, Action Chains
3. Ontology **content** — Documents, Principles, Constraints, Approved Answers,
   Entity Links. These are already object types with Object Views; they have tabs
   only because we built a browser per noun.
4. Observability — Calibration, Flywheel

Foundry gives every *job* an application and every noun an Object View reached
through one Explorer. It has one ontology editor: Ontology Manager.

Related, and the only duplicated *logic* in the list: **Monitors and Automations
are two entry points for "watch the ontology, propose an Action"**, running from
different callers with different gates. Palantir sunset Object Monitors for
exactly this reason — "Automate … offers a single entry point for all business
automation in the platform."

## The target — five destinations

Every existing page survives. This is IA, not a rewrite: the tab registry gains a
destination layer, and each destination shows its panels as a sub-nav.

| Destination | Panels | Foundry analogue |
|---|---|---|
| **Ontology Manager** | Object Types (+interfaces), Vocabulary, System Map, Scenarios* | Ontology Manager |
| **Object Explorer** | Documents, Entity Links, Approved Answers, Principles, Constraints | Object Explorer |
| **Automate** | Automations, Monitors, Action Chains* | Automate |
| **Logic & Evals** | Agents, Logic Tools, Forecast Lab, Calibration, Flywheel, Objectives*, Copilot Config* | AIP Logic + AIP Evals |
| **Policy** | Auto-execution thresholds & overrides | Security / permissions |

`*` = reachable by deep link and from the Studio landing, not shown in the rail
until active. Same `railHidden` treatment they already have.

20 rail entries → **5**.

## Why deep links keep working with no redirects

The URL parameter stays `?aip=<panel>`. The destination is *derived* from the
panel, so every existing link resolves unchanged — the rail highlights the
containing destination and the sub-nav highlights the panel. No redirect table to
maintain, and nothing to forget to add one for.

## Phases

**P1 — destinations (this change).** Destination registry, rail renders five,
panel sub-nav inside each, Studio landing generated from destinations. No page
component touched. No data change.

**P2 — merge Monitors into Automate.** The real logic consolidation: one grammar,
one gate, one entry point. Monitors' better idea — deterministic metric in code,
threshold tunable in `org_policy` — survives as automation conditions. This is the
one phase with behavioural risk, so it ships on its own.

**P3 — mostly already built; the plan above was wrong.** Audited before building:

`/objects` (card grid) and `/objects/:type` (`ObjectListPage`) **already are** a
registry-driven, type-filtered explorer, and `OBJECT_LIST` already covers
`document`, `constraint` and `principle` — three of the five panels P3 named.

So "collapse the five bespoke pages into one browser" was the wrong framing. The
bespoke pages are **authoring** surfaces (upload a document, teach a principle,
review an entity-link suggestion); `/objects` is the **browsing** surface. Foundry
splits these too — Ontology Manager authors, Object Explorer browses. Keeping both
is correct, not duplication.

What is genuinely missing, and all that remains of P3:

1. **`approved_answer` is absent from the explorer.** It is in `NODE_LABELS` but
   *not* in `OBJECT_PRESENTATION`, and `ObjectListType = keyof typeof
   OBJECT_PRESENTATION`, so it cannot get an `OBJECT_LIST` spec until it gets a
   presentation entry. `OBJECT_PRESENTATION` is `satisfies`-exact and consumed by
   `GraphConnections`, 13 page headers and `ENTITY_META`, so adding a key cascades
   — small but not a one-liner, and it wants its own change.
2. **Entity Links is a review queue, not a browsable type.** It should not be
   forced into the explorer; it belongs where it is.

The Object Explorer destination from P1 already gives these panels one home. That
was the IA win; there is no second one hiding here.

## What this is not

Do **not** make Automations an object type to satisfy "everything is ontology."
Foundry doesn't, and it would be cargo-culting the vocabulary while missing the
discipline. The discipline is *applications own no domain facts*, and ours already
comply.
