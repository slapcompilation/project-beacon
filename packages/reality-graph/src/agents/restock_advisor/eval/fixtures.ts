// In-memory GraphReader + LLM responses used by the eval suite.
// Stable UUIDs so cases are reproducible.

import type {
  GraphReader,
  HotelRow,
  RestockRequestRow,
  StockLogRow,
  SupplierRow,
  VariantRow,
} from '../../../tools/graph_reader'
import { StubLLMClient } from '../../llm'
import type { LLMResponse } from '../../llm'

export const IDS = {
  org:          '11111111-1111-4111-8111-111111111111',
  hotelA:       '21111111-1111-4111-8111-111111111111',
  hotelB:       '21111111-1111-4111-8111-111111111112',
  hotelC:       '21111111-1111-4111-8111-111111111113',
  user:         '31111111-1111-4111-8111-111111111111',
  varTomatoesA: '41111111-1111-4111-8111-111111111111',
  varTomatoesB: '41111111-1111-4111-8111-111111111112',
  varTomatoesC: '41111111-1111-4111-8111-111111111113',
  supplierFast: '51111111-1111-4111-8111-111111111111',
  supplierSlow: '51111111-1111-4111-8111-111111111112',
} as const

export interface FixtureWorld {
  variants: VariantRow[]
  restockRequests: RestockRequestRow[]
  stockLogs: StockLogRow[]
  hotels: HotelRow[]
  suppliers: SupplierRow[]
}

export function emptyWorld(): FixtureWorld {
  return { variants: [], restockRequests: [], stockLogs: [], hotels: [], suppliers: [] }
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
      return Promise.resolve(
        world.variants.filter((v) => v.name === name && set.has(v.hotel_id)),
      )
    },
    getSuppliersForVariant: (_variantId) => Promise.resolve(world.suppliers),
    getDocumentsForEntity:  (_entityType, _entityId) => Promise.resolve([]),
  }
}

/**
 * Builds a script with the variant resolution + supplier extraction responses
 * the two extract blocks need. Defaults match the most common eval cases.
 */
export function scriptedLLM(args: {
  variantId: string
  variantName: string
  variantConfidence?: number
  supplierName?: string | null
  supplierConfidence?: number
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
    {
      output: {
        supplierName: args.supplierName ?? null,
        confidence: args.supplierConfidence ?? 0.8,
      },
      toolCalls: [],
      tokensUsed: 80,
    },
  ]
  return new StubLLMClient(responses)
}

/** Helper to generate 30 days of consumption logs at a target daily rate. */
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
