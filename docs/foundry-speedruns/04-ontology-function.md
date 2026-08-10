# 04 · Speedrun: Your First Ontology Function

Source: `source/04-ontology-function/` (26 lesson PDFs). Use case: hospital billing — compute **Days
Sales Outstanding (DSO)** per clinic (a countback aggregation over monthly billed/collected), surface
it in a dashboard, and let an operator put a clinic "under review" with a goal. Focus: **Functions on
Objects (FoO)** — pro-code TypeScript over ontology objects.

## Verbatim step-spine

1. **Install** two objects (Clinic, Financial) + a pre-made "Clinic Finance Tracker" Workshop
   (Marketplace).
2. **Code Repository** — create a repo (VS Code Workspace). **Add Ontology object references** (Clinic,
   Financial) → **generate + install the OSDK**. The OSDK is an ORM over ontology objects:
   `client(Financial).where({ clinicName: { $eq: clinic.clinicName } })`, `.asyncIter()`,
   `.fetchPage()`, aggregations, multi-hop.
3. **Write `calculateDaysSalesOutstanding.ts`** — takes `client` + optional `clinic`, returns a
   `Double`. `export default` the function = the declaration that exposes it to the rest of Foundry.
   **Preview** live in the IDE (returns 40.51). **Commit & Sync → Tag Version → Major = 1.0.0** (FoO
   use **semantic versioning**); watch the build go green under Tags.
4. **Function-backed variable** — in Workshop, new Numeric→Function variable bound to
   `calculateDaysSalesOutstanding` → connect to a **metric card** (shows 40.51 Days).
5. **Function-backed column** — a second function `functionColumnDaysSalesOutstanding` returns
   `Record<ObjectSpecifier<Clinic>, Double>` (a per-clinic map). Tag 1.0.1. In Workshop, Object Table →
   Add column → **Function-backed property** → bind → custom numeric unit "Days". **Conditional
   formatting**: 3 Math rules on the column (> 40 → Intent Danger red; mid → orange; low → green).
6. **Function-backed chart** — `calculateDaysSalesOutstandingMoM` returns a
   `TwoDimensionalAggregation<Range<Timestamp>, Double>` (month buckets → DSO). Tag 1.0.2. Workshop bar
   chart → Layer → **Function** → bind; pass the **table Active object** as the function input so the
   chart reacts to the selected clinic.
7. **Function-backed action** — `clinicEditFunction` uses `Edits.Object<Clinic>` +
   `createEditBatch(client)` to **toggle `underReview` and set a `goal`** (random 70–95% of current
   DSO, "in reality you'd have business logic here"), returns `editBatch.getEdits()`. The
   `Edits.Object<...>` type is *"what enables a function to update an Ontology object."* Tag 1.0.3.
   Ontology Manager → New Action Type → **Function → `clinicEditFunction`** → restrict executor → save.
   Workshop → Inline Actions module → add the action. Now: select a clinic → submit → object updates.

Course framing (from Course Introduction): FoO is Foundry's **pro-code** tool for *"complex
calculations using subsets of data, aggregations, or ontology connections with multiple hops,"* when
no-code (Pipeline Builder / Workshop / AIP Logic) can't express it. Pipeline Builder sits *below* the
ontology (prep), FoO sits *above* it (manipulate). Real-time recompute is a headline feature.

## Beacon mapping — this is the Logic Tool Registry + Action Registry

- **FoO = Beacon Logic Tools.** Typed input/output, versioned (Foundry semver tag ↔ our tool
  `version`), pure computation over ontology objects, `export default` exposure ↔ our registry
  registration. The DSO countback = a `logic`-category tool with an explicit `basis`.
- **Function-backed column/variable/chart** = our **computed node properties + Logic Tool outputs**
  rendered in Object Views (metric strip, body sections). Passing the *Active object* into the function
  = our selection-aware tool invocation (tool receives the current node id).
- **Conditional formatting (DSO > 40 → Danger)** = our `objectPresentation.ts` intent rules (value →
  intent), the ontology-level conditional-formatting steal from deep-dive session 4.
- **Function-backed action (`Edits.Object` / editBatch)** = our **Action Registry**: a typed mutation
  wrapped as an Action, restricted executor, invoked from the app. Foundry: function returns edits →
  Action wraps it → Workshop calls it. Beacon: `BeaconAction` with submission criteria + immutable
  audit. The "under review + goal" toggle is an `open-form`/`apply-immediately` action.
- **Semantic versioning + tag/build/release** = our tool versioning + release stages (sandbox →
  staging → production).

**Our differentiator (worth stating):** Foundry FoO are pro-code and human/UI-callable; to make them
LLM-callable you reach for AIP Logic separately. Beacon Logic Tools are **dual-callable by design** —
the same typed signature serves UI, automation, and agent. One registry, not two paths.

No gaps. The only thing Beacon doesn't expose is an in-platform *IDE + OSDK generation* loop, because
our tools are authored directly in `packages/ontology` (code-as-ontology) — that's our stance, not
a missing feature (deep-dive session 3 confirmed no downgrade).

## Mandatory-step ledger

| # | Mandatory step | Beacon | Where |
|---|---|---|---|
| 1 | Typed function over ontology objects (ORM/multi-hop) | ✅ | Logic Tools query the graph (`traversableLinks`) |
| 2 | Explicit typed I/O + `basis` | ✅ | tool input/output zod schemas + basis+confidence |
| 3 | Test/preview before release | ✅ | tool eval suites + preview |
| 4 | Semantic version + tag/build | ✅ | tool `version`, release stages |
| 5 | Function-backed metric/variable in app | ✅ | computed properties in Object View metric strip |
| 6 | Function-backed column (per-object map) | ✅ | computed node properties in tables |
| 7 | Conditional formatting (value → intent) | ✅ | objectPresentation intent rules |
| 8 | Function-backed chart (2D aggregation, reactive to selection) | ✅ | Insights charts + selection-aware tools |
| 9 | Function-backed Action (typed edits → object update) | ✅ | Action Registry (`BeaconAction`) |
| 10 | Restrict who can execute the action | ✅ | scope/role-gated actions |
| 11 | (Same function callable by humans + LLM) | ✅✅ | dual-callable Logic Tools — one registry |

**Verdict: 11/11 ✅** (one at ✅✅). Guide 4 is Beacon's Logic Tool + Action Registry, with our
dual-callable design a strict superset of Foundry's split pro-code/AIP-Logic paths.
