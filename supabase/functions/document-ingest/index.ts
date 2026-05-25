// document-ingest — Phase 16.b OCR pipeline (v1).
//
// Pulls one document from storage, runs Anthropic vision to extract per-page
// text, writes chunks back to the document row, advances ingestion_stage
// from 'raw' to 'ocr'. Future stages ('embedded', 'contextualized', 'linked')
// land as separate functions so each can be retried independently.
//
// Re-using the same ANTHROPIC_API_KEY the agent-llm function already uses;
// no separate provider key needed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.36.3'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface IngestRequest {
  document_id: string
}

interface ChunkOut {
  chunk_id:     string
  page:         number
  text_preview: string
}

interface IngestResponse {
  document_id:  string
  chunks:       ChunkOut[]
  page_count:   number
  tokens_used:  number
  stage:        'ocr'
}

const MODEL = 'claude-haiku-4-5-20251001'

// Anthropic vision accepts pdf + a handful of image MIMEs directly. For
// other types (audio, csv, docx) we'd need a different pipeline — defer to
// Phase 16.c. The function fails fast on unsupported MIMEs with a clear msg.
const SUPPORTED_MIMES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
])

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json({ error: 'POST only' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY secret not set' }, 500)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json() as IngestRequest
    if (!body.document_id) return json({ error: 'document_id required' }, 400)

    // 1. Load the row; RLS guarantees the caller has scope.
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, hotel_id, mime_type, storage_path, title, ingestion_stage')
      .eq('id', body.document_id)
      .single()
    if (docErr || !doc) return json({ error: 'Document not found or access denied' }, 404)

    if (!SUPPORTED_MIMES.has(doc.mime_type)) {
      return json({
        error: `Unsupported mime_type ${doc.mime_type}. v1 supports pdf + jpeg/png/webp/gif. Audio + docx land in 16.c.`,
      }, 400)
    }

    // 2. Download the bytes.
    const { data: blob, error: dlErr } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)
    if (dlErr || !blob) return json({ error: `Download failed: ${dlErr?.message ?? 'unknown'}` }, 502)

    const bytes  = new Uint8Array(await blob.arrayBuffer())
    const base64 = btoa(String.fromCharCode(...bytes))

    // 3. Call Anthropic vision.
    const anthropic = new Anthropic({ apiKey })
    const contentBlock = doc.mime_type === 'application/pdf'
      ? {
          type:   'document' as const,
          source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
        }
      : {
          type:   'image' as const,
          source: { type: 'base64' as const, media_type: doc.mime_type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 },
        }

    const prompt = doc.mime_type === 'application/pdf'
      ? 'Extract the text content from this PDF. Return a JSON array where each element is one page: { "page": <1-based number>, "text_preview": <first 240 chars of page text, plain text, no markdown> }. Return ONLY the JSON array.'
      : 'Extract any visible text from this image. Return a JSON array with one element: [{ "page": 1, "text_preview": <first 240 chars of extracted text> }]. Return ONLY the JSON array.'

    const completion = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 4096,
      messages:   [
        {
          role:    'user',
          content: [
            contentBlock,
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    const textBlock = completion.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return json({ error: 'no text in model response' }, 502)
    }

    // 4. Parse + persist.
    let parsed: Array<{ page: number; text_preview: string }>
    try {
      parsed = JSON.parse(textBlock.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as Array<{ page: number; text_preview: string }>
      if (!Array.isArray(parsed)) throw new Error('expected JSON array')
    } catch (e) {
      return json({
        error: `Model returned non-JSON output: ${e instanceof Error ? e.message : 'unknown'}`,
        raw:   textBlock.text.slice(0, 1000),
      }, 502)
    }

    const chunks: ChunkOut[] = parsed.map((p, i) => ({
      chunk_id:     `${body.document_id}-chunk-${String(i + 1)}`,
      page:         typeof p.page === 'number' ? p.page : i + 1,
      text_preview: typeof p.text_preview === 'string' ? p.text_preview.slice(0, 240) : '',
    }))

    const { error: updateErr } = await supabase
      .from('documents')
      .update({
        chunks,
        page_count:      chunks.length,
        ingestion_stage: 'ocr',
        updated_at:      new Date().toISOString(),
      })
      .eq('id', body.document_id)
    if (updateErr) return json({ error: `Update failed: ${updateErr.message}` }, 502)

    const response: IngestResponse = {
      document_id: body.document_id,
      chunks,
      page_count:  chunks.length,
      tokens_used: (completion.usage.input_tokens ?? 0) + (completion.usage.output_tokens ?? 0),
      stage:       'ocr',
    }
    return json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return json({ error: message }, 500)
  }
})
