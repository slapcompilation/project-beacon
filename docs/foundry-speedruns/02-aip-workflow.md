# 02 · Speedrun: Your First AIP Workflow (parse PDF media sets)

Source: `source/02-aip-workflow/` (49 lesson PDFs). **Registered.** The one that overlaps Beacon's
doc-ingestion arc most directly. Use case: a TB-research charity with a library of PDF studies; build
an app that answers questions grounded only in the documents, plus a knowledge graph.

This is the highest-signal guide in the set — it is, nearly step for step, what Beacon shipped as
Tracks 1+2 + the document copilot + reverse lineage + Search Around.

## Verbatim step-spine

1. **Upload PDFs to a Media Set** — 5 CC0 TB articles → "Upload to a new media set" (not rows),
   Transactionless write mode, rename `Articles`. Media sets keep files in media format; preview
   in-app.
2. **Pipeline (Batch/Standard) — Process PDFs node:**
   - `Extract text from PDF` (mediaReference → `content`). Note: image/scanned PDFs → switch Extract
     Method to **OCR**.
   - `Explode Array with Position` → one row per text element, `content` = struct{element, position}.
   - `Extract Many Struct Fields` → `pageNumber` from position, `content` from element.
   - `Drop Columns` (the default timestamp).
3. **Extract Chunks node:**
   - `Chunk string` on `content`, **chunk size 512** (with overlap; balances specificity vs runtime).
   - `Explode Array with Position` → `chunkNumber`.
   - `Extract Many Struct Fields` → chunkNumber + content.
4. **Create Chunk ID node:** `Concatenate strings` with `_` separator: `mediaItemRid` + cast(pageNumber
   String) + cast(chunkNumber String) → **`chunkId`**. Explicit lesson: *"use a combination of other
   columns rather than a randomly generated or hashed code"* for the primary key.
5. **Use LLM node** (off Create Chunk ID) — one LLM call per row. System prompt: *summarize the snippet
   and extract a list of entities* constrained to five categories — **biological specimens / harmful
   agents / healthcare organizations / treatments / symptoms** — singular, no adjectives, no
   duplicates, empty list if none. Output type = struct{`summary`: string, `entities`: array<string>},
   named `response`. Trial-run on a few rows, then Apply. (Default model GPT-4o; parallelized under the
   hood.)
6. **Embed Chunks node** (off Use LLM): `Get struct field` → `summary`; **`Text to embeddings` on the
   `summary` column** (model e.g. text-embedding-ada-002) → `embedding`; drop `response`. → **Add
   output `Chunks`.** (Output config can set data expectations: no-nulls, ranges, uniqueness.)
7. **Get Entities node** (also off Use LLM): `Get struct field` → `entities`; `Explode array` →
   `entityName`. → **Deduplicate Entities** (Select `entityName`, Drop duplicates) → **Add output
   `Entities`.**
8. **Get Join Table node** (off Get Entities): Select `entityName` + `chunkId` → the many-to-many
   bridge → output `Join Table`.
9. **Deploy pipeline** (all outputs; may need one job grouping for the shared cached-LLM upstream).
10. **Ontology (Ontology Manager):**
    - **Chunk object** backed by `Chunks`: **PK = Chunk Id, Title = Summary**; set the Media Reference
      property to the `Articles` media set.
    - **Entity object** backed by `Entities`: **PK = Title = Entity Name**; generate Create+Delete
      actions.
    - **Link type Chunk ⇄ Entity** via the **Join Table** (many-to-many): entityName + chunkId keys.
11. **AIP Logic function "Ontology Augmented Generation":** input `userQuestion` (string) →
    **Semantic search block** over Chunk on the `Embedding` property, `userQuestion` as query, **k=10**
    → **Use LLM block** with system prompt *"answer using only the reference text… don't use any prior
    knowledge… if the references don't answer it, say so"*, task prompt embeds `userQuestion` +
    `Searched Chunks.Content`, Single completion. Test with sample questions; **Publish** as a function.
    (Note: Chain-of-Thought mode turns this into a tool-using agent with a Debugger.)
12. **Vertex knowledge graph:** create a graph, add Chunk objects, **select all → Search Around → the
    Entity relationship**, **Layout → Radial.** Save as a **Vertex template** (parameterized on a Chunk
    object set, with the Search-Around to Entities) = "Knowledge Graph Template."
