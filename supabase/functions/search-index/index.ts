// Rebuild one object type's OpenSearch index. A thin pusher: the database
// owns the shape — search_index_payload() hands over the index name, the
// mappings derived from analyzers and render hints, and every document — and
// this function only carries it to the cluster. Postgres stays the source of
// truth; the search index is derived and disposable, the same standing the
// objects schema has.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const OPENSEARCH_URL = Deno.env.get('OPENSEARCH_URL') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

interface Payload {
  index: string
  primary_key: string
  mappings: Record<string, unknown>
  documents: Record<string, unknown>[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (OPENSEARCH_URL === '') return reply(503, { error: 'OPENSEARCH_URL is not configured' })

  // The caller must be a signed-in user; the payload read runs as service.
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return reply(401, { error: 'sign in first' })

  const { objectTypeId } = await req.json() as { objectTypeId?: string }
  if (!objectTypeId) return reply(400, { error: 'objectTypeId is required' })

  const service = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data, error } = await service.rpc('search_index_payload', { p_object_type: objectTypeId })
  if (error) return reply(400, { error: error.message })
  const payload = data as Payload | null
  if (payload === null) return reply(200, { indexed: 0, note: 'the type has no successful index' })

  // Recreate, then bulk. The index is disposable — a rebuild IS the update.
  await fetch(`${OPENSEARCH_URL}/${payload.index}`, { method: 'DELETE' })
  const created = await fetch(`${OPENSEARCH_URL}/${payload.index}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mappings: payload.mappings }),
  })
  if (!created.ok) return reply(502, { error: `index creation failed: ${await created.text()}` })

  if (payload.documents.length > 0) {
    const ndjson = payload.documents.flatMap((doc) => [
      JSON.stringify({ index: { _id: String(doc[payload.primary_key]) } }),
      JSON.stringify(doc),
    ]).join('\n') + '\n'
    const bulk = await fetch(`${OPENSEARCH_URL}/${payload.index}/_bulk?refresh=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-ndjson' },
      body: ndjson,
    })
    const result = await bulk.json() as { errors?: boolean; items?: unknown[] }
    if (!bulk.ok || result.errors) return reply(502, { error: 'bulk indexing reported errors', result })
  }

  return reply(200, { index: payload.index, indexed: payload.documents.length })
})
