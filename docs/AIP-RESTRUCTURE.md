# AIP-native restructure — the spec

Status: **agreed** (2026-06). The dock today is six modules-of-tabs (Floor, Flow,
Eye, Mind, Operations, Briefing) with ~40 tabs between them. Most of those tabs
are bespoke pages that re-implement, beside the ontology, things the AIP model
says should live *on* it. This doc is the target state + the migration plan.

It is mostly **subtraction**: the AIP primitives already exist (Cases, Object
Views, Review Queue / Decisions, Action Chains, the Copilot, the Logic-Tool
registry, Calibration). The work is routing content into them and deleting pages.

---

## The reduction test (the rubric for every surface)

A surface earns its place only if it reduces to one of:

1. **Object View** — a typed node's Full or Panel view (header → metrics → action bar → body → right-rail audit). Intelligence surfaces *here* (the agent's take shows up on the object).
2. **Lens** — a saved query over the graph (a work-queue / filter), generated from the ontology, not a hand-built page.
3. **Action / Action-Chain** — a typed write (optionally a multi-step chain with a commit boundary), not a form-page you sit on.
4. **Decisions** — an item in the one role-scoped, Cases-backed inbox.
5. **Insight / Report** — genuinely informational read-only analytics.
6. **Studio** — a builder/config surface (owner/admin), touched rarely.

Plus two always-on surfaces: the **omnipresent Copilot** and **Capture** (scan / voice / vision).

If a surface reduces to none of these, it's a **bespoke-page anti-pattern** and should be deleted, its content redistributed.

---

## Target dock — 6 modules → ~4 surfaces

| Surface | Absorbs | Access |
|---|---|---|
| **Home** (scope-aware) | Briefing + Mind Command + Mind Portfolio | all |
| **Decisions** (Cases-backed inbox) | Review Queue + Pending Approvals + Flow Dashboard/Approvals + Eye Restock/Incidents + Operations Triage/PO-discrepancies + Ontology & Entity-link approvals | **role-scoped** (de-gated) |
| **Insights** (reports) | Eye Analytics (Performance/Waste/Risk/Occupancy) + Operations Finance/Strategy | scoped |
| **Studio** | Mind's 13 builders (unchanged) | owner/admin |
| _Object Views_ | most "analytics" — surfaced on the object (L1) + audit right-rail | all |
| _Lenses / work-queues_ | Live Stock + alerts/expiry/waste/ghost-scans, to-receive, arriving, Zones | all |
| _Capture_ | scan / voice / vision | floor |
| _Copilot_ | omnipresent (Ctrl+J) — already done | all |

**Floor, Flow, Eye, Operations dissolve as modules** — their content becomes object-views + lenses + Decisions + Insights.

### Rename mapping (vocabulary — applied LAST)
- Briefing/Canvas → **Home**
- Mind → **Decisions** (promoted, role-scoped) + **Studio**
- Eye + Operations-finance/strategy → **Insights**
- Floor / Flow / Operations operational lists → **lenses + object views** (not modules)
- Capture stays.

---

## Reduction matrix

### Floor
| Tab | Reduction | Target |
|---|---|---|
| Live Stock | Lens (the stock-reality ledger) | Keep, reframe to provenance (ERP/manual/scan) + freshness + inline intelligence |
| Locations | Lens → spatial | Rename **Zones**; feed the existing `features/canvas/HotelMap` (interactive map = Canvas add-on, later) |
| Adaptive PAR / Optimize PARs | **Compute** | Logic Tool `recommend_par_level` → emits a **proposal into Decisions**, surfaced on Variant. Delete both tabs |
| Ghost Scans | Decision/lens | Reconciliation Case + a "needs reconciliation" lens on stock |
| Alerts, Expiry | **Signals/Workflow — keep** | Verified rich, NOT filtered lists: Alerts aggregates Eye-Expiry/Stock/Anomalies/Notifications with bulk-restock + causal-trace + alert-prefs; Expiry has FEFO bands + batch discard + supplier-waste. They stay. Real dedup = Floor **Alerts ↔ Eye Signals** (`UnifiedSignalsPage`) merge (separate, careful). Live Stock may *gain* convenience lens chips (low/waste) additively. |
| Stocktake | — | Defer (hide from primary tabs) |
| Intelligence | mislabeled | It's the stocktake-variance report → fold into Stocktake |
| Handover | artifact | Single home + copilot "Generate handover" |
| Vision Scan, Voice | Capture | Keep |
| Import/Export CSV | utility | Condense to one "Data" menu; frame as manual ERP sync |
| Print labels | utility | Keep, demote into the Data menu / per-variant action |

### Flow
| Tab | Reduction → target |
|---|---|
| Dashboard | Anti-pattern → approvals/velocity to **Decisions**, spend to **Insights** |
| Approvals | **Decisions** (Cases-backed) |
| Timeline | one **ledger** (object audit rails primary; one forensic global) |
| Receive | **Action** (`RECEIVE_STOCK`) → fires the 3-way-match **chain**; a "to-receive" lens |
| Deliveries | **Lens** on PurchaseOrder (in-transit/arriving) |
| Pick Lists | **Action-Chain** output (approve → group → PO → pick list) |
| Handover | de-dupe with Floor |

