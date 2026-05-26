import { describe, expect, it } from 'vitest'
import { makeQueryDocumentChunksTool } from './query_document_chunks'
import { fakeReader, ids } from '../__fixtures__/fakeReader'

describe('query_document_chunks', () => {
  it('returns empty when no semantic matches', async () => {
    const tool = makeQueryDocumentChunksTool(fakeReader())
    const r = await tool.invoke({ hotelId: ids.hotelA, query: 'late delivery penalty' })
    expect(r).toEqual({ matches: [], query: 'late delivery penalty', totalMatches: 0 })
  })

  it('passes through the reader matches', async () => {
    const tool = makeQueryDocumentChunksTool(fakeReader({
      chunkMatches: [
        { id: 'c-1', document_id: ids.document1, chunk_key: 'p4', page: 4, text_preview: 'Late delivery penalty: 5%.', similarity: 0.92 },
        { id: 'c-2', document_id: ids.document1, chunk_key: 'p7', page: 7, text_preview: 'Exclusivity window: 30 days.', similarity: 0.71 },
      ],
    }))
    const r = await tool.invoke({ hotelId: ids.hotelA, query: 'late delivery penalty' })
    expect(r.totalMatches).toBe(2)
    expect(r.matches.map((m) => m.similarity)).toEqual([0.92, 0.71])
  })

  it('respects the limit parameter', async () => {
    const tool = makeQueryDocumentChunksTool(fakeReader({
      chunkMatches: [
        { id: 'c-1', document_id: ids.document1, chunk_key: 'p1', page: 1, text_preview: 'a', similarity: 0.9 },
        { id: 'c-2', document_id: ids.document1, chunk_key: 'p2', page: 2, text_preview: 'b', similarity: 0.8 },
        { id: 'c-3', document_id: ids.document1, chunk_key: 'p3', page: 3, text_preview: 'c', similarity: 0.7 },
      ],
    }))
    const r = await tool.invoke({ hotelId: ids.hotelA, query: 'x', limit: 2 })
    expect(r.matches).toHaveLength(2)
    expect(r.totalMatches).toBe(3) // total = pre-truncation
  })
})
