# Beacon Roadmap — connecting the AIP to the rest of the product

> North star: replicate Palantir AIP for hospitality. The reality-graph
> (ontology + tools + actions + agents) is the substrate; everything operators
> touch should sit *on top of* it, not beside it.

## The problem this roadmap solves

The engine is right but the surfacing isn't. Today the app has **five dock
surfaces** (`apps/web/src/components/layout/CommandDock.tsx`):

| Surface | Audience | Role |
|---|---|---|
| Canvas (Briefing) | manager+ | act-now home |
| Floor | everyone | stock / alerts / expiry |
| Flow | manager+ | restocks / receiving / approvals |
| Eye | manager+ | waste / occupancy / performance |
| **Mind** | owner/admin | the **entire** AIP (18-tab rail) |

Two consequences, both felt as "the AIP is chaotic and disconnected":

1. **The AIP is a destination, not a fabric.** Intelligence is walled into a
   5th, owner-only tab. To see what an agent concluded about an item you leave
   the surface where that item lives. In AIP the agent's take shows up *on the
   object*. (Partially done already — `VariantObjectPage` shows "Recent Agent
   Decisions" inline — but not on Supplier / PO / Restock.)
2. **The Mind rail mixes audiences + a whole second app.** Its 18 tabs span a
   daily-driver inbox (Queue / Approvals / Cases), an infrequent builder studio
   (Agents / Tools / Objectives / Scenarios / Policy / Copilot), the flywheel
   (Documents / Entity Links / Approved Answers / Principles / Constraints), and
   *all of hospitality procurement/finance* demoted to one "Operations" entry.

## The model to hold

One operational app with an intelligence fabric woven through it, plus a
builder's studio:

```
OPERATE  (Floor · Flow · Eye · Canvas)      where work happens; AIP surfaces HERE
   │  emits triggers (low stock, surplus, expiry)
   ▼
[ reality-graph fabric: tools → agents → actions ]   the engine, ambient
   │  produces typed proposals + traces
   ▼
DECIDE   (Review Queue · Approvals · Cases)  the ONE inbox where verdicts converge
   │  operator approves / edits / rejects / teaches
   ▼
BUILD    (Agents · Tools · Objectives · Policy · Knowledge)   tunes the fabric
   └────────────────── feeds back into the fabric ───────────────┘
```

The "connection" operators can't see *is* this loop. **Cases** is the node that
makes it legible — it ties trigger → trace → proposals → outcome — and it is the
spine the current UI is missing.

## Phases

### Phase L — Make the connection visible *(highest leverage)*
- **L1 · Inline intelligence on every Object View.** Extend the Variant page
  pattern to Supplier / PO / Restock: open proposals touching the node, the
  agent's last take, applicable principles/constraints in the right rail.
- **L2 · Wire Cases.** Every cycle run that *queues* a proposal opens or reuses a
  per-variant Case (trigger → proposals → outcome). Surface the Case link on the
  proposal and the object. Auto-executed actions stay audited via StockLog, not
  Cases. *(Done — verified live: cron queues → one Case per variant-situation,
  system-authored, deduped; surfaced on the variant + proposal pages.)*
- **L3 · One home.** Kill the Canvas-vs-Command overlap; a single "N decisions
  waiting" cockpit.

### Phase M — Tame the Mind rail *(the "chaotic" complaint)*
- **M1** · Split Mind into **Decisions** (Queue/Approvals/Cases) vs **Studio**
  (everything builder-y). Stop interleaving daily triage with monthly config.
- **M2** · Promote **Operations** out of Mind — a whole app shouldn't be a
  sub-tab of the AI tab. Its panels belong in Flow (procurement) and Eye (gl /
  invoicing), or its own dock surface.
- **M3** · Collapse thin Shape tabs (Scenarios, Action Chains, Objectives,
  Copilot) under one Studio landing with cards, not five rail entries.

### Phase N — Feed the empty surfaces honestly *(the data wall)*
- **N1** · Documents + Entity Links need the real OCR/embed ingest, or an empty
  state that explains the cycle. Bare rows read as broken.
- **N2** · Gate Modeling Objectives behind ≥1 objective — it's an empty showroom
  until a baseline is beaten.

### Phase O — Close the flywheel loop *(polish what works)*
- **O1** · Show principle citations in the operator slide-over ("this followed
  your principle: …") so the operator feels the system learned.
- **O2** · Auto-suggest TeachRule on reject — route rejections back as candidate
  Principles / Approved Answers.

## Sequencing

L1 + L2 first (they dissolve "disconnected" and Cases is the missing spine),
then M (reorganize once the loop is visible), then N + O as cleanup.