13. **Workshop app:** Text input (`User Question`) → Markdown widget bound to a **Function variable =
    the OAG function** (input = User Question) → Object list of `Relevant Chunks` (Chunk filtered by
    Embedding, query=User Question, k=10) → **Vertex Graph widget** backed by the Knowledge Graph
    Template, fed the Relevant Chunks. Save & publish → ask questions, see the answer + the subgraph
    used to form it.

## Beacon mapping — near-exact parity, and it settles two open forks

This is the sharpest confirmation in the whole set. Beacon's `document-ingest → embed-text →
entity-extract` + `copilot-chat.search_documents` + `match_document_chunks` + `SearchAroundGraph`
(#371) + reverse doc lineage (#369) is a faithful implementation of this exact pipeline.

**Settles P5 (embed target) — embed the summary.** The deep dives left P5 open (session 2 had no
LLM/embed content). Guide 2 **explicitly embeds the `summary` column, not the raw chunk.** That is
exactly what Beacon does. P5 is now settled by a Foundry source: *embed the LLM summary.* Fold into
DOCUMENT-INGESTION-ROADMAP.

**Sharpens P6 (entity categories).** Session 1 left "hospitality entity categories" open. Guide 2
shows Foundry's answer: **a fixed category taxonomy injected into the extraction prompt** (5 medical
categories here). Our hospitality analog is a prompt-level enum (supplier, product, brand, allergen,
location, …) — a prompt constant, not a schema change. Concrete and cheap.

Confirmed verbatim:
- **Composite deterministic chunkId** (`mediaItemRid_pageNumber_chunkNumber`) = our deterministic chunk
  PKs; the lesson's PK-discipline paragraph is our discipline word for word.
- **Chunk PK=id / Title=summary; Entity PK=Title=entityName** = session-1 title rules, now applied.
- **Chunk⇄Entity many-to-many via join table** = our `mentions` edge.
- **OAG function = semantic search (k=10) → grounded LLM ("only the references")** = `copilot-chat`
  `search_documents` → `match_document_chunks` (p_threshold 0.35) → cite-only-sources system prompt.
  Same anti-hallucination contract.
- **Vertex Search Around → Entity, Radial layout** = `SearchAroundGraph` shipped in #371 — same verb,
  same radial layout, same chunk→entity hop.
- **Workshop answer + subgraph-used** = the document copilot surfacing answer + retrieved chunks.

Out of scope (as in guide 6): Vertex **simulation** (chaining ML models on the graph) — noted advanced,
not built. OCR fallback for scanned PDFs — Beacon doc-ingest stops at text extract; OCR is a known open
(data-integration parity memo).

## Mandatory-step ledger

| # | Mandatory step | Beacon | Where |
|---|---|---|---|
| 1 | Upload unstructured docs (media set) | ✅ | document upload / media ingest |
| 2 | Extract text from PDF (OCR fallback) | ⚠️ | text extract ✅; OCR fallback open |
| 3 | Explode to page-level rows | ✅ | document-ingest page refs |
| 4 | Chunk text (size ~512, overlap) | ✅ | chunk stage |
| 5 | Deterministic composite chunk PK | ✅ | deterministic chunk ids |
| 6 | LLM summarize + extract entities (typed categories) | ✅ | entity-extract; categories = prompt enum (P6) |
| 7 | **Embed the summary** | ✅ | embed-text on summary — **settles P5** |
| 8 | Dedupe entities | ✅ | entity resolution |
| 9 | Chunk⇄Entity join (many-to-many) | ✅ | `mentions` edge |
| 10 | Chunk/Entity object types (PK/title) | ✅ | chunk + entity nodes |
| 11 | Grounded OAG function (semantic search k=10 → cite-only LLM) | ✅ | copilot search_documents + match_document_chunks |
| 12 | Knowledge graph: Search Around → radial | ✅ | SearchAroundGraph (#371) |
| 13 | App: question → grounded answer + subgraph shown | ✅ | document copilot |

**Verdict: 12 ✅ / 1 ⚠️ (OCR fallback).** Beacon implements this guide end to end. Net finding: **P5
settled (embed summary), P6 sharpened (categories = prompt enum).**
