// entity-extract — Phase 16.g auto entity-link suggestion pipeline.
//
// Given a document_id, this function:
//   1. Loads the document + its chunks
//   2. Loads the hotel's variants + suppliers (the candidate entity pool)
//   3. Asks Anthropic, in one structured call, which chunks reference which
//      entities and at what confidence
//   4. Persists each high-confidence guess to entity_link_suggestions
//      (status='pending'), with the exact evidence snippet
//   5. Returns the count of new suggestions for the UI
//
// Re-uses the existing ANTHROPIC_API_KEY. Hotel-scoped via the user-bound
// client; RLS ensures the caller can only run this against documents in
// their scope.

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.36.3'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, preflight } from '../_shared/http.ts'
import { isAuthError, verifyAuth } from '../_shared/auth.ts'

interface ExtractRequest {
  document_id: string
  /** Minimum confidence (0..1) for a suggestion to be persisted. Default 0.65. */
  threshold?: number
}

interface DocumentChunk {
  chunk_id: string
  page:     number
  /** Full chunk text when the Track-1 pipeline wrote it; preview otherwise. */
  text:     string
}

interface VariantRow  { id: string; name: string; label: string }
interface SupplierRow { id: string; name: string }

interface LLMSuggestion {
  chunk_id:         string
  entity_type:      'variant' | 'supplier'
  entity_id:        string
  confidence:       number
  reasoning:        string
  evidence_snippet: string
}

const MODEL = 'claude-haiku-4-5-20251001'

