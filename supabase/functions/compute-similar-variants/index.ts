// Edge Function: compute-similar-variants
// Layer: Eye — Semantic similarity (similar_to edge computation)
//
// Nightly job (or manual trigger) that:
//   1. Fetches variant consumption profiles for the hotel
//   2. Generates text embeddings via OpenAI
//   3. Stores in variant_embeddings
//   4. Runs cosine similarity to find top-5 nearest neighbours per variant
//   5. Writes similar_to edges to relationship_edges
//
// Required env vars: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SIMILARITY_THRESHOLD = 0.82   // cosine similarity floor
const TOP_K                = 5      // neighbours per variant

interface VariantProfile {
  variant_id:   string
  hotel_id:     string
  product_name: string
  variant_name: string
  category:     string | null
  avg_daily:    number
  waste_rate:   number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const apiKey      = Deno.env.get('OPENAI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

    const sb = createClient(supabaseUrl, serviceKey)

    // Accept hotel_id as query param for per-hotel runs
    const url     = new URL(req.url)
    const hotelId = url.searchParams.get('hotel_id')

    // 1. Fetch consumption profiles
    let query = sb.rpc('get_consumption_stats', { p_window_days: 30 })
    if (hotelId) query = sb.rpc('get_consumption_stats', { p_window_days: 30, p_hotel_id: hotelId })

    const { data: profiles, error: profErr } = await query as unknown as {
      data: VariantProfile[] | null
      error: { message: string } | null
    }
    if (profErr) throw new Error(profErr.message)
    if (!profiles?.length) return new Response(JSON.stringify({ written: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

    // 2. Build text representations
    const texts = profiles.map((p) =>
      `${p.product_name} ${p.variant_name !== 'Standard' ? p.variant_name : ''} ` +
      `category:${p.category ?? 'uncategorised'} ` +
      `daily_usage:${p.avg_daily.toFixed(2)} ` +
      `waste_rate:${p.waste_rate.toFixed(2)}`
    )

    // 3. Embed in batches of 100 (OpenAI limit)
    const allEmbeddings: number[][] = []
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100)
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method:  'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: batch, model: 'text-embedding-3-small', dimensions: 1536 }),
      })
      if (!res.ok) throw new Error(`OpenAI embeddings error: ${await res.text()}`)
      const json = await res.json() as { data: Array<{ embedding: number[] }> }
      allEmbeddings.push(...json.data.map((d) => d.embedding))
    }

    // 4. Upsert embeddings
    const upsertRows = profiles.map((p, i) => ({
      variant_id:  p.variant_id,
      hotel_id:    p.hotel_id,
      embedding:   `[${allEmbeddings[i].join(',')}]`, // pgvector literal
      computed_at: new Date().toISOString(),
    }))
    const { error: upsertErr } = await sb.from('variant_embeddings').upsert(upsertRows)
    if (upsertErr) throw new Error(upsertErr.message)

    // 5. Compute cosine similarity and write similar_to edges
    // Group by hotel_id to avoid cross-hotel leakage
    const hotelGroups = new Map<string, number[]>()
    profiles.forEach((p, i) => {
      if (!hotelGroups.has(p.hotel_id)) hotelGroups.set(p.hotel_id, [])
      hotelGroups.get(p.hotel_id)!.push(i)
    })

    const edges: Record<string, unknown>[] = []

    for (const [hId, indices] of hotelGroups) {
      for (const i of indices) {
        const vecA = allEmbeddings[i]
        // Compute cosine similarity with all other variants in same hotel
        const scored = indices
          .filter((j) => j !== i)
          .map((j) => ({ j, sim: cosineSimilarity(vecA, allEmbeddings[j]) }))
          .filter((s) => s.sim >= SIMILARITY_THRESHOLD)
          .sort((a, b) => b.sim - a.sim)
          .slice(0, TOP_K)

        for (const { j, sim } of scored) {
          edges.push({
            edge_type:    'similar_to',
            source_type:  'variant',
            source_id:    profiles[i].variant_id,
            target_type:  'variant',
            target_id:    profiles[j].variant_id,
            hotel_id:     hId,
            triggered_by: 'automation_threshold',
            actor_id:     null,
            metadata:     { similarity: Math.round(sim * 1000) / 1000 },
          })
        }
      }
    }

    // Delete stale similar_to edges before reinserting (idempotent run)
    if (hotelId) {
      await sb.from('relationship_edges')
        .delete()
        .eq('hotel_id', hotelId)
        .eq('edge_type', 'similar_to')
    }

    if (edges.length > 0) {
      const { error: edgeErr } = await sb.from('relationship_edges').insert(edges)
      if (edgeErr) console.warn('[similar-variants] edge insert warn:', edgeErr.message)
    }

    return new Response(
      JSON.stringify({ embedded: profiles.length, edges_written: edges.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] ** 2; magB += b[i] ** 2 }
  return magA === 0 || magB === 0 ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB))
}
