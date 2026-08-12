// The global search bar's read path, on real Lucene. The scope comes from the
// database with the caller's own claims — search_visible_types() is 443's
// priority list — and the query is Lucene query-string syntax, which is the
// documented syntax verbatim: quoted phrases, AND/OR/NOT with parentheses,
// `*` and `?` wildcards, `~` fuzzy (object-explorer/search-syntax.md).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const OPENSEARCH_URL = Deno.env.get('OPENSEARCH_URL') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

interface VisibleType {
  object_type_id: string
  object_type_label: string
  index_table: string
  title_property: string
  primary_key_property: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (OPENSEARCH_URL === '') return reply(503, { error: 'OPENSEARCH_URL is not configured' })

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return reply(401, { error: 'sign in first' })

  const { query, limit = 8 } = await req.json() as { query?: string; limit?: number }
  if (!query || query.trim() === '') return reply(200, { hits: [] })

  // The caller's claims decide the scope, not this function.
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  })
  const { data, error } = await asCaller.rpc('search_visible_types')
  if (error) return reply(400, { error: error.message })
  const types = (data ?? []) as VisibleType[]
  if (types.length === 0) return reply(200, { hits: [] })

  const byIndex = new Map(types.map((t) => [t.index_table, t]))
  const search = await fetch(
    `${OPENSEARCH_URL}/${types.map((t) => t.index_table).join(',')}/_search?ignore_unavailable=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        size: Math.min(Math.max(limit, 1), 25),
        query: { query_string: { query, fields: ['*'], lenient: true, default_operator: 'OR' } },
      }),
    })
  if (!search.ok) return reply(502, { error: `search failed: ${await search.text()}` })

  const result = await search.json() as {
    hits: { hits: { _index: string; _id: string; _source: Record<string, unknown> }[] }
  }
  const hits = result.hits.hits.flatMap((h) => {
    const t = byIndex.get(h._index)
    if (!t) return []
    return [{
      object_type_id: t.object_type_id,
      object_type_label: t.object_type_label,
      primary_key: h._id,
      title: String(h._source[t.title_property] ?? h._id),
    }]
  })
  return reply(200, { hits })
})