Deno.serve(async (req: Request) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    // Hyphenated fallback: the project secret was created as 'ANTHROPIC-API-KEY'.
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('ANTHROPIC-API-KEY')
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY secret not set' }, 500)

    const auth = await verifyAuth(req)
    if (isAuthError(auth)) return auth
    const { supabase } = auth

    const body = await req.json() as ExtractRequest
    if (!body.document_id) return json({ error: 'document_id required' }, 400)
    const threshold = body.threshold ?? 0.65

    // 1. Load the document, then its chunks. Prefer document_chunks.text_full
    //    (the Track-1 512-char chunks) — matching against 240-char previews
    //    misses most of every page. Fall back to the jsonb preview store for
    //    documents ingested before the full-text pipeline.
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, hotel_id, title, chunks')
      .eq('id', body.document_id)
      .single() as unknown as {
        data: {
          id: string; hotel_id: string; title: string
          chunks: Array<{ chunk_id: string; page: number; text_preview: string }> | null
        } | null
        error: { message: string } | null
      }
    if (docErr || !doc) return json({ error: 'Document not found or access denied' }, 404)

    const { data: chunkRows } = await supabase
      .from('document_chunks')
      .select('chunk_key, page, chunk_number, text_full, text_preview')
      .eq('document_id', body.document_id)
      .order('page', { ascending: true })
      .order('chunk_number', { ascending: true })
      .limit(400) as unknown as {
        data: Array<{ chunk_key: string; page: number; chunk_number: number; text_full: string | null; text_preview: string }> | null
      }

    const chunks: DocumentChunk[] = (chunkRows && chunkRows.length > 0)
      ? chunkRows.map((c) => ({ chunk_id: c.chunk_key, page: c.page, text: c.text_full ?? c.text_preview }))
      : (doc.chunks ?? []).map((c) => ({ chunk_id: c.chunk_id, page: c.page, text: c.text_preview }))

    if (chunks.length === 0) {
      return json({ error: 'Document has no chunks. Run ingestion first.' }, 400)
    }

    // 2. Load the hotel's candidate variants + suppliers. Cap to keep the
    //    prompt size manageable; large hotels need a smarter retrieval step
    //    (vector match on chunk text → top-K names) in a future iteration.
    const { data: variantRows } = await supabase
      .from('product_variants')
      .select('id, name, products!inner(name, hotel_id)')
      .eq('products.hotel_id', doc.hotel_id)
      .limit(500) as unknown as {
        data: Array<{ id: string; name: string; products: { name: string } | null }> | null
      }

    const { data: supplierRows } = await supabase
      .from('suppliers')
      .select('id, name, hotel_id')
      .eq('hotel_id', doc.hotel_id)
      .limit(500) as unknown as { data: Array<{ id: string; name: string }> | null }

    // Nearly every variant is literally named 'Standard' — the identifying name
    // lives on the product. Matching on the bare variant name showed the model
    // 500 identical candidates and made exact-name harmonization impossible.
    const variants: VariantRow[] = (variantRows ?? []).map((v) => {
      const product = v.products?.name ?? v.name
      return {
        id:    v.id,
        name:  product,
        label: v.name && v.name !== 'Standard' ? `${product} — ${v.name}` : product,
      }
    })
    const suppliers: SupplierRow[] = (supplierRows ?? []).map((s) => ({ id: s.id, name: s.name }))

    if (variants.length === 0 && suppliers.length === 0) {
      return json({ inserted: 0, resolved: 0, entities_considered: 0, message: 'No variants or suppliers in this hotel to match against.' })
    }

    // 3. Harmonize FIRST. Resolution is deterministic and free, so it must not
    //    depend on the LLM pass below succeeding — it used to sit after an
    //    early return and never ran when the model suggested nothing.
    const harmony = await harmonize(supabase, doc, variants, suppliers)
    if ('error' in harmony) return json({ error: harmony.error }, 502)

    // 4. Ask the LLM. Tight system prompt + JSON-shaped output.
    const anthropic = new Anthropic({ apiKey })
    const systemPrompt =
      'You are linking document chunks to entities in a hotel inventory graph. For each chunk that clearly references one of the listed entities, return a suggestion. ' +
      'Be conservative — only suggest a link when the chunk explicitly names the entity or describes its attributes unambiguously. ' +
      'Confidence rules: 0.95+ exact name match in the chunk, 0.80-0.94 strong paraphrase or unambiguous attribute, 0.65-0.79 plausible inference, < 0.65 do not return. ' +
      'Return ONLY a JSON object {"suggestions": [...]}. No prose, no markdown.'

    const userPrompt =
      `Document: ${doc.title}\n\n` +
      `Chunks (chunk_id → text):\n` +
      chunks.map((c) => `${c.chunk_id}: ${c.text}`).join('\n') +
      '\n\nCandidate variants (id → name):\n' +
      variants.map((v) => `${v.id}: ${v.label}`).join('\n') +
      '\n\nCandidate suppliers (id → name):\n' +
      suppliers.map((s) => `${s.id}: ${s.name}`).join('\n') +
      '\n\nReturn JSON: { "suggestions": [{ "chunk_id": "...", "entity_type": "variant"|"supplier", "entity_id": "<uuid>", "confidence": <0..1>, "reasoning": "<one sentence>", "evidence_snippet": "<exact text from the chunk>" }, ...] }'

    const completion = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 4096,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const textBlock = completion.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return json({ error: 'no text in model response' }, 502)
    }

    let parsed: { suggestions: LLMSuggestion[] }
    try {
      parsed = JSON.parse(textBlock.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as { suggestions: LLMSuggestion[] }
    } catch (e) {
      return json({ error: `Model returned non-JSON: ${e instanceof Error ? e.message : 'unknown'}`, raw: textBlock.text.slice(0, 600) }, 502)
    }

    // 4. Validate + persist.
    const variantIds  = new Set(variants.map((v) => v.id))
    const supplierIds = new Set(suppliers.map((s) => s.id))
    const chunkIds    = new Set(chunks.map((c) => c.chunk_id))

    const rowsToInsert = parsed.suggestions
      .filter((s) => typeof s.confidence === 'number' && s.confidence >= threshold)
      .filter((s) => chunkIds.has(s.chunk_id))
      .filter((s) => (s.entity_type === 'variant' && variantIds.has(s.entity_id))
                  || (s.entity_type === 'supplier' && supplierIds.has(s.entity_id)))
      .map((s) => ({
        hotel_id:         doc.hotel_id,
        document_id:      doc.id,
        chunk_key:        s.chunk_id,
        entity_type:      s.entity_type,
        entity_id:        s.entity_id,
        confidence:       Math.min(1, Math.max(0, s.confidence)),
        reasoning:        s.reasoning?.slice(0, 1000) ?? '',
        evidence_snippet: s.evidence_snippet?.slice(0, 500) ?? null,
      }))

    // The pending-uniqueness index is PARTIAL (WHERE status='pending'), which
    // PostgREST's ON CONFLICT cannot target — so re-run protection is done as
    // a pre-check + plain insert: skip triples that are already pending;
    // decided (approved/rejected) triples may be re-suggested, as the index
    // intends.
    const { data: existing } = await supabase
      .from('entity_link_suggestions')
      .select('chunk_key, entity_type, entity_id')
      .eq('document_id', doc.id)
      .eq('status', 'pending')
    const seen = new Set((existing ?? []).map((e) => `${e.chunk_key}|${e.entity_type}|${e.entity_id}`))
    const fresh = rowsToInsert.filter((r) => {
      const key = `${r.chunk_key}|${r.entity_type}|${r.entity_id}`
      if (seen.has(key)) return false
      seen.add(key)  // also dedupes within this batch
      return true
    })

    if (fresh.length > 0) {
      const { error: insertError } = await supabase
        .from('entity_link_suggestions')
        .insert(fresh)
      if (insertError) return json({ error: insertError.message }, 502)
    }

    return json({
      inserted:            fresh.length,
      resolved:            harmony.resolved,
      entities_considered: harmony.entities_considered,
      considered:          parsed.suggestions.length,
      threshold,
      tokens_used: (completion.usage.input_tokens ?? 0) + (completion.usage.output_tokens ?? 0),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return json({ error: message }, 500)
  }
})

