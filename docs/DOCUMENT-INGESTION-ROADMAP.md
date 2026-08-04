# Document Ingestion — Foundry-exact replication spec (Phase D)

> **Mandate: almost to the dot Foundry level. Nothing less is acceptable.**
> Build backlog #1 from [FOUNDRY-PLAYBOOK.md](FOUNDRY-PLAYBOOK.md). This doc reconstructs Foundry's
> exact document-processing pipeline from the walkthrough, sets our target as *Foundry-exact base + the
> hospitality resolution layer on top*, and specs every stage against what we actually have.

---

## 1. The Foundry pipeline, reconstructed transform-by-transform

This is the exact sequence from the walkthrough (Pipeline Builder → Ontology Manager → AIP Logic →
Vertex → Workshop). Each numbered block is one Foundry transform; this is the spec we replicate.

**Pipeline Builder — `Document Processing`:**

**A. Node "Process PDFs"** (from the Articles Media Set)
1. `Extract text from PDF` — media reference → `content` (Extract method: Raw text / **OCR** / Layout-aware). *Full page text.*
2. `Explode Array with Position` — `content` → one row per **page** (struct `{position, element}`).
3. `Extract Many Struct Fields` — `position` → `pageNumber` (new); `element` → `content` (replace).
4. `Drop Columns` — drop `timestamp`.
→ one row per page, `pageNumber` + **full** `content`.

**B. Node "Extract Chunks"**
5. `Chunk String` — input `content`, **size 512, overlapping** → `content` (array of segments).
6. `Explode Array with Position` — `content` → one row per **chunk** (struct).
7. `Extract Many Struct Fields` — `position` → `chunkNumber` (new); `element` → `content` (replace).
→ one row per chunk, `chunkNumber` + `content` + `pageNumber`.

**C. Node "Create Chunk ID"**
8. `Concatenate strings` — sep `_`, `[media_item_rid, Cast(pageNumber→String), Cast(chunkNumber→String)]` → `chunkId`.
→ composite natural key `mediaItemRid_page_chunk` (the Chunk primary key).

**D. Node "Use LLM"** (per chunk row)
9. Instructions: *summarize the snippet + extract entities* in fixed categories, singular form, no dupes.
   Input = `content`. Output type = **Struct `{ summary: String, entities: Array<String> }`**. Output col = `response`. Model GPT-4o. (Optional `Array distinct` dedup.)

**E. Three output branches off "Use LLM":**
- **"Embed Chunks" → `Chunks` dataset:** `Get struct field` (`summary`) → **`Text to embeddings` on `summary`** → `embedding` (ada-002); drop `response`. Cols: `embedding, summary, chunkId, chunkNumber, content, pageNumber, mediaItemRid, …`.
- **"Get Entities" → "Deduplicate Entities" → `Entities` dataset:** `Get struct field` (`entities`) → `Explode array` → `entityName`; then `Select columns` + `Drop duplicates` on `entityName`. → the unique entity list.
- **"Get Join Table" → `Join Table` dataset:** `Select columns` `entityName` + `chunkId`. → the **many-to-many bridge**.

**Ontology Manager:**
- **`Chunk` object type** ← Chunks dataset. PK = `chunkId`. Title = `summary`. Props incl. `embedding` (vector), `content`, `pageNumber`, `media_reference`.
- **`Entity` object type** ← Entities dataset. PK = `entityName`. Title = `entityName`.
- **`Chunk ↔ Entity` link type** ← Join Table (many-to-many, `chunkId ↔ entityName`).

**AIP Logic — `Ontology Augmented Generation`:** input `userQuestion` → **Semantic search** (Chunk,
property `Embedding`, k=10, query=`userQuestion`) → **Use LLM** (answer *using only the references*,
single completion) → output.

**Vertex — `Knowledge Graph`:** add Chunk objects → **Search Around** to Entity → Radial layout →
parameterized template.

**Workshop — the App:** Text input (`User Question`) → Object list (semantic search over Chunk
`Embedding`, k=10) → Vertex graph (the template) → Markdown (the AIP Logic answer).

---

## 2. Our target — Foundry-exact base **+** the hospitality resolution layer

We replicate Foundry's model exactly, then add the one thing the tutorial *skips* (its own docs call it
a "harmonize" step): resolving discovered entities to our **operational** nodes. Foundry-exact is the
floor; the resolution layer is where we own the semantics.

| Foundry object/link | Beacon target |
|---|---|
| **Chunk** object (embedding, summary, content, page, chunkId) | **`Chunk` node type** — first-class, with an Object View, traversable |
| **Entity** object (discovered, deduped, categorized) | **`Entity` node type** — new; discovered concepts keyed by name + category |
| **Chunk ↔ Entity** link (many-to-many) | native `mentions` edge (many-to-many, no join-table dataset) |
| *(not in the tutorial)* | **resolution layer:** `Entity —resolved_to→ Variant/Supplier` where a discovered entity matches a known operational node — staged for approval (our existing `entity-extract` + `entity_link_suggestions`, kept and elevated) |

