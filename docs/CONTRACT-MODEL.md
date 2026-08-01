# What a real supply contract turned out to be

**Tested 2026-08-01** against a genuine Greek public-procurement supply agreement:
ΗΛΙΑΚΤΙΔΑ Α.Μ.Κ.Ε., διακήρυξη 2/2023, ΕΣΗΔΗΣ 181688 — 15 pages, bakery /
confectionery / frozen goods for accommodation structures for unaccompanied minors.

Ingested through the real pipeline. This document records what it showed, because
it contradicts the model shipped in #457 one day earlier.

## What the pipeline did

| | |
|---|---|
| chunks | **36** |
| mentions | **71** |
| sensitivity | `internal` → **`confidential`**, auto-raised |
| PII detected | email, phone |
| stage | `contextualized` |

The sensitivity scanner earning its place is worth stating on its own: the
document was uploaded as `internal` and the pipeline **raised** it after finding
contact details. Nobody had to remember to classify it.

Asked an operator's question — *"supplier delivered late and boxes arrived
damaged, what does the contract say?"* — the copilot answered from the document
with article-level references: **4% penalty on the late shipment (Art. 7.2), one
day to replace defective goods (Art. 3.11), and the right to buy on the open
market with the supplier bearing the difference (Art. 3.12).** In English, from a
Greek legal text.

## The finding: a contract is a bundle of clauses, not a price row

The entity extractor pulled out **27 distinct `clause:` entities** unprompted —
late delivery penalty, performance guarantee, defective product replacement,
quality control, laboratory test, ownership transfer, force majeure, assignment
restriction, hygiene standard, confidentiality, indemnification, financial record
retention, sexual-exploitation-and-abuse prevention…

`supplier_contracts` models exactly one thing:

```
(supplier_id, variant_id, contracted_price, min_order_qty, contract_start, contract_end)
```

**Not one of those 27 clauses has anywhere to go.** And the parts the table *does*
model are the parts this contract does not have:

- the price table (`ΠΙΝΑΚΑΣ ΤΩΝ ΥΠΟ ΠΡΟΜΗΘΕΙΑ ΕΙΔΩΝ`) is a **blank template grid** —
  CPV, item, packaging, unit, estimated quantity, unit price, all placeholders
- quantities are **explicitly non-binding** (Art. 3.4: *"ενδεικτικές και δεν είναι
  δεσμευτικές"*, adjustable to the residents' needs)
- there is **no minimum order quantity**; delivery is *"σταδιακά και όχι μαζικά"* —
  gradually, not in bulk, ordered by phone one day ahead, delivered by 09:00

So `get_contract_terms`, shipped in #457, returns *"no contract covers this variant
and supplier"* for this contract. That answer is **correct and useless**.

## What the decision-relevant terms actually are

Not price. **Obligations with deadlines:**

| term | value | what it feeds |
|---|---|---|
| order notice | 1 calendar day | lead time |
| delivery window | by 09:00, Mon–Fri | scheduling |
| replacement window | 1 day | supplier reliability |
| late-delivery penalty | 4% of the late value | cost of a miss |
| payment terms | 90 days | cash flow |
| performance guarantee | 4% of contract value | supplier risk |

Every one of those is something `rank_alternative_suppliers` scores on, and none
of them is a price.

## What this means

1. **The document path is the working one.** Ingestion → chunks → typed clause
   entities → cited answer already works, on a real 15-page legal document in
   Greek. That is the ontology doing its job.
2. **The structured path is shaped for a price list.** `supplier_contracts` is a
   *contracted price line*, which is a real thing some agreements have — and this
   one does not.
3. **The gap is that a clause cannot reach a decision.** The extractor typed
   "late delivery penalty" as an entity; nothing links it to the supplier, and
   `rank_alternative_suppliers` cannot see it.

## Deliberately not built yet

A clause-to-decision path is the obvious next move and the obvious place to
overbuild. Before any of it:

- **no `supplier_contract` row exists for this document** — the typed contract and
  the contract document are unconnected, and there is no link type between them
- the sample is **one contract**. One document told us the model is wrong; it
  cannot tell us what the right one is. A second and third would show whether
  "clauses with deadlines" generalises or whether this is procurement-specific.

Recorded rather than acted on, per the stage directive: a wrong guess here
becomes structure.

## Honest limitation of this test

The document was **transcribed from rendered images**, not parsed from the PDF, so
the OCR/vision stage was not exercised and page numbers are chunk-derived — the
copilot's *"p. 2"* refers to a chunk group, not to page 2 of the original. With a
real PDF the citations would carry true source pages.
