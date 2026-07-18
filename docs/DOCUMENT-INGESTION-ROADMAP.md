# Document Ingestion — reconcile to Foundry-level, then prove (Phase D)

> Build backlog #1 from [FOUNDRY-PLAYBOOK.md](FOUNDRY-PLAYBOOK.md): turn documents into a queryable,
> resolved part of the graph — the Foundry "Ontology Augmented Generation" flow, hospitality-native.

---

## The verified state — a pre-Foundry stub with critical holes

The arc's *skeleton* exists end-to-end (upload → `document-ingest` → `embed-text` → `entity-extract` →
approval → `describes_entity` edge → pgvector search) and has **never run** (all tables empty). But it
was built *before* we studied Foundry's reference architecture, and the audit shows it's a
**demo-grade stub**, not a pipeline. Reconcile it before proving it — proving a stub only certifies its
shortcuts.

**Existing implementation vs the Foundry reference, step by step:**

| Foundry reference | Our `document-ingest` (verified) | Severity |
|---|---|---|
| Extract **full** text from each page | OCR prompt asks Claude for *"first 240 chars of page text"* — the rest is thrown away | 🔴 **critical** |
| `text_full` per chunk | column exists, **never populated** (dead) | 🔴 **critical** |
| Chunk String (≈512, **overlapping**) within pages | **no chunking** — 1 "chunk" = 1 page-preview (240 chars) | 🔴 **critical** |
| Composite `chunkId` (`rid_page_chunk`) | `docId-chunk-{pageIndex}` — deterministic but conflates page/chunk | 🟡 minor |
| LLM **`summary`** per chunk | none — no summarization pass | 🟠 missing |
| Embed the **summary** | embeds the raw 240-char preview | 🟠 wrong target + truncated |
| Page-level `cited_in` edge | `cited_in` is a **declared edge type nothing ever writes** (the `sourced_from` bug class) | 🟠 phantom |
| Entities (discovered) → Entity object | **dropped** — `entity-extract` only keeps matches to existing variant/supplier | 🟠 missing |
| Chunk as a first-class object (traversable) | `document_chunks` is a table row; **`chunk` is not a graph node** | 🟠 missing |

**What's genuinely good — keep it (it's better than Foundry):**
- `entity-extract` **resolves mentions to real Variant/Supplier node ids** (not Foundry's
  discovered-strings) — our differentiator for *known* entities.
- **Human-in-the-loop approval** (`entity_link_suggestions` pending → approve → `describes_entity`).
- **Native edges** — no join-table dataset to maintain.

**The headline:** RAG currently runs on ~12% of each document (240 chars/page), with no real chunking
and no page-citation edges. That's exactly the "problems later" you predicted. So Phase D is a
*re-architecture of the ingest stages*, not a run.

---

## Phase D — three tracks

### Track 1 — fix the correctness holes (must, before anything else)

- **D0 — Full-text OCR + real chunking.** The extract step returns **full** page text (not a 240-char
  preview); a chunk-string step splits each page into ~512-char **overlapping** segments; `text_full`
  is populated; `chunkId` becomes composite (`docId_page_chunk`); the embedding is on the full chunk
  text. Kills the 88% text loss and the no-chunking hole in one pass. *This is the foundation everything
  else stands on — RAG, resolution, and search are all worthless on truncated previews.*
- **D0b — Write the `cited_in` edges.** `document —cited_in→ chunk` (page-level), the declared edge
  nothing honours — the same class as the `sourced_from` bug we already fixed this session. Makes the
  "cite the page" provenance rule real instead of aspirational.

### Track 2 — reach Foundry-level (design forks — resolve with the deep-dives + your input)

These are genuine architecture decisions, not obvious fixes. Flagging them as *decisions* to make with
the incoming Foundry deep-dives, not assumptions to bake in:

- **D1 — Per-chunk summary?** Foundry embeds an LLM `summary`, not the raw chunk. Fork: embed the full
  chunk text (simpler, often better recall) **vs** add a summarization pass and embed the summary
  (cleaner, Foundry's choice, more tokens). *Recommendation: start with full-chunk embedding; add
  summaries only if retrieval quality demands it.*
- **D2 — Discovered entities as objects?** Today we drop any mention that isn't a known
  variant/supplier — so contract concepts (penalty clauses, delivery windows, lead-time terms) vanish.
  Foundry captures them as first-class Entity objects. Fork: keep resolve-to-node **and** add a
  discovered-concept node type (a real ontology extension) **vs** stay resolve-only. *This is the
  biggest architectural decision; the Ontology deep-dive should inform it.*
- **D3 — Chunks as graph nodes?** For Vertex / Search Around to traverse *from a chunk*, chunks must be
  graph-addressable. Fork: promote `document_chunks` to nodes **vs** keep the table + synthesize edges.
  *Depends on how central the knowledge-graph view (backlog #2/#4) becomes.*

### Track 3 — prove + surface (only after Track 1, and the Track-2 forks are decided)

- **D4 — Prove end-to-end on a real document.** Upload a real supplier contract for Valinor; assert
  every stage advances, chunks carry full text + embeddings, suggestions resolve to real node ids,
  approval writes `describes_entity` + `cited_in`. Now the proof means something.
- **D5 — The document copilot (the Foundry payoff).** NL question → `query_document_chunks` (pgvector,
  now on real chunks) → grounded, cited answer. Verify whether the copilot already carries the tool —
  if so, a surface + grounding-prompt job.
- **D6 — Lineage on Object Views + Search Around.** A supplier's rail shows its linked contract clauses
  via `describes_entity`; Search Around traverses chunk ↔ entity (needs D3).

---

## Sequencing

**Track 1 (D0/D0b) is non-negotiable and comes first** — it's the correctness foundation; nothing
downstream is worth building on 240-char previews. **Track 2's forks (D1/D2/D3) are where the Foundry
deep-dives earn their keep** — decide them with that material rather than guessing now. **Track 3 proves
and surfaces** only once the pipeline is actually Foundry-level. The earlier "activate-and-prove" framing
was wrong: this is reconcile-first.
