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

## Resolved: four samples show two archetypes

Three more agreements settled the question the first one could only raise.

| sample | price |
|---|---|
| **ΝΕ.ΔΗ.ΚΕ.Π Πρέβεζας 2013** | itemised and fixed — 894,00 / 464,00 / +160 installation, ΦΠΑ 23%, total **1.867,14** |
| ΗΛΙΑΚΤΙΔΑ 2/2023 | price grid blank; quantities explicitly non-binding |
| Supply Agreement (US) | *"as specified in each purchase order"* |
| Supply Agreement Rev.133C84E | *"$___ per unit … specified in each Purchase Order"* |

**One of four names a price in the contract.** The operator confirms the pattern:
*"prices for hospitality are not standard and are subject to change in each
Purchase order, but we should be able to adapt to both."*

So there are two archetypes, not one wrong model:

- **Priced line** — the contract fixes the number (Πρέβεζα)
- **Framework agreement** — the contract governs *how* orders work; price is set
  on each PO

`supplier_contracts` had `variant_id` and `contracted_price` both `NOT NULL`, so
it could represent the first and **not the other three**. That is why
`get_contract_terms` reported "no contract covers this variant and supplier" for
a real fifteen-page agreement — not a lookup bug, a shape that could not hold the
thing.

Migration 301 adds `pricing_basis` (`fixed_in_contract` / `per_purchase_order` /
`quoted_on_request`), makes variant and price nullable, and keeps a CHECK so a
"fixed" row must still carry its price. A framework agreement now answers
*"there is an agreement, price is set per purchase order"* — a different and more
useful answer than *"no contract"*.

`payment_terms_days` came along because three of the four state it explicitly and
it is the one governing term that is unambiguously a number.

## Deliberately not built yet

A clause-to-decision path is the obvious next move and the obvious place to
overbuild. Before any of it:

- **no `supplier_contract` row exists for this document** — the typed contract and
  the contract document are unconnected, and there is no link type between them
- the **clause** path is still unconnected to decisions. Four samples showed the
  pricing split cleanly; they do NOT yet show which *clauses* generalise —
  Πρέβεζα has almost none, ΗΛΙΑΚΤΙΔΑ has 27. Penalties, delivery windows and
  replacement obligations stay in the document path until that is clearer.

Recorded rather than acted on, per the stage directive: a wrong guess here
becomes structure.

## Honest limitation of this test

The document was **transcribed from rendered images**, not parsed from the PDF, so
the OCR/vision stage was not exercised and page numbers are chunk-derived — the
copilot's *"p. 2"* refers to a chunk group, not to page 2 of the original. With a
real PDF the citations would carry true source pages.


---

# Quotes are a different class, and they do not fit

**Tested 2026-08-01** against four more samples, all of them *offers* rather than
agreements:

| sample | shape |
|---|---|
| QUOTATION QT10000 | $12,500 painting work · **30% deposit / 70% on completion** · **validity 90 days** |
| VENDOR QUOTE 0000226 | line items with QTY / unit price / amount · subtotal 575.00, tax 5%, **total 603.75** · payment due 14 days |
| SAMPLE SUPPLIER LTD | £72,000 + VAT 20% · **30% order / 60% delivery / 10% commissioning** · valid 30 days · delivery 3 weeks from deposit |
| ΤΙΜΟΛΟΓΙΟ ΠΡΟΣΦΟΡΑΣ (Δημοτικό Βρεφοκομείο Αθηνών, 2015) | blank offer form, *«για συμπλήρωση… από τον υποψήφιο προμηθευτή»* — unit price columns **ΑΡΙΘΜΗΤΙΚΩΣ and ΟΛΟΓΡΑΦΩΣ**, both empty, **no quantity column** |

plus a **STATE OF SOUTH DAKOTA Request for Quote** — a blank form travelling the
*other* direction, buyer soliciting vendors.

## Why they do not go in `supplier_contracts`

**A quote is not an agreement.** It is a unilateral, time-limited offer that
binds nobody until accepted. Storing one as a contract would make the system
believe an agreement exists when it does not — the same class of error as the
expired price `get_contract_price` used to return, and worse, because it would be
wrong from the moment it was written.

Three concrete mismatches:

1. **Validity is a different clock.** *"Valid 90 days from the date of this
   quote"* is how long the **offer stands**, not how long **supply runs**.
   Mapping it onto `contract_start`/`contract_end` conflates the two.
2. **Payment milestones are not a number of days.** *"30% deposit / 60% on
   delivery / 10% on commissioning"* is a **schedule**. `payment_terms_days`,
   added in 301 because three of four contracts stated a plain number, cannot
   hold it — and these samples show that number is not universal.
3. **There is no acceptance state.** `is_active` is a human flag on an agreement,
   not `offered → accepted → expired → lost`.

The RFQ is not an agreement at all — it is a **request**, and it belongs to
whoever is running the sourcing round, not to a supplier relationship.

## What they show is missing

A lifecycle, of which we hold the back half:

```
RFQ  →  quote  →  contract  →  purchase order  →  invoice
 ✗        ✗          ✓             ✓                 ✓
```

`purchase_order`, `po_invoice` and (since #457) `supplier_contract` are typed.
**RFQ and quote are not**, and a quote is the one with an obvious consumer:
`rank_alternative_suppliers` could rank on a *quoted* price with a *validity*,
which is a better basis than a list price.

## Still not built, and why

Every quote sample is a **template or a generic example** — none is a real offer,
from a real supplier, for a variant this system stocks. Same blocker as the
contracts arc had: the shape is legible, the data is not there.

Typing `quote` now would mean inventing an acceptance lifecycle and a milestone
schedule from four documents that agree on neither. Two of the four state
milestones, two state plain terms; one has quantities, one explicitly has none.

**What all of them do work as, today: documents.** The pipeline ingests them,
extracts terms, and answers cited questions — proven on ΗΛΙΑΚΤΙΔΑ. That is the
honest current answer to *"do these work?"*: **yes as documents, no as contract
rows, and the gap they reveal is a quote object nobody can populate yet.**


---

# Invoices do not reference the contract

**Operator, 2026-08-01:** *"The invoice doesn't reference the contract — there
will be the company name and the supplier name in the invoice, and probably in
the purchase order. For the invoice I'm 100% sure, for PO 80%."*

This settles a link I was about to design and would have got wrong.

`invoice → contract` **cannot be a foreign key read off the document**, because
the document does not carry the reference. It has to be **resolved**:

```
supplier name on the invoice  →  supplier entity  →  the agreement in force on that date
```

That is a harmonization problem, not a link problem — and harmonization already
exists for suppliers, extracting and resolving named entities out of ingested
documents. The same machinery that matched "ILIAKTIDA" out of the contract is
what would match a supplier name off an invoice.

Two consequences worth writing down before Monday:

1. **The join is by name and date, so it is fallible.** Two agreements with one
   supplier, overlapping windows, and the resolution is ambiguous. That argues
   for surfacing the match as a *suggestion* with a confidence — the shape
   `entity_link_suggestions` already has — rather than writing a silent FK.
2. **The PO is only 80% certain to carry the supplier name.** Anything built on
   "the PO names the supplier" needs to degrade when it does not, rather than
   assume.

Not built. Recorded so the design starts from what the documents actually
contain.
