# AIP / Foundry reference images

Visual ground truth for the parity gate in
[`../AIP-UX-RESTRUCTURE.md`](../AIP-UX-RESTRUCTURE.md). 42 captures landed
2026-07-06, taken from a Foundry Titan supply-chain demo + ModelOps walkthrough
(May 2026). Files keep their descriptive capture names; the parity board links
them directly.

## Index by surface

**Platform architecture** *(orientation)*
- `Foundry Platform 1.png`, `Foundry Platform 2(external structures).png` —
  Workshop/Slate/Ontology/Pipelines over Modeling Objective → Model Asset
  (Adapter + Artifacts); the same shape as our objectives/adapters.
- `OAG Solution Designer Diagram 1.png`, `…Diagram 2.png` — our own target diagrams.

**Modeling lifecycle** *(→ Studio · Modeling Objectives, Phase 3)*
- `Example modeling objective and summary of said end goal.png`
- `Models.png`, `Models - Add Model.png`, `Models - Import an open source model.png`,
  `Model submissions.png`
- `Release the model and Deployments.png`, `Inside the deployment model - details
  screen.png`, `…querry screen.png`, `…Logs&Metrics screen.png`,
  `…Logs&Metrics screen (Metrics screen).png`, `runtime configuration option.png`
- `Adaptor - python + meta prophet call.png` — the typed adapter wrapping Prophet;
  exactly our `objectives/<name>/adapter.ts` contract.

**Evals** *(→ Studio · Evals, Phase 3)*
- `Evaluation.png`, `Evaluation dashboard - Build Eval + Configure evaluation
  buttons and model search.png`, `Configure evaluation.png`,
  `Evaulation configuration - Libraries.png`, `Evaluation - Select models.png`

**Auto ML Workbench** *(NL authoring — AUTHORING-STRATEGY ladder rungs)*
- `Auto ML Workbench Problem Description Natural language and Input object set.png`,
  `…Generated Training code(based on AIP Logic).png`, `…Start training button.png`,
  `Auto ML Tool Factory - Use LLM, Tools and Provide input data fields.png`

**AIP Logic** *(→ Logic canvas + numbered debugger, Phase 3)*
- `Use LLM - Tools, Provide Input data and Output.png`, `Use LLM - Input data and
  Outpu and Add a block optionst.png`
- `Use LLM - Debugger with chain of thought reasoning and function output.png`,
  `Use LLM - Debugger (execution log) and Function output actionable.png` —
  numbered steps, per-step token budget bar, "Exited block →" transitions:
  the blueprint for our `AgentRunTrace` debugger.
- `Tools available for the demo, Calculation tool(Call Function) and Provide
  input data.png`
- `Code - Form bottom window orders_string for forecastCustomerOrders
  function.png`, `…function result.png`, `…function Performance.png`

**Copilot / Control Tower** *(→ Home cockpit + copilot slide-over)*
- `Control Tower.png` — KPI strip + dark basemap with object pins + hover cards
  + legend + docked copilot; the anatomy our scope-aware Home converged on.
- `Copilot - Overview & control tower, map Formating and layout.png`,
  `Copilot - Control tower and Widget setup (Tool name, description and Function
  RID).png`, `Copilot - Supply Chain (demo name) Co-Pilot actionable prompts.png`,
  `…actionable prompts and Output.png`, `Copilot - result to the prompt given
  with chain of thought on the side.png`, `Copilot - Save and publish button.png`,
  `Co-Pilot - example of a test scenario (fire at a distribution center).png`

**Shell & Object View** *(added 2026-07-06, second batch — → Phases 1–2)*
- `shell-sidebar-expanded-marketplace-install.png` — the dark 5-section left
  rail, all sections visible (top controls w/ `ctrl+J` · Recent/Files/Apps ·
  `APPLICATIONS` · `FILES` · AIP Assist `ctrl+shift+U`/Support/Account);
  grounds §0.4.
- `application-sidebar-object-view.png` — the canonical Object View (BWI
  Airport): header + `Open in ▾ / Actions ▾ / More ▾`, per-type tabs, property
  highlight cards, Properties panel, Linked Objects table,
  applications-sidebar right rail; grounds §0.5.
- `add-application-sidebar-groups.png` — the in-place Object View editor
  (Tabs / Sidebar / Settings, group management).
- `configuring-applications-sidebar_applications-sidebar-config.png` —
  per-card config (resource, overrides, thumbnail, Card/Compact,
  `{{objectId}}` params) + per-group visibility by profile.

Still missing (add when captured): two-mode Quicksearch, Applications portal,
Ontology manager, data lineage, Object Explorer explorations — freeze-frames
from the ontology deep-dive video cover the last three.
