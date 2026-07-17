// In-memory GraphReader + LLM responses for the overstock_rebalancer eval.
// Stable UUIDs so cases are reproducible.

import type {
  GraphReader,
  HotelRow,
  PrincipleRecord,
  RestockRequestRow,
  StockLogRow,
  SupplierRow,
  VariantRow,
} from '../../../tools/graph_reader'
import { StubLLMClient } from '../../llm'
import type { LLMResponse } from '../../llm'

export const IDS = {
  org:        '13333333-3333-4333-8333-333333333333',
  hotelA:     '23333333-3333-4333-8333-333333333333',
  hotelB:     '23333333-3333-4333-8333-333333333334',
  hotelC:     '23333333-3333-4333-8333-333333333335',
  user:       '33333333-3333-4333-8333-333333333333',
  varSugarA:  '43333333-3333-4333-8333-333333333333',
  varSugarB:  '43333333-3333-4333-8333-333333333334',
  varSugarC:  '43333333-3333-4333-8333-333333333335',
} as const

export interface FixtureWorld {
  variants:        VariantRow[]
  restockRequests: RestockRequestRow[]
  stockLogs:       StockLogRow[]
  hotels:          HotelRow[]
  suppliers:       SupplierRow[]
  principles?:     PrincipleRecord[]
  /** variantId -> supplierIds that actually stock it (the `sourced_from` edges). */
  sourcedFrom?:    Record<string, string[]>
}

export function emptyWorld(): FixtureWorld {
  return { variants: [], restockRequests: [], stockLogs: [], hotels: [], suppliers: [], principles: [] }
}

export function makeReader(world: FixtureWorld): GraphReader {
  return {
    getVariant: (id) => Promise.resolve(world.variants.find((v) => v.id === id) ?? null),
    getOpenRestockRequests: (variantId) =>
      Promise.resolve(world.restockRequests.filter((r) => r.variant_id === variantId)),
    getStockLogs: (variantId, sinceDays) => {
      const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000
      return Promise.resolve(
        world.stockLogs.filter(
          (l) => l.variant_id === variantId && new Date(l.created_at).getTime() >= cutoff,
        ),
      )
    },
    getSisterHotels: (hotelId) => {
      const self = world.hotels.find((h) => h.id === hotelId)
      if (!self) return Promise.resolve([])
      return Promise.resolve(
        world.hotels.filter((h) => h.organization_id === self.organization_id && h.id !== hotelId),
      )
    },
    getVariantsByName: (name, hotelIds) => {
      const set = new Set(hotelIds)
      return Promise.resolve(world.variants.filter((v) => v.name === name && set.has(v.hotel_id)))
    },
    // Mirrors the REAL reader (migration 202): traverse variant --sourced_from-->
    // supplier; fall back to the hotel's suppliers only when a variant has no
    // sourcing modelled. Ignoring variantId here reproduced a production bug, so
    // the evals agreed with it instead of catching it (#357/#360).
    getSuppliersForVariant: (variantId) => {
      const ids = world.sourcedFrom?.[variantId]
      if (!ids) return Promise.resolve(world.suppliers)
      const linked = world.suppliers.filter((s) => ids.includes(s.id))
      return Promise.resolve(linked.length > 0 ? linked : world.suppliers)
    },
    getDocumentsForEntity:  (_entityType, _entityId) => Promise.resolve([]),
    searchDocumentChunks:   (_hotelId, _query, _opts) => Promise.resolve([]),
    getActivePrinciples:    (_hotelId, _orgId) => Promise.resolve(world.principles ?? []),
  }
}

/** overstock_rebalancer has one extract block — a single scripted response. */
export function scriptedLLM(args: {
  variantId: string
  variantName: string
  variantConfidence?: number
}): StubLLMClient {
  const responses: LLMResponse[] = [
    {
      output: {
        variantId: args.variantId,
        variantName: args.variantName,
        confidence: args.variantConfidence ?? 0.9,
      },
      toolCalls: [],
      tokensUsed: 120,
    },
  ]
  return new StubLLMClient(responses)
}

/** N days of consumption logs at a target daily burn rate. */
export function dailyConsumptionLogs(args: {
  variantId: string
  hotelId: string
  dailyUnits: number
  days?: number
}): StockLogRow[] {
  const days = args.days ?? 30
  const logs: StockLogRow[] = []
  const now = Date.now()
  for (let i = 0; i < days; i++) {
    logs.push({
      id: `log-${args.variantId.slice(0, 8)}-${String(i)}`,
      variant_id: args.variantId,
      hotel_id: args.hotelId,
      delta: -args.dailyUnits,
      created_at: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
    })
  }
  return logs
}