/** Index name → id, dropping any name that two records share. A deterministic
 *  match has to be unambiguous; two variants called "Lime" resolve to neither. */
function uniqueByName<T extends { id: string }>(rows: T[], names: (r: T) => string[]): Map<string, string> {
  const hits = new Map<string, string | null>()
  for (const r of rows) {
    for (const raw of names(r)) {
      const key = raw.toLowerCase().trim()
      if (!key) continue
      hits.set(key, hits.has(key) && hits.get(key) !== r.id ? null : r.id)
    }
  }
  return new Map([...hits].flatMap(([k, v]) => (v ? [[k, v] as [string, string]] : [])))
}

/** P7 harmonization: Entity nodes this document mentions resolve to operational
 *  nodes via entity -resolved_to-> supplier|variant. DETERMINISTIC ONLY
 *  (case-insensitive exact name match); anything fuzzy stays in the
 *  human-approved suggestions queue. */
async function harmonize(
  supabase:  SupabaseClient,
  doc:       { id: string; hotel_id: string },
  variants:  VariantRow[],
  suppliers: SupplierRow[],
): Promise<{ resolved: number; entities_considered: number } | { error: string }> {
  const { data: mentionEdges } = await supabase
    .from('relationship_edges')
    .select('target_id')
    .eq('edge_type', 'mentions')
    .eq('metadata->>document_id', doc.id)
  const mentionedIds = [...new Set((mentionEdges ?? []).map((e) => e.target_id as string))]
  if (mentionedIds.length === 0) return { resolved: 0, entities_considered: 0 }

  const { data: entityRows } = await supabase
    .from('entities')
    .select('id, name_key, category')
    .in('id', mentionedIds)
    .in('category', ['supplier', 'product']) as unknown as {
      data: Array<{ id: string; name_key: string; category: string }> | null
    }
  if (!entityRows || entityRows.length === 0) return { resolved: 0, entities_considered: 0 }

  const supplierByKey = uniqueByName(suppliers, (s) => [s.name])
  const variantByKey  = uniqueByName(variants,  (v) => [v.name, v.label])

  const { data: alreadyResolved } = await supabase
    .from('relationship_edges')
    .select('source_id')
    .eq('edge_type', 'resolved_to')
    .in('source_id', entityRows.map((e) => e.id))
  const done = new Set((alreadyResolved ?? []).map((e) => e.source_id as string))

  const resolvedRows = entityRows.flatMap((e) => {
    if (done.has(e.id)) return []
    const targetId = e.category === 'supplier'
      ? supplierByKey.get(e.name_key)
      : variantByKey.get(e.name_key)
    if (!targetId) return []
    return [{
      edge_type:    'resolved_to',
      source_type:  'entity',
      source_id:    e.id,
      target_type:  e.category === 'supplier' ? 'supplier' : 'variant',
      target_id:    targetId,
      hotel_id:     doc.hotel_id,
      triggered_by: 'system',
      metadata:     { matched: 'exact-name', document_id: doc.id },
    }]
  })

  if (resolvedRows.length > 0) {
    const { error } = await supabase.from('relationship_edges').insert(resolvedRows)
    if (error) return { error: `resolved_to insert failed: ${error.message}` }
  }
  return { resolved: resolvedRows.length, entities_considered: entityRows.length }
}
