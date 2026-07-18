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

## 3. The gap, stage by stage (what to build)

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

### Track 2 — Foundry-level objects (the forks — decide *with* the deep-dives)
- **P5 — Per-chunk `{summary, entities}` + embed target.** Add the summary pass. **Fork:** embed
  `summary` (Foundry-exact) vs embed full chunk (simpler recall). (stages 4–5)
- **P6 — `Chunk` + `Entity` node types + `mentions` link.** The big ontology extension: Chunk and
  Entity become first-class nodes with Object Views; discovered entities (categorized) become Entity
  nodes; chunk `mentions` entity. This is what makes Vertex/Search-Around and Chunk Object Views
  possible. **Fork:** entity categories for hospitality (supplier · product · clause-type · term …).
  (stages 6–8) — *the Ontology deep-dive should shape this.*
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