The replenishment loop is one **Case**: gap → **lateral transfer first** → restock/PO → receive → 3-way match → close.

### Eye
| Tab | Reduction → target |
|---|---|
| Signals | Lens (FYI) + **Decisions** (actionable); de-dupe with Floor alerts/expiry |
| Incidents | a Case → **Decisions** |
| Predictive Restock | `restock_advisor` output → **Decisions** |
| Waste Radar | Lens + proposals |
| Risk Matrix | Lens / Canvas tile |
| Performance | **Report** (Insights) |
| Occupancy | Lens / agent input |

### Mind — already AIP-native; **promote + split**
| Surface | Target |
|---|---|
| Review Queue + Pending Approvals | one **Decisions** inbox, filterable, Cases-framed |
| Cases | the frame around each decision |
| Command + Portfolio | → **Home** (scope-aware) |
| Studio (13 builders) | unchanged (owner/admin) |
| Entity Links, Ontology (gap approval) | actually **Decisions** (move out of Studio) |

**Root-cause finding:** Mind is owner/admin-gated, so managers can't reach the real Decisions inbox — which is *why* Flow grew a parallel approvals UI. De-gating + role-scoping Decisions is the highest-leverage move; it lets ~4 scattered surfaces be deleted.

### Operations (owner/admin-gated)
| Tab | Reduction → target |
|---|---|
| Triage | **Decisions** (procurement filter) |
| Suppliers | **Supplier object views + lens**; PO discrepancies → **Decisions** |
| Finance (GL/CPOR/budget) | **Insights** |
| Strategy (benchmarks/demand/F&B/team) | **Insights** (+ demand → agent) |

### Home / Briefing
The ranked cross-layer decision feed — it **is** Home. Already pulls decision content (`ProposalsPanel`, `DecisionFeed`, `AipDecisionSummary`) and already embeds `HotelMap`. Absorbs Mind Command + Portfolio into one scope-aware Home.

---

## Cross-cutting fixes (the recurring smells)
1. **Scattered decision queue** → one role-scoped, Cases-backed **Decisions** inbox.
2. **Double ledger** (Flow Timeline vs /audit) → object audit rails primary + one forensic ledger.
3. **Three homes** (Briefing + Command + Portfolio) → one scope-aware Home.
4. **Access-gate root cause** → de-gate Decisions; keep Studio owner/admin.
5. **Compute as tabs** (PAR, predictive restock) → Logic Tools/Objectives that emit proposals.

---

## Build plan — spine-first strangler

Principles: never break a URL (redirect every moved route); gate every PR with the
reduction test; renames last; burn-down metric = **bespoke pages remaining**.

**Slice 1 — the spine (highest leverage).**
- PR1: promote **Decisions** to a top-level, **role-scoped** surface (de-gate from owner/admin; RLS already scopes the data). Studio stays owner/admin.
- PR2: converge **Flow Approvals + Flow Dashboard + Eye Predictive-Restock/Incidents** into Decisions; add redirects; delete those tabs.

**Slice 2 — objects absorb analytics (L1).**
- Inline intelligence on Supplier / PO / Restock object views (the Variant pattern). Then delete Eye/Operations analytics tabs whose content now lives on the object.

**Slice 3 — Floor cleanup.**
- 3a (done, #197): regroup Floor (kill "Quality"/"AI Capture"); "Intelligence"→"Variance"; condense CSV + demote labels into a Data menu.
- 3b (done): defer Stocktake from primary tabs (→ /stocktake) and fold Variance into it via a Count/Variance toggle.
- Correction from verification: Alerts + Expiry are rich Signals/Workflow surfaces, NOT foldable into lens chips — kept. Remaining Floor work: optional Live-Stock convenience lens chips (low/waste, additive), the Alerts↔Eye-Signals merge, Locations→Zones, PAR→tool.

**Slice 4 — compute → tools.**
- `recommend_par_level` Logic Tool emitting proposals; delete Adaptive PAR / Optimize-PARs tabs.

**Slice 5 — Insights + Home consolidation.**
- One **Insights** surface (Eye analytics + Operations finance/strategy); collapse the three homes into one scope-aware **Home**.

**Slice 6 — Replenishment as a Case + Zones/map.**
- Lateral-before-external replenishment Case + Action-Chain pick-list/PO; Locations → Zones feeding `HotelMap`.

**Slice 7 — renames.**
- Apply the vocabulary mapping across the dock + routes (redirects retained).

---

## What already exists (so this is subtraction, not construction)
Cases (L2) · Object Views (Full + Panel) · Review Queue / Pending Approvals / Decisions shell (`AIPShell`) · Action Chains · Copilot (omnipresent) · Logic-Tool registry · Calibration · `features/canvas/HotelMap` · `restock_advisor` agent · `query_sister_property_inventory` (lateral) · 3-way-match detector. The restructure mostly wires these together and deletes the pages that bypass them.
