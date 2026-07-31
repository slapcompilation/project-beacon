import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'

const inputSchema = z.object({
  variantId:  z.string().uuid(),
  supplierId: z.string().uuid(),
})

const outputSchema = z.object({
  contracted:    z.boolean(),
  /** Agreed unit price. Null when no contract covers this pair. */
  price:         z.number().nullable(),
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
      'The agreed price and minimum order quantity for a variant from a specific supplier, and whether that agreement is in force today. ' +
      'Prefer this over reading a contract document when the question is price or MOQ — it is the structured term, not a snippet. ' +
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
          contracted: false, price: null, minOrderQty: null, validUntil: null,
          inForce: false, basis: 'no contract covers this variant and supplier', confidence: 1,
        },
      },
    ],
    invoke: async (input) => {
      const terms = await reader.getContractTerms?.(input.variantId, input.supplierId)
      if (!terms) {
        // No agreement is a definite answer, not a missing one — hence
        // confidence 1. The agent should price from the supplier list instead.
        return {
          contracted: false, price: null, minOrderQty: null, validUntil: null,
          inForce: false, basis: 'no contract covers this variant and supplier', confidence: 1,
        }
      }
      return {
        contracted:  true,
        price:       terms.contractedPrice,
        minOrderQty: terms.minOrderQty,
        validUntil:  terms.validUntil,
        inForce:     terms.inForce,
        basis:       terms.basis,
        confidence:  1,   // a stored agreement is a fact, not an estimate
      }
    },
  }
}
