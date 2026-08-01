# App building — what Foundry has that we do not

**Audited 2026-08-01** against `palantir.com/docs/foundry/app-building/overview/`
and its sub-pages. None of the app-building section is in the local mirror
(`all-foundry-urls.txt` carries six URLs, zero mirrored), so this was fetched
live and is dated accordingly.

## The eight surfaces Foundry names, and where we stand

| Foundry | Ours | Verdict |
|---|---|---|
| **Workshop** — assemble *modules* from *widgets* over object sets | Object views generated from registration; every page coded in React | **The gap.** See below. |
| **Applications Portal** — admins *promote* built modules; collections, tags, versions | `ApplicationsPage` — 8 hardcoded routes in 3 groups with `access` levels | Right shape, nothing to put in it |
| **Slate** — drag-drop dashboards with custom HTML/CSS/JS | — | Absent, and rightly |
| **Automate** — one entry point, conditions → effects | `automations` + Monitors + the intelligence cycle | **Present** |
| **Workflow Lineage** — understand and debug applications and their processes | `processMining/ProcessExplorer` (Machinery parity) + `AgentRunTrace` | Partial — process yes, *application* lineage no |
| **Carbon** — tailored workspaces per user group | Role-gated app list + scope-aware Home | Partial — access levels, not configurable workspaces |
| **Solution Designer** — architectural representation of a solution | `systemMap/OntologyCanvas` (ontology graph, edges authorable in place) | Partial — ontology, not solution architecture |
| **Use Cases** — organise developer work | Studio | Partial |
| **OSDK** — generated TS/Python SDK for external apps | one shared TS domain package | **Deliberate divergence**, reasoned in CLAUDE.md |

## The gap, stated precisely

Workshop composes an application from: **modules**, **widgets**, **layouts**,
**variables**, **events** — bound to **object sets**, **actions**, **functions**
and **permissions**.

We have every one of the bindings:

| Workshop needs | We have |
|---|---|
| object sets | ✅ Tier 1 — named, stored, `selectObjectSet`, traversals capped at 3 |
| actions | ✅ the Action Registry — typed `BeaconAction`s with audit |
| functions | ✅ Logic Tools — dual-callable by human, agent and copilot |
| permissions | ✅ RLS, role hierarchy, per-app `access` levels |
| **modules / widgets / layouts / variables / events** | ❌ **none** |

**Beacon has every ingredient Workshop composes, and no composer.** A surface
here is a React file a developer wrote; in Foundry it is an artifact a builder
assembled, versioned and published.

That also explains the Applications Portal. Ours lists code because **there is
nothing else to list** — you cannot promote what nobody can build. The portal is
correctly shaped for a world that does not exist yet; the missing piece is
upstream of it.

## The finding that matters: two different canvases got conflated

`AUTHORING-STRATEGY.md` deliberately defers **Rung 4 — full no-code Logic
canvas**, and the reasoning is good: it needs *"a runtime that interprets the
authored graph, a debugger, versioning"*, and NL authoring gets most of the value
for hospitality far cheaper. That deferral is demand-gated and explicitly *"not
scheduled"*.

**But Rung 4 is a canvas for authoring behaviour. Workshop is a canvas for
assembling interfaces.** They are different products solving different problems,
and the deferral of the first was silently inherited by the second.

`STUDIO-AUTHORING-PLAN.md` maps 18 Studio surfaces to Foundry equivalents and
targets "Author" for most of them — object types, action types, Logic Tools,
agents, monitors. Its closest row is *Object Views → Configure*. **There is no
row for modules, widgets, or an application canvas.**

So app composition was never actually decided. It was assumed settled by a
decision about something else.

## What this is not

Not an argument to build Workshop. Three things argue against it as a next move:

1. **It is the most expensive surface in the section**, and the same
   demand-gating logic that deferred Rung 4 applies — no operator has asked to
   assemble a screen.
2. **Our object views are already generated from registration** (G1–G3), which is
   the part of Workshop that pays for itself. A new object type gets a page
   without anyone composing one. Workshop's value is highest where layouts are
   bespoke; ours are uniform by design.
3. **The stage directive says copy Foundry's shape — it does not say copy every
   product.** Slate and OSDK are already reasoned exclusions. Workshop may be a
   third, but it has not been *written down* as one, and that is the actual
   defect here.

## Recommendation

**Decide it, then record it.** Either:

- **Exclude Workshop-style composition**, with the reason, alongside the Slate and
  OSDK divergences in `IMPLEMENTATION-MAP.md` non-goals — and then the
  Applications Portal listing code is correct and final, not a placeholder; or
- **Schedule it** as a rung in `STUDIO-AUTHORING-PLAN.md` with its own trigger,
  the way Rung 4 has one.

What should not persist is the current state: a gap that exists because two
different canvases share a word.

## Smaller, cheaper gaps worth separating from the big one

- **Workflow Lineage** — we mine *process* from lifecycle transitions but cannot
  answer *"what breaks if this object type changes"* across surfaces.
  `builtin_property_drift()` and `authored_artifact_drift()` already do this for
  saved artifacts; extending them to routes/pages is small.
- **Collections and tags on the portal** — Foundry organises apps as data
  (collections in the sidebar, tags on cards). Ours is a hardcoded three-way
  split. Making it data is cheap and would survive Workshop arriving or not.
- **Carbon-style workspaces** — we gate apps by role. Foundry configures a whole
  tailored experience per user group. Between those is "which apps does a floor
  user see by default", which is one policy row.
