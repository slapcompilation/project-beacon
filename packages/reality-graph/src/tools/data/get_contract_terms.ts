import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'

const inputSchema = z.object({
  variantId:  z.string().uuid(),
  supplierId: z.string().uuid(),
})

const outputSchema = z.object({
  contracted:    z.boolean(),
  /** Agreed unit price. Null when no contract covers this pair — and ALSO null
   *  on a framework agreement, where the price is set per purchase order. Those
   *  two are different answers; read pricingBasis to tell them apart. */
  price:         z.number().nullable(),
  /** How the price is determined. Four real supply agreements were checked and
   *  only one named a price in the contract itself; per-PO is the normal case
   *  in hospitality. */
  pricingBasis:  z.enum(['fixed_in_contract', 'per_purchase_order', 'quoted_on_request']).nullable(),
  paymentTermsDays: z.number().int().nullable(),
  /** The agreement this term came from. Cite it — a contracted number with no
   *  source is the one claim in a proposal nobody can audit. */
  documentId:    z.string().uuid().nullable(),
  documentTitle: z.string().nullable(),
  /** Minimum order quantity the agreement requires, if any. */
  minOrderQty:   z.number().int().nullable(),
  validUntil:    z.string().nullable(),
  /** True only when the agreement is flagged active AND today is inside its
   *  window. An expired contract is reported, not hidden — the agent should be
   *  able to say "we had a price and it lapsed". */
  inForce:       z.boolean(),
  basis:         z.string(),
  confidence:    z.number().min(0).max(1),
})

export type GetContractTermsInput  = z.infer<typeof inputSchema>
export type GetContractTermsOutput = z.infer<typeof outputSchema>

/**
 * The agreed commercial terms for one variant from one supplier.
 *
 * Exists because the agents were told to read contract terms out of PROSE —
 * "price clauses, lead-time SLAs, exclusivity windows" via
 * query_variant_documents — while the same hotel could have the price typed
 * into the Contracts page and structured in supplier_contracts. Scraping a PDF
 * for a number somebody already entered is the gap this closes.
 *
 * Document search still matters for everything a contract table cannot hold —
 * no-transfer clauses, storage constraints, return policies. This is for the
 * terms that are structured, and it beats a snippet because it is exact.
 */
export function makeGetContractTermsTool(
  reader: GraphReader,
): LogicTool<GetContractTermsInput, GetContractTermsOutput> {
  return {
    name: 'get_contract_terms',
    category: 'data',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'The agreed terms for a variant from a specific supplier: price if the contract fixes one, minimum order quantity, payment terms, and whether the agreement is in force today. ' +
      'IMPORTANT: price null with contracted=true means there IS an agreement and the price is set on each purchase order (pricingBasis=per_purchase_order) — that is the normal case, not a missing contract. Say so rather than reporting no agreement. ' +
      'Prefer this over reading a contract document when the question is price, MOQ or payment terms — it is the structured term, not a snippet. ' +
      'An expired agreement is returned with inForce=false and a basis saying when it lapsed, so a lapsed price can be named rather than quoted as current.',
    inputSchema,
    outputSchema,
    traversableLinks: ['contracted_with', 'contract_covers'],
    examples: [
      {
        input: {
          variantId:  '00000000-0000-0000-0000-000000000000',
          supplierId: '00000000-0000-0000-0000-000000000001',
        },
        output: {
          contracted: false, price: null, pricingBasis: null, paymentTermsDays: null,
          documentId: null, documentTitle: null,
          minOrderQty: null, validUntil: null, inForce: false,
          basis: 'no contract covers this variant and supplier', confidence: 1,
        },
      },
    ],
    invoke: async (input) => {
      const terms = await reader.getContractTerms?.(input.variantId, input.supplierId)
      if (!terms) {
        // No agreement is a definite answer, not a missing one — hence
        // confidence 1. The agent should price from the supplier list instead.
        return {
          contracted: false, price: null, pricingBasis: null, paymentTermsDays: null,
          documentId: null, documentTitle: null,
          minOrderQty: null, validUntil: null, inForce: false,
          basis: 'no contract covers this variant and supplier', confidence: 1,
        }
      }
      return {
        contracted:       true,
        price:            terms.contractedPrice,
        pricingBasis:     terms.pricingBasis,
        paymentTermsDays: terms.paymentTermsDays,
        documentId:       terms.documentId,
        documentTitle:    terms.documentTitle,
        minOrderQty:      terms.minOrderQty,
        validUntil:       terms.validUntil,
        inForce:          terms.inForce,
        basis:            terms.basis,
        confidence:       1,   // a stored agreement is a fact, not an estimate
      }
    },
  }
}
