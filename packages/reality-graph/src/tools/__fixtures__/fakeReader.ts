// Shared fake GraphReader for tool tests. Pure in-memory; one builder so
// tests stay declarative — describe the world, assert what the tool returns.

import type {
  DocumentChunkMatch,
  DocumentRow,
  GraphReader,
  HotelRow,
  PrincipleRecord,
  RestockRequestRow,
  StockLogRow,
  SupplierRow,
  VariantRow,
} from '../graph_reader'

export interface FakeReaderSeed {
  variants?:           VariantRow[]
  restockRequests?:    RestockRequestRow[]
  stockLogs?:          StockLogRow[]
  sisterHotels?:       HotelRow[]
  suppliersByVariant?: Record<string, SupplierRow[]>
  documentsByEntity?:  Record<string, DocumentRow[]>
  chunkMatches?:       DocumentChunkMatch[]
  principles?:         PrincipleRecord[]
}

export function fakeReader(seed: FakeReaderSeed = {}): GraphReader {
  return {
    getVariant: (id) =>
      Promise.resolve(seed.variants?.find((v) => v.id === id) ?? null),

    getOpenRestockRequests: (variantId) =>
      Promise.resolve((seed.restockRequests ?? []).filter((r) => r.variant_id === variantId)),

    getStockLogs: (variantId) =>
      Promise.resolve((seed.stockLogs ?? []).filter((l) => l.variant_id === variantId)),

    getSisterHotels: () =>
      Promise.resolve(seed.sisterHotels ?? []),

    getVariantsByName: (name, hotelIds) =>
      Promise.resolve(
        (seed.variants ?? []).filter((v) => v.name === name && hotelIds.includes(v.hotel_id)),
      ),

    getSuppliersForVariant: (variantId) =>
      Promise.resolve(seed.suppliersByVariant?.[variantId] ?? []),

    getDocumentsForEntity: (entityType, entityId) =>
      Promise.resolve(seed.documentsByEntity?.[`${entityType}:${entityId}`] ?? []),

    searchDocumentChunks: () =>
      Promise.resolve(seed.chunkMatches ?? []),

    getActivePrinciples: () =>
      Promise.resolve(seed.principles ?? []),
  }
}

// ── canonical UUIDs (so tests can read like prose) ───────────────────────────
export const ids = {
  variant1:  '00000000-0000-4000-8000-000000000001',
  variant2:  '00000000-0000-4000-8000-000000000002',
  variant3:  '00000000-0000-4000-8000-000000000003',
  hotelA:    '00000000-0000-4000-8000-00000000000a',
  hotelB:    '00000000-0000-4000-8000-00000000000b',
  hotelC:    '00000000-0000-4000-8000-00000000000c',
  supplier1: '00000000-0000-4000-8000-000000000a01',
  supplier2: '00000000-0000-4000-8000-000000000a02',
  supplier3: '00000000-0000-4000-8000-000000000a03',
  request1:  '00000000-0000-4000-8000-000000000b01',
  request2:  '00000000-0000-4000-8000-000000000b02',
  document1: '00000000-0000-4000-8000-000000000c01',
}
