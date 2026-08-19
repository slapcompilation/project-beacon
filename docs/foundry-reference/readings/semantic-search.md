---
verify: strict
---

# Semantic search (Phase F1) — the ontology stores the vector; it does not embed

**Pages read:** `ontology/overview-semantic-search`,
`ontology/using-palantir-provided-models-to-create-a-semantic-search-workflow`
in full, and the KNN section of `functions/api-object-sets`, which is the
authoritative specification.

**Named but NOT read:** `ontology/using-custom-models-…` (the same workflow with
a different model source), `chatbot-studio/*`, `workshop/*`, `logic/*` — all
consumers, none of which change what the ontology stores.

**Why now.** F1 is the last item in `ONTOLOGY-BUILD-MAP.md`.

---

## 1. What semantic search is

> "Semantic search is accomplished using AI models to transform the text into vectors, which are arrays of numbers, and are called \"embeddings\". If the model is effective, the vectors, each of size N, that are close to each other in N-dimensional space are the ones that have similar underlying or semantic meaning."

> "If the embedded text is then associated with a particular object in the [Ontology](/docs/foundry/ontology/overview/), then your search-driven operational workflows become much more useful. Finding related entities or entities related to a particular search query is simply finding the nearest vectors in N-dimensional space."

---

## 2. The scoping finding: embedding happens somewhere else

The workflow page is a sequence, and **only its middle step is the ontology's**:

> "To begin, you need to generate embeddings and store them in an object type with a [`vector` type](/docs/foundry/object-link-types/property-metadata/#property-base-types-with-limited-support)."

Generation is named three ways, none of them ontology:

> "We will use [Pipeline Builder](/docs/foundry/pipeline-builder/overview/) to embed text in the dataset as vectors with the [**Text to Embeddings** expression](/docs/foundry/pipeline-builder/pipeline-builder-aip/#text-to-embeddings). The expression takes a string and converts it to a vector using one of the Palantir-provided models; in our case, this is the `text-embedding-ada-002` embedding model."

> "Embeddings can be generated in transformation tools such as [Pipeline Builder](/docs/foundry/pipeline-builder/pipeline-builder-aip/#text-to-embeddings) ; or at function query time [using a Palantir-provided embedding model](language-models.md#embeddings) or [your own model in a function](/docs/foundry/functions/functions-on-models/)."

**So the ontology's entire job is: hold a vector property, and answer a nearest
-neighbour query over it.** The model, the tokenisation, the embedding call and
the choice of `text-embedding-ada-002` are all outside it. That is the same
shape derived properties turned out to have — a big-sounding feature whose
ontology half is small and exact.

---

## 3. The KNN specification, which is four hard limits

`functions/api-object-sets` is the only page that states them:

> "KNN is only supported on object types indexed into [OSv2](/docs/foundry/object-backend/overview/). The k value is limited to the range 0 < K <= 100. Also, the search vector must be the same size as the one used for indexing and has a 2048 dimension limit. An error will be thrown if any of these limits are exceeded."

Four constraints and an explicit failure mode:

| limit | value |
|---|---|
| backend | OSv2 only |
| k | `0 < K <= 100` |
| query vector size | equal to the indexed size |
| dimension | `<= 2048` |
| on breach | "An error will be thrown" |

> "Object types with embedding properties will be available for KNN searches. These searches will return the k value objects that have an embedding property nearest to the provided embedding parameter."

**"the same size as the one used for indexing" is the sentence that forces a
schema change**: a vector property must carry its dimension, or there is nothing
for a query vector to be the same size *as*.

The Workshop panel gives the k range a second time, from the UI:

> "**K-value:** A number between 1-100 for how many objects to return in the semantic search."

which is `1..100` against the API's `0 < K <= 100` — the same interval stated as
integers.

---

## 4. One capability the no-code path does not have

> "The KNN object set cannot be sorted by relevancy. If you need ordered results, use the [function approach](#create-a-function-to-semantically-search-across-objects-for-use-in-workshop-andor-aip-logic)."

The function example calls `.orderByRelevance()` explicitly. So **relevance
order is a property of the query, not of the object set** — a KNN object set is
a set of the k nearest, unordered.

---

## 5. And a repository-level opt-in

> "Make sure that your functions repository's `functions.json` configuration file has the `enableVectorProperties` entry set to  `true`."

Recorded, not built: our functions have no `functions.json` and no repository —
F1 (501–502) stores source and a declared-import list on the version row. There
is nothing here for that flag to be a flag *on*.

---

## 6. What we already have

`vector` is one of the 22 base types in `property_base_types()` (408).
**pgvector 0.8.0 is installed.** Object instances live in per-type tables under
the `objects` schema (E1/E2). Zero vector properties exist today.

So the missing pieces are exactly: a declared dimension, a typed column, and the
query.

---

## Decisions

1. **We do not embed, and should not.** Generation is Pipeline Builder, a
   transform, or a function calling a model — three documented routes, none of
   them the ontology. Building an embedding call here would be inventing a
   fourth and putting a model dependency inside the schema.
2. **A `vector` property declares its dimension.** Forced by "the search vector
   must be the same size as the one used for indexing": required exactly when
   `base_type = 'vector'`, and `0 < dimension <= 2048` from the same sentence.
3. **The backing column is `vector(d)`**, pgvector's typed form, so the
   dimension is enforced by the column rather than by a check we maintain. The
   extension is already installed.
4. **k is validated `0 < k <= 100`** and a mismatched query vector is refused by
   name — "An error will be thrown if any of these limits are exceeded" is the
   documented behaviour, so silence would be the divergence.
5. **A KNN result is unordered unless relevance is asked for.** The object set
   "cannot be sorted by relevancy"; the function path calls `.orderByRelevance()`.
   Two shapes, and conflating them would give the no-code path a capability the
   page says it lacks.
6. **`enableVectorProperties` is recorded, not built** — it is a setting on a
   code repository we do not have.
7. **Not built from this reading yet.** These Decisions want reciting first.

## Questions

1. **Which distance measure?** Every statement is "nearest" or "close in
   N-dimensional space"; no page names cosine, L2 or inner product. pgvector
   requires the choice at query time (`<=>`, `<->`, `<#>`) and at index time.
   `text-embedding-ada-002` is normalised, which makes cosine and inner product
   equivalent for it, but that is a fact about the model rather than a
   documented Foundry decision. `blocks:` the operator, and it must be marked
   inference wherever it lands.
2. **Is the 2048 limit the property's or the backend's?** Stated once, in a
   callout about KNN queries rather than about property definition. Applying it
   at declaration is the strict reading and the useful one — a property you
   cannot search is worse than a refused declaration — but it is a choice.
3. **Does a vector property participate in ordinary filters?** It is listed
   under "property base types with **limited support**" and the KNN path is the
   only one shown. Nothing says whether it can be selected, sorted or filtered
   conventionally. `blocks:` whether the render hints
   (`searchable`/`sortable`/`selectable`) mean anything for it.
