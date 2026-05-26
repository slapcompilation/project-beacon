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
import mammoth from 'https://esm.sh/mammoth@1.8.0'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

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
const WHISPER_MODEL = 'whisper-1'

// Three pipelines, gated by MIME:
//   VISION  → Anthropic vision (pdf + images)
//   AUDIO   → OpenAI Whisper (audio/*)
//   STRUCT  → in-process mammoth (docx) + sheetjs (xlsx) + plain split (text/csv)
const VISION_MIMES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
])
const AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4',
  'audio/x-m4a', 'audio/ogg',
])
const STRUCT_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'text/plain',
  'text/csv',
])
const SUPPORTED_MIMES = new Set([...VISION_MIMES, ...AUDIO_MIMES, ...STRUCT_MIMES])

const PREVIEW_LIMIT = 240

interface WhisperSegment {
  id:    number
  start: number
  end:   number
  text:  string
}

interface WhisperResponse {
  text:     string
  segments: WhisperSegment[]
}

function formatTimestamp(seconds: number): string {
  const mm = Math.floor(seconds / 60)
  const ss = Math.floor(seconds % 60)
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json({ error: 'POST only' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const openaiKey    = Deno.env.get('OPENAI_API_KEY')
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY secret not set' }, 500)

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
        error: `Unsupported mime_type ${doc.mime_type}. Supported: pdf + jpeg/png/webp/gif (Anthropic vision), mpeg/wav/webm/mp4/m4a/ogg (OpenAI Whisper), docx/xlsx/csv/text (in-process).`,
      }, 400)
    }

    if (AUDIO_MIMES.has(doc.mime_type) && !openaiKey) {
      return json({
        error: 'OPENAI_API_KEY secret not set on this project. Required for audio ingestion (Whisper). PDF/image/docx/xlsx still work without it.',
      }, 500)
    }

    // 2. Download the bytes.
    const { data: blob, error: dlErr } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)
    if (dlErr || !blob) return json({ error: `Download failed: ${dlErr?.message ?? 'unknown'}` }, 502)

    // 3. Branch on MIME: vision vs. whisper.
    let chunks:     ChunkOut[]
    let tokensUsed: number

    if (AUDIO_MIMES.has(doc.mime_type)) {
      const result = await ingestAudio(blob, body.document_id, doc.mime_type, doc.title, openaiKey!)
      chunks     = result.chunks
      tokensUsed = result.tokensUsed
    } else if (STRUCT_MIMES.has(doc.mime_type)) {
      const result = await ingestStructured(blob, body.document_id, doc.mime_type)
      chunks     = result.chunks
      tokensUsed = result.tokensUsed
    } else {
      const result = await ingestVision(blob, body.document_id, doc.mime_type, anthropicKey)
      chunks     = result.chunks
      tokensUsed = result.tokensUsed
    }

    // 4. Persist preview chunks on the documents row.
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

    // 5. Embed each chunk (best-effort) and persist into document_chunks
    //    so semantic search across pages works. Failure here doesn't
    //    abort ingestion — operators can still read the previews on the
    //    documents row; semantic search just won't find this doc.
    if (openaiKey && chunks.length > 0) {
      try {
        const embedResp = await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/embed-text`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({ texts: chunks.map((c) => c.text_preview) }),
        })
        if (embedResp.ok) {
          const embedData = await embedResp.json() as { embeddings: number[][] }
          const chunkRows = chunks.map((c, i) => ({
            document_id:  body.document_id,
            hotel_id:     doc.hotel_id,
            chunk_key:    c.chunk_id,
            page:         c.page,
            text_preview: c.text_preview,
            embedding:    embedData.embeddings[i] ? `[${embedData.embeddings[i].join(',')}]` : null,
          }))
          await supabase
            .from('document_chunks')
            .upsert(chunkRows, { onConflict: 'document_id,chunk_key' })
        }
      } catch (e) {
        // Surface to logs but don't fail the ingestion. The documents row
        // still has chunks for inline preview.
        console.warn('[document-ingest] chunk embedding failed:', e)
      }
    }

    const response: IngestResponse = {
      document_id: body.document_id,
      chunks,
      page_count:  chunks.length,
      tokens_used: tokensUsed,
      stage:       'ocr',
    }
    return json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return json({ error: message }, 500)
  }
})

// ─── Vision pipeline (Anthropic) ────────────────────────────────────────────

async function ingestVision(
  blob:     Blob,
  docId:    string,
  mimeType: string,
  apiKey:   string,
): Promise<{ chunks: ChunkOut[]; tokensUsed: number }> {
  const bytes  = new Uint8Array(await blob.arrayBuffer())
  const base64 = btoa(String.fromCharCode(...bytes))

  const anthropic = new Anthropic({ apiKey })
  const contentBlock = mimeType === 'application/pdf'
    ? {
        type:   'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
      }
    : {
        type:   'image' as const,
        source: { type: 'base64' as const, media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 },
      }

  const prompt = mimeType === 'application/pdf'
    ? 'Extract the text content from this PDF. Return a JSON array where each element is one page: { "page": <1-based number>, "text_preview": <first 240 chars of page text, plain text, no markdown> }. Return ONLY the JSON array.'
    : 'Extract any visible text from this image. Return a JSON array with one element: [{ "page": 1, "text_preview": <first 240 chars of extracted text> }]. Return ONLY the JSON array.'

  const completion = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 4096,
    messages:   [
      {
        role:    'user',
        content: [contentBlock, { type: 'text', text: prompt }],
      },
    ],
  })

  const textBlock = completion.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('no text in model response')
  }

  let parsed: Array<{ page: number; text_preview: string }>
  try {
    parsed = JSON.parse(textBlock.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as Array<{ page: number; text_preview: string }>
    if (!Array.isArray(parsed)) throw new Error('expected JSON array')
  } catch (e) {
    throw new Error(`Model returned non-JSON output: ${e instanceof Error ? e.message : 'unknown'}`)
  }

  const chunks: ChunkOut[] = parsed.map((p, i) => ({
    chunk_id:     `${docId}-chunk-${String(i + 1)}`,
    page:         typeof p.page === 'number' ? p.page : i + 1,
    text_preview: typeof p.text_preview === 'string' ? p.text_preview.slice(0, 240) : '',
  }))

  return {
    chunks,
    tokensUsed: (completion.usage.input_tokens ?? 0) + (completion.usage.output_tokens ?? 0),
  }
}

// ─── Audio pipeline (OpenAI Whisper) ────────────────────────────────────────
//
// Whisper API accepts multipart/form-data with the audio blob + model name.
// `response_format=verbose_json` gives us per-segment timestamps so we can
// map each segment to a chunk row. The `page` field is reused for segment
// ordering; text_preview carries the timestamp prefix so operators
// scanning the chunk list can locate the moment in the recording.

async function ingestAudio(
  blob:     Blob,
  docId:    string,
  mimeType: string,
  title:    string,
  apiKey:   string,
): Promise<{ chunks: ChunkOut[]; tokensUsed: number }> {
  const formData = new FormData()
  // Whisper infers MIME from filename extension; supply a stable name.
  const ext  = extForMime(mimeType)
  const file = new File([blob], `${title.replace(/[^\w.-]/g, '_')}.${ext}`, { type: mimeType })
  formData.set('file',  file)
  formData.set('model', WHISPER_MODEL)
  formData.set('response_format', 'verbose_json')
  formData.set('timestamp_granularities[]', 'segment')

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body:    formData,
  })
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`Whisper API ${String(resp.status)}: ${errText.slice(0, 300)}`)
  }

  const result = await resp.json() as WhisperResponse

  // One chunk per Whisper segment so the operator can cite specific moments.
  // Single-segment fallback for tiny clips where Whisper didn't split.
  const segments = Array.isArray(result.segments) && result.segments.length > 0
    ? result.segments
    : [{ id: 0, start: 0, end: 0, text: result.text ?? '' }]

  const chunks: ChunkOut[] = segments.map((s, i) => {
    const timestamp = formatTimestamp(s.start)
    const text      = (s.text ?? '').trim()
    const preview   = `[${timestamp}] ${text}`.slice(0, 240)
    return {
      chunk_id:     `${docId}-segment-${String(i + 1)}`,
      page:         i + 1,
      text_preview: preview,
    }
  })

  // Whisper pricing is per-second of audio, not tokens. Surface seconds in
  // tokens_used so the UI's "N tokens" hint still gives the operator a
  // useful signal about cost.
  const totalSeconds = segments.length > 0 ? Math.round(segments[segments.length - 1]?.end ?? 0) : 0
  return { chunks, tokensUsed: totalSeconds }
}

function extForMime(mimeType: string): string {
  switch (mimeType) {
    case 'audio/mpeg': return 'mp3'
    case 'audio/wav':  return 'wav'
    case 'audio/webm': return 'webm'
    case 'audio/mp4':  return 'mp4'
    case 'audio/x-m4a': return 'm4a'
    case 'audio/ogg':  return 'ogg'
    default:           return 'bin'
  }
}

// ─── Structured pipeline (DOCX / XLSX / CSV / plain text) ───────────────────
//
// All three run in-process — no external API. mammoth for .docx, sheetjs
// for .xlsx, line/row split for csv/plain. Chunking rule: one chunk per
// "section" (paragraph group for docx, sheet for xlsx, ~50-line group for
// text/csv) so the page field carries something meaningful for the operator
// scanning the chunk list.

async function ingestStructured(
  blob:     Blob,
  docId:    string,
  mimeType: string,
): Promise<{ chunks: ChunkOut[]; tokensUsed: number }> {
  switch (mimeType) {
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return ingestDocx(blob, docId)
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return ingestXlsx(blob, docId)
    case 'text/plain':
    case 'text/csv':
      return ingestPlainText(blob, docId)
    default:
      throw new Error(`ingestStructured: unhandled mime ${mimeType}`)
  }
}

interface MammothResult {
  value:    string
  messages: Array<{ type: string; message: string }>
}

async function ingestDocx(blob: Blob, docId: string): Promise<{ chunks: ChunkOut[]; tokensUsed: number }> {
  const arrayBuffer = await blob.arrayBuffer()
  const result = await (mammoth as { extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<MammothResult> })
    .extractRawText({ arrayBuffer })

  // Split on blank lines to make paragraph-group chunks; drop empties.
  const paragraphs = result.value
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (paragraphs.length === 0) return { chunks: [], tokensUsed: 0 }

  const chunks: ChunkOut[] = paragraphs.map((text, i) => ({
    chunk_id:     `${docId}-para-${String(i + 1)}`,
    page:         i + 1,
    text_preview: text.slice(0, PREVIEW_LIMIT),
  }))
  return { chunks, tokensUsed: result.value.length }
}

async function ingestXlsx(blob: Blob, docId: string): Promise<{ chunks: ChunkOut[]; tokensUsed: number }> {
  const ab = await blob.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(ab), { type: 'array' })
  const chunks: ChunkOut[] = []
  let totalChars = 0
  wb.SheetNames.forEach((sheetName, i) => {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) return
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    if (csv.trim().length === 0) return
    chunks.push({
      chunk_id:     `${docId}-sheet-${String(i + 1)}`,
      page:         i + 1,
      text_preview: `[${sheetName}] ${csv}`.slice(0, PREVIEW_LIMIT),
    })
    totalChars += csv.length
  })
  return { chunks, tokensUsed: totalChars }
}

async function ingestPlainText(blob: Blob, docId: string): Promise<{ chunks: ChunkOut[]; tokensUsed: number }> {
  const text  = await blob.text()
  const lines = text.split(/\r?\n/)
  const GROUP = 50

  const chunks: ChunkOut[] = []
  for (let i = 0; i < lines.length; i += GROUP) {
    const group = lines.slice(i, i + GROUP).join('\n').trim()
    if (group.length === 0) continue
    const pageNo = Math.floor(i / GROUP) + 1
    chunks.push({
      chunk_id:     `${docId}-block-${String(pageNo)}`,
      page:         pageNo,
      text_preview: group.slice(0, PREVIEW_LIMIT),
    })
  }
  return { chunks, tokensUsed: text.length }
}
