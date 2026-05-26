import { describe, expect, it } from 'vitest'
import { makeQueryVariantDocumentsTool } from './query_variant_documents'
import { fakeReader, ids } from '../__fixtures__/fakeReader'

describe('query_variant_documents', () => {
  it('returns empty arrays when nothing linked', async () => {
    const tool = makeQueryVariantDocumentsTool(fakeReader())
    const r = await tool.invoke({ variantId: ids.variant1 })
    expect(r).toEqual({ documents: [], totalChunks: 0 })
  })

  it('hydrates per-page chunks and sums totalChunks', async () => {
    const tool = makeQueryVariantDocumentsTool(fakeReader({
      documentsByEntity: {
        [`variant:${ids.variant1}`]: [
          {
            id: ids.document1, title: 'Sysco contract', mime_type: 'application/pdf',
            ingestion_stage: 'linked', created_at: '2026-01-01',
            chunks: [
              { chunk_id: 'c-1', page: 1, text_preview: 'Lead time: 2 business days.' },
              { chunk_id: 'c-2', page: 4, text_preview: 'Late delivery penalty: 5%.' },
            ],
          },
        ],
      },
    }))
    const r = await tool.invoke({ variantId: ids.variant1 })
    expect(r.documents).toHaveLength(1)
    expect(r.documents[0].chunks).toHaveLength(2)
    expect(r.totalChunks).toBe(2)
  })

  it('tolerates null chunks (raw / pre-OCR documents)', async () => {
    const tool = makeQueryVariantDocumentsTool(fakeReader({
      documentsByEntity: {
        [`variant:${ids.variant1}`]: [
          { id: ids.document1, title: 'Raw upload', mime_type: 'application/pdf',
            ingestion_stage: 'raw', created_at: '2026-01-01', chunks: null },
        ],
      },
    }))
    const r = await tool.invoke({ variantId: ids.variant1 })
    expect(r.documents[0].chunks).toEqual([])
    expect(r.totalChunks).toBe(0)
  })
})