So a contract PDF produces: **Chunk** nodes (searchable), **Entity** nodes for every concept it mentions
(*"penalty clause", "5-day lead time", "Acme Corp"*), `mentions` edges chunk→entity, **and** — where the
entity is a known supplier — a resolved `describes_entity` edge to the real Supplier node, page-cited.

---

## 3. The gap, stage by stage — ⚠️ SUPERSEDED AGAIN (audited 2026-08-04)

**The 2026-07-28 note below is itself stale.** It said `documents = 0` and that
nothing was verified by observation. Measured today:

| | |
|---|---|
| documents | **2** — a real Greek supply contract (ΗΛΙΑΚΤΙΔΑ 2/2023) and a real invoice (INV11122) |
| ingestion_stage | **`contextualized`** on both — the last stage the pipeline sets |
| chunks | 37, every one with `text_full` **and** an embedding |
| `cited_in` edges | 37 (document → chunk, page-level) |
| entities | 87 across all five categories — term 38, clause 31, product 9, supplier 5, location 4 |
| `mentions` edges | 76 (chunk → entity) |

So stages 1–8 and 10 are not merely implemented, they have **run on real
documents**. Track 1 and most of Track 2 are done. The roadmap's headline —
"ingestion stops at `ocr`" — has been wrong for some time.

### What the real run actually exposed

**Stage 9 resolves nothing, and that is CORRECT.** `entity_link_suggestions = 0`
and `resolved_to = 0`. It looks like the differentiator is broken; it is not. The
seven supplier/product entities the documents mention are `bakery product`,
`food product`, `frozen product`, `Item 1`, `Item 2`, `ILIAKTIDA` and `supplier`.
There is nothing to match: the contract is with ΗΛΙΑΚΤΙΔΑ, who is not one of
Valinor's suppliers, and Valinor's inventory is a hotel bar. Harmonization
declining to invent a link is the behaviour we want.

**The real defect is upstream — extraction quality.** Four of those seven names
identify nothing. An `Entity`'s primary key *is* its name (Foundry's Entity
object: PK and title are both `entityName`), so `supplier` becomes a node that
every chunk saying the word points at, and that the resolver then offers as a
candidate. Fixed two ways: the prompt now demands names that identify one
specific thing and gives the rejects explicitly, and `checkEntityName`
(reality-graph, unit-tested) refuses them deterministically — prompt for intent,
filter for the contract.

Run against the 87 real names, the filter rejects exactly the 7 junk ones and
keeps all the rest, including Greek names, `Law 4412/2016`, and `INV11122` while
refusing the bare word `invoice`.

**21 orphaned entities are not a bug.** They have no `mentions` edge because
re-ingesting replaces chunks and their edges while entity rows persist as
vocabulary. `ontology_drift.sql` already reports them and `reap_ontology_orphans()`
already removes them, deliberately as an explicit decision — *"entities are
vocabulary: reaping is a decision, not a background sweep."* Working as designed.

**Track E is NOT unblocked — corrected same day.** The contract is real; the
invoice is a **blank template**. Its "From:" block is five empty field labels
(Όνομα / Επωνυμία / Διεύθυνση / Πόλη / Τ.Κ.) and its two lines are Είδος 1 and
Είδος 2 — "Item 1" and "Item 2", which is where four of the junk entities above
came from. No supplier, no real line items, nothing to reconcile.

Which is the third time `CONTRACT-MODEL.md`'s finding has held — *"the shape is
legible, the data is not there"* — so it is now a check: `detectBlankTemplate`
flags an unfilled form at ingest. A signal, not a gate; keeping a template is
legitimate, looking like evidence is not.

Original table kept for the stage-by-stage spec, which is still the reference:

| # | Foundry stage | What we have | Build |
|---|---|---|---|
| 1 | Extract **full** page text | OCR returns **240 chars/page**; `text_full` dead | 🔴 rewrite OCR to extract full text; populate `text_full` |
| 2 | `Chunk String` (512, overlap) | **none** — 1 chunk = 1 page-preview | 🔴 add 512-char overlapping chunker per page |
| 3 | Composite `chunkId` | `docId-chunk-{page}` | 🟡 `docId_page_chunk` |
| 4 | LLM per-chunk `{summary, entities}` | entity-extract (doc-level, no summary) | 🟠 per-chunk summary + entities; **categorized discovered entities**, not only known-node matches |
| 5 | **Embed the `summary`** | embeds raw 240-char preview | 🟠 add `summary` column; embed it (or full chunk — §4 fork) |
| 6 | **`Chunk` object type** | `document_chunks` table (not a node) | 🟠 promote `Chunk` to a node type + Object View |
| 7 | **`Entity` object type** | none (entities dropped unless matched) | 🟠 new `Entity` node type (discovered concepts) |
| 8 | **`Chunk ↔ Entity` link** | none | 🟠 `mentions` edge (many-to-many) |
| 9 | *harmonize (skipped by Foundry)* | ✅ `entity-extract` resolves to variant/supplier | ✅ keep + elevate — our differentiator |
| 10 | page citation | `cited_in` declared, **never written** | 🟠 write `document —cited_in→ Chunk` (the phantom-edge fix) |
| 11 | AIP Logic RAG answer | `query_document_chunks` tool + copilot | 🟢 grounded RAG surface |
| 12 | Vertex Search-Around graph | `GraphConnections` static | 🟢 interactive graph (backlog #2) |
| 13 | Workshop app | React app + NL | 🟢 NL doc-copilot surface |

**Kept as-is (genuinely good):** resolve-to-real-node (#9), human-in-the-loop approval, native edges.

---

## 4. Phases (your three tracks, now spec'd to the stage)

### Track 1 — Foundry-exact ingest correctness (non-negotiable, first)
- **P1 — Full-text OCR.** Rewrite the `document-ingest` extract prompt to return full page text; write
  `text_full`. (kills the 240-char / 88%-loss hole)
- **P2 — Real chunking.** Add a 512-char overlapping `Chunk String` step per page → one `document_chunks`
  row per chunk with `chunkNumber`. (stages 1–2)
- **P3 — Composite `chunkId`** `docId_page_chunk`. (stage 3)
- **P4 — `cited_in` edges** `document → Chunk` (page-level). The declared-but-unwritten edge; same class
  as the `sourced_from` bug we fixed. (stage 10)
- **P4b — fail-closed stage gates** *(added by deep-dive 2: Foundry Data Expectations — "if checks fail
  during a dataset build, the build fails")*. Each ingestion stage transition asserts its contract —
  chunks > 0, `text_full` non-null, `chunkId` unique (the PK expectation), embeddings present,
  `cited_in` written — and refuses to advance the stage marker otherwise. Today the fn warns to console
  and advances on partial success; that's the anti-pattern their expectations exist to kill.

### Track 2 — Foundry-level objects (the forks — decide *with* the deep-dives)
- **P5 — Per-chunk `{summary, entities}` + embed target.** Add the summary pass. **Fork:** embed
  `summary` (Foundry-exact) vs embed full chunk (simpler recall). (stages 4–5)
  *Deep-dive 2 did NOT cover this* (the generic pipeline course has no LLM/embed content) — the
  walkthrough (embeds the summary) stays the only Foundry source; decide with retrieval quality on real
  data at D-phase.
- **P6 — `Chunk` + `Entity` node types + `mentions` link.** The big ontology extension: Chunk and
  Entity become first-class nodes with Object Views; discovered entities (categorized) become Entity
  nodes; chunk `mentions` entity. This is what makes Vertex/Search-Around and Chunk Object Views
  possible. **Fork:** entity categories for hospitality (supplier · product · clause-type · term …).
  (stages 6–8) — *the Ontology deep-dive should shape this.*
  *Deep-dive 1 settled ([01-ontology](foundry-deep-dives/01-ontology.md)):* PKs deterministic + derived,
  never random per run (chunkId/entityName comply); titles human-readable (Chunk = summary, Entity =
  entityName); edges declare **cardinality as modeled, not observed** (`mentions` many-to-many) and name
  both traversal directions. Entity categories still open.
- **P7 — Elevate the resolution layer.** Keep `entity-extract` resolving to Variant/Supplier, but run it
  *on the Entity nodes* (`Entity —resolved_to→ Variant/Supplier`), so discovered concepts and resolved
  business objects coexist. (stage 9)

### Track 3 — prove + surface (after Track 1 lands; forks decided)
- **P8 — Prove end-to-end** on a real supplier contract for Valinor: every stage advances; chunks carry
  full text + summary + embedding; Entity nodes + `mentions` edges created; matches resolve to real
  Supplier ids; approval writes `describes_entity` + `cited_in`.
- **P9 — Document copilot (AIP Logic parity).** NL question → semantic search over Chunk embeddings →
  grounded, cited answer.
- **P10 — Vertex graph + Object-View lineage** (backlog #2/#4): Search Around chunk↔entity; supplier rail
  shows cited clauses.

---

## 5. Sequencing

**Track 1 (P1–P4) is pure correctness — build it first, no debate needed.** **Track 2 (P5–P7) is the
Foundry-exact object model — its forks (embed target, entity node/categories, resolution placement) are
exactly what the incoming Foundry deep-dives should settle** before we commit the ontology extension.
**Track 3 proves and surfaces.** This replaces the earlier "activate-and-prove" framing entirely:
Foundry-exact means rebuilding the ingest stages and adding the Chunk/Entity object model, not running
the stub.
