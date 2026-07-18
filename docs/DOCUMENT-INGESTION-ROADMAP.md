# Document Ingestion — activate the arc (Phase D)

> Build backlog #1 from [FOUNDRY-PLAYBOOK.md](FOUNDRY-PLAYBOOK.md): turn documents into a queryable,
> resolved part of the graph — the Foundry "Ontology Augmented Generation" flow, hospitality-native.

---

## The reframe (verified before drafting)

This is **not a greenfield build.** The whole pipeline exists end-to-end; it has simply **never been
run** — every table is empty in production (0 documents, 0 chunks, 0 embeddings, 0 edges). Same pattern
the prediction arc turned out to be: *the machinery is built; the gap is that nothing has exercised it.*

**What's already built (grounded in code):**

| Stage | Mechanism | Advances to |
|---|---|---|
| Upload | `documents/api.ts` `uploadDocument` → private `documents` storage bucket → `documents` row | `raw` |
| OCR + chunk | `document-ingest` edge fn (Anthropic vision OCR) → chunks on the doc row | `ocr` |
| Embed | `document-ingest` → `embed-text` edge fn → `document_chunks.embedding` (pgvector) | `embedded` |
| **Resolve** | `entity-extract` edge fn — loads the hotel's **real variants + suppliers**, LLM matches chunks to their **node ids** (0.95 exact … <0.65 drop) → `entity_link_suggestions` (`status='pending'`) | `contextualized` |
| Approve → link | `entityLinks/api.ts` `approveSuggestion` → writes `describes_entity` edge into `relationship_edges` | `linked` |
| Search | `query_document_chunks` Logic Tool → `match_document_chunks` pgvector RPC (cosine, 0.70) | — |
| Surface | `/documents`, `/documents/:documentId` routes (`DocumentsPage`, `DocumentObjectPage`) | — |

**The differentiator is already implemented.** `entity-extract` does *not* take Foundry's
discovered-string path — it **resolves each mention to an existing Variant/Supplier node id** and stages
it for human approval, which becomes a typed `describes_entity` edge. That's the exact "mention → real
node" step the playbook calls our edge over Foundry. It's built. It's never fired.

**So the job is: prove it, fix what proving exposes, then fill the two genuine holes** (a grounded
document-copilot surface, and the lineage shown on Object Views).

---

## Phase D — activate and prove

### D0 — Prove the pipeline end-to-end (verify-first) ⭐ start here
Upload one **real** hospitality document (a supplier contract PDF for Valinor) and run the full pipeline,
asserting each hop live:
- `documents` row created, stage `raw` → after ingest, advances `raw → ocr → embedded → contextualized`;
- `document_chunks` populated with non-null `embedding`;
- `entity_link_suggestions` created, **matched to real Variant/Supplier ids** with evidence snippets;
- approve one → a `describes_entity` edge lands in `relationship_edges`, doc reaches `linked`.

**Outcome, either way, is the deliverable:** the feature activates (a dormant, fully-built arc goes
live) — *or* the run exposes the one blocker that's kept it at zero (missing `OPENAI_API_KEY` /
Anthropic key on the edge fn, an RLS gap on `entity_link_suggestions`, a storage-bucket policy, or the
approval UI not wired). Nine-for-nine this session, the audit finds the gap; D0 is that audit.

### D1 — Fix what D0 exposes + a demo seed
Whatever D0 breaks (keys, RLS, OCR path, approval surface). Then **seed 2–3 real documents** so the arc
has data to stand on — a supplier contract, a product spec sheet — mirroring the real-demand-data work
that unblocked the prediction arc. Grounds every downstream surface in something real.

### D2 — The document copilot (the Foundry payoff app)
The tutorial's capstone: NL question → grounded, cited answer over document chunks.
- `query_document_chunks` (pgvector RAG retrieval) already exists as a Logic Tool. **First verify
  whether the copilot already has it in its toolset** — if so, this is a *grounding-prompt + surface*
  job, not a build ("answer using only these references; cite the page; if they don't answer it, say
  so").
- Hospitality shape: *"what does the Acme contract say about lead-time penalties?"* → retrieve the
  chunks → grounded answer citing **contract p.3** → the supporting chunks shown beside it.
- This is Foundry's `Ontology Augmented Generation` app, hospitality-native — and it composes directly
  onto the resolved edges from D0.

### D3 — Surface the lineage on Object Views
A Supplier's (or Variant's) Object View right rail shows its **linked document chunks** via the
`describes_entity` edges — *"Contract.pdf p.3: 5-day lead, penalty after 7."* The "related workflows /
management consoles" elevation from the playbook. Turns a resolved edge into something an operator sees
exactly where they act. Cheap once D0 has real edges.

### D4 — Deferred (scale + reach)
- **Retrieval before extraction.** `entity-extract` currently caps the candidate variants/suppliers in
  the prompt; its own comment flags that large hotels need a vector-match (chunk text → top-K names)
  first. Not needed at 20 variants; real at 200.
- **Search Around** — the interactive graph traversal (playbook backlog #2). Separate arc; the resolved
  `describes_entity` edges from D0 are what make it worth traversing.

---

## Sequencing

**D0 → D1 → D2 → D3.** D0 is the whole bet: it's cheap (upload one PDF, run one pipeline), it's
verify-before-build, and it decides everything — if the arc works, D2/D3 are surfacing exercises on live
data; if it doesn't, D0 hands us the exact fix. Do not build D2/D3 speculatively on an unproven pipeline.
