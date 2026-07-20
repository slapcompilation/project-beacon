// document-ingest — Foundry-exact ingestion pipeline (Track 1: P1-P4b).
//
// Mirrors the Foundry document-processing reference, stage for stage:
//   1. Extract FULL text per page (Anthropic vision / Whisper / in-process)
//   2. Explode to one unit per page
//   3. Chunk String: 512 chars, 128 overlap, per page
//   4. Composite chunk key: <docId>_<page>_<chunkNumber>  (deterministic —
//      re-ingesting a document produces identical keys, never random ids)
//   5. Embed each chunk's full text -> document_chunks rows
//   6. cited_in provenance edges: document -> chunk (page-level)
//   7. entity-extract -> entity_link_suggestions
//
// Stage transitions are FAIL-CLOSED (Foundry data-expectations posture): each
// milestone asserts its contract and the stage marker refuses to advance
// otherwise. A failed gate returns the derived context (which gate, why) and
// leaves the document at the last milestone that actually holds.
//   raw -> ocr -> embedded -> contextualized -> linked ('linked' is set on the
//   graph when a describes_entity edge is approved — migration 191).

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.36.3'
import mammoth from 'https://esm.sh/mammoth@1.8.0'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'
import { json, preflight } from '../_shared/http.ts'
import { isAuthError, verifyAuth } from '../_shared/auth.ts'

interface IngestRequest {
  document_id: string
}

/** Preview entry stored on documents.chunks (jsonb) — the detail page's store. */
interface ChunkOut {
  chunk_id:     string
  page:         number
  text_preview: string
}

/** Full-text page unit — the "explode array with position" stage. */
interface PageOut {
  page: number
  text: string
}

/** One 512-char chunk, pre-persistence. */
interface ChunkRow {
  chunk_key:    string
  page:         number
  chunk_number: number
  text_full:    string
  text_preview: string
}

type IngestStage = 'ocr' | 'embedded' | 'contextualized'

interface IngestResponse {
  document_id: string
  chunks:      ChunkOut[]
  page_count:  number
  chunk_count: number
  tokens_used: number
  stage:       IngestStage
}

const MODEL         = 'claude-haiku-4-5-20251001'
const WHISPER_MODEL = 'whisper-1'

const PREVIEW_LIMIT  = 240
const CHUNK_SIZE     = 512   // Foundry reference: Chunk String, 512, overlapping
const CHUNK_OVERLAP  = 128
const MAX_CHUNKS     = 2000  // hard ceiling; a doc past this needs a batched design
const OCR_MAX_TOKENS = 32000 // full-text extraction; stop_reason is gated below

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

/** Foundry's Chunk String transform: fixed-size overlapping segments. */
function chunkString(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const trimmed = text.trim()
  if (trimmed.length === 0) return []
  if (trimmed.length <= size) return [trimmed]
  const step = size - overlap
  const out: string[] = []
  for (let start = 0; start < trimmed.length; start += step) {
    const segment = trimmed.slice(start, start + size)
    out.push(segment)
    if (start + size >= trimmed.length) break
  }
  return out
}

/** Pages -> chunk rows with the composite deterministic key. */
function chunkPages(docId: string, pages: PageOut[]): ChunkRow[] {
  return pages.flatMap((p) =>
    chunkString(p.text).map((text, i) => ({
      chunk_key:    `${docId}_${String(p.page)}_${String(i + 1)}`,
      page:         p.page,
      chunk_number: i + 1,
      text_full:    text,
      text_preview: text.slice(0, PREVIEW_LIMIT),
    })),
  )
}

/** Fail-closed gate response: which gate, why, where the document settled. */
function gateFail(gate: string, detail: string, stageReached: 'raw' | IngestStage, status = 422) {
  return json({ error: `stage gate failed: ${gate}`, gate, detail, stage_reached: stageReached }, status)
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    // The project's Anthropic secret was created as 'ANTHROPIC-API-KEY'
    // (hyphens); the runtime exposes it under that literal name. Read both
    // until the secret is re-created under the canonical name.
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('ANTHROPIC-API-KEY')
    const openaiKey    = Deno.env.get('OPENAI_API_KEY')    ?? Deno.env.get('OPENAI-API-KEY')
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY secret not set' }, 500)

    const auth = await verifyAuth(req)
    if (isAuthError(auth)) return auth
    const { supabase } = auth
    // verifyAuth confirmed the header is present + valid; reuse it to call
    // embed-text / entity-extract as the same authenticated user.
    const authHeader = req.headers.get('Authorization') ?? ''

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
        error: 'OPENAI_API_KEY secret not set on this project. Required for audio ingestion (Whisper).',
      }, 500)
    }

    // 2. Download the bytes.
    const { data: blob, error: dlErr } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)
    if (dlErr || !blob) return json({ error: `Download failed: ${dlErr?.message ?? 'unknown'}` }, 502)

    // 3. Extract FULL text per page (pipeline by MIME).
    let pages:      PageOut[]
    let tokensUsed: number

    if (AUDIO_MIMES.has(doc.mime_type)) {
      const result = await extractAudio(blob, doc.mime_type, doc.title, openaiKey!)
      pages      = result.pages
      tokensUsed = result.tokensUsed
    } else if (STRUCT_MIMES.has(doc.mime_type)) {
      const result = await extractStructured(blob, doc.mime_type)
      pages      = result.pages
      tokensUsed = result.tokensUsed
    } else {
      const result = await extractVision(blob, doc.mime_type, anthropicKey)
      if (result.truncated) {
        return gateFail('ocr.complete_extraction',
          `Extraction hit the ${String(OCR_MAX_TOKENS)}-token output ceiling before the last page; partial text was discarded rather than persisted.`,
          'raw')
      }
      pages      = result.pages
      tokensUsed = result.tokensUsed
    }

    // ── GATE: ocr ── pages exist and carry text; chunking yields a valid set.
    const totalChars = pages.reduce((s, p) => s + p.text.trim().length, 0)
    if (pages.length === 0 || totalChars === 0) {
      return gateFail('ocr.nonempty_text', 'Extraction produced no text (0 pages or all pages empty).', 'raw')
    }

    const chunkRows = chunkPages(body.document_id, pages)
    if (chunkRows.length === 0) {
      return gateFail('ocr.chunks_present', 'Chunking produced 0 chunks from non-empty pages.', 'raw')
    }
    if (chunkRows.length > MAX_CHUNKS) {
      return gateFail('ocr.chunk_ceiling',
        `${String(chunkRows.length)} chunks exceeds the ${String(MAX_CHUNKS)}-chunk ceiling for a single document.`, 'raw')
    }
    if (new Set(chunkRows.map((c) => c.chunk_key)).size !== chunkRows.length) {
      return gateFail('ocr.unique_chunk_keys', 'Duplicate composite chunk keys — page/chunk numbering broke.', 'raw')
    }

    // 4. Persist previews on the documents row; milestone 'ocr' now holds.
    const previews: ChunkOut[] = chunkRows.map((c) => ({
      chunk_id:     c.chunk_key,
      page:         c.page,
      text_preview: c.text_preview,
    }))
    const { error: updateErr } = await supabase
      .from('documents')
      .update({
        chunks:          previews,
        page_count:      pages.length,
        ingestion_stage: 'ocr',
        updated_at:      new Date().toISOString(),
      })
      .eq('id', body.document_id)
    if (updateErr) return json({ error: `Update failed: ${updateErr.message}` }, 502)

    let stage: IngestStage = 'ocr'
    const funcBase = `${Deno.env.get('SUPABASE_URL')!}/functions/v1`
    const forward  = { 'Content-Type': 'application/json', 'Authorization': authHeader }

    // 5. Embed the FULL chunk text. Without embeddings the pipeline cannot
    //    reach 'embedded' — a missing key is a failed build, not a silent skip.
    if (!openaiKey) {
      return gateFail('embedded.provider_available',
        'OPENAI_API_KEY secret not set — embeddings cannot be computed. Document settled at ocr.',
        'ocr', 502)
    }

    const embeddings: number[][] = []
    const BATCH = 100  // embed-text MAX_BATCH
    for (let i = 0; i < chunkRows.length; i += BATCH) {
      const batch = chunkRows.slice(i, i + BATCH)
      const resp = await fetch(`${funcBase}/embed-text`, {
        method: 'POST', headers: forward,
        body: JSON.stringify({ texts: batch.map((c) => c.text_full) }),
      })
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        return gateFail('embedded.batch_ok',
          `embed-text batch ${String(i / BATCH + 1)} failed (${String(resp.status)}): ${errText.slice(0, 300)}. Document settled at ocr.`,
          'ocr', 502)
      }
      const data = await resp.json() as { embeddings: number[][] }
      embeddings.push(...data.embeddings)
    }
    if (embeddings.length !== chunkRows.length || embeddings.some((e) => !Array.isArray(e) || e.length !== 1536)) {
      return gateFail('embedded.vector_per_chunk',
        `Expected ${String(chunkRows.length)} 1536-dim vectors, got ${String(embeddings.length)}. Document settled at ocr.`,
        'ocr', 502)
    }

    // Replace the document's chunk rows wholesale: re-ingestion may change the
    // chunk set, and stale rows would poison semantic search.
    const { error: delErr } = await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', body.document_id)
    if (delErr) {
      return gateFail('embedded.chunks_replaced', `Stale chunk cleanup failed: ${delErr.message}`, 'ocr', 502)
    }
    const { error: insErr } = await supabase
      .from('document_chunks')
      .insert(chunkRows.map((c, i) => ({
        document_id:  body.document_id,
        hotel_id:     doc.hotel_id,
        chunk_key:    c.chunk_key,
        page:         c.page,
        chunk_number: c.chunk_number,
        text_preview: c.text_preview,
        text_full:    c.text_full,
        embedding:    `[${embeddings[i]!.join(',')}]`,
      })))
    if (insErr) {
      return gateFail('embedded.chunks_persisted', `Chunk insert failed: ${insErr.message}`, 'ocr', 502)
    }

    // 6. cited_in provenance: document -> chunk, page-level (P4). Part of the
    //    'embedded' contract — search results must be traceable to a page.
    const { data: storedChunks, error: chunkSelErr } = await supabase
      .from('document_chunks')
      .select('id, chunk_key, page')
      .eq('document_id', body.document_id)
    if (chunkSelErr || !storedChunks || storedChunks.length !== chunkRows.length) {
      return gateFail('embedded.chunks_readback',
        `Chunk readback mismatch: ${String(storedChunks?.length ?? 0)}/${String(chunkRows.length)}.`, 'ocr', 502)
    }

    const { error: edgeDelErr } = await supabase
      .from('relationship_edges')
      .delete()
      .eq('edge_type', 'cited_in')
      .eq('source_id', body.document_id)
    if (edgeDelErr) {
      return gateFail('embedded.citations_refreshed', `Stale cited_in cleanup failed: ${edgeDelErr.message}`, 'ocr', 502)
    }
    const { error: edgeInsErr } = await supabase
      .from('relationship_edges')
      .insert(storedChunks.map((c) => ({
        edge_type:    'cited_in',
        source_type:  'document',
        source_id:    body.document_id,
        target_type:  'chunk',
        target_id:    c.id,
        hotel_id:     doc.hotel_id,
        triggered_by: 'system',
        metadata:     { chunk_key: c.chunk_key, page: c.page },
      })))
    if (edgeInsErr) {
      return gateFail('embedded.citations_written', `cited_in insert failed: ${edgeInsErr.message}`, 'ocr', 502)
    }

    stage = 'embedded'
    await supabase
      .from('documents')
      .update({ ingestion_stage: stage, updated_at: new Date().toISOString() })
      .eq('id', body.document_id)

    // 7. Contextualize: entity-link suggestion pass over the full chunk text.
    const exResp = await fetch(`${funcBase}/entity-extract`, {
      method: 'POST', headers: forward,
      body: JSON.stringify({ document_id: body.document_id }),
    })
    if (!exResp.ok) {
      const errText = await exResp.text().catch(() => '')
      return gateFail('contextualized.extract_ok',
        `entity-extract failed (${String(exResp.status)}): ${errText.slice(0, 300)}. Document settled at embedded.`,
        'embedded', 502)
    }

    stage = 'contextualized'
    await supabase
      .from('documents')
      .update({ ingestion_stage: stage, updated_at: new Date().toISOString() })
      .eq('id', body.document_id)

    const response: IngestResponse = {
      document_id: body.document_id,
      chunks:      previews,
      page_count:  pages.length,
      chunk_count: chunkRows.length,
      tokens_used: tokensUsed,
      stage,
    }
    return json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return json({ error: message }, 500)
  }
})

// ─── Vision pipeline (Anthropic) — full text per page ───────────────────────

const PAGE_MARKER = /^===\s*PAGE\s+(\d+)\s*===\s*$/gm

async function extractVision(
  blob:     Blob,
  mimeType: string,
  apiKey:   string,
): Promise<{ pages: PageOut[]; tokensUsed: number; truncated: boolean }> {
  const bytes  = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  const base64 = btoa(binary)

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
    ? 'Extract the COMPLETE text content of this PDF, page by page. For each page output a marker line "=== PAGE <n> ===" (1-based) followed by that page\'s full text in reading order. Include every page, even if nearly empty. Output only markers and text — no commentary, no markdown fences.'
    : 'Extract ALL visible text from this image, in reading order. Output only the text — no commentary, no markdown fences.'

  // temperature 0: Foundry's extract step is deterministic; greedy decoding
  // keeps re-ingestion text (and therefore chunk keys) as stable as an LLM
  // extraction can be.
  const completion = await anthropic.messages.create({
    model:       MODEL,
    max_tokens:  OCR_MAX_TOKENS,
    temperature: 0,
    messages:    [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }],
  })

  const tokensUsed = (completion.usage.input_tokens ?? 0) + (completion.usage.output_tokens ?? 0)
  const truncated  = completion.stop_reason === 'max_tokens'

  const textBlock = completion.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    return { pages: [], tokensUsed, truncated }
  }
  const raw = textBlock.text

  // Split on page markers; single-page fallback when the model emitted none
  // (images, or a one-page PDF answered without markers).
  const markers = [...raw.matchAll(PAGE_MARKER)]
  if (markers.length === 0) {
    const text = raw.trim()
    return { pages: text ? [{ page: 1, text }] : [], tokensUsed, truncated }
  }

  const pages: PageOut[] = markers.map((m, i) => {
    const start = m.index! + m[0].length
    const end   = i + 1 < markers.length ? markers[i + 1]!.index! : raw.length
    return { page: Number(m[1]), text: raw.slice(start, end).trim() }
  })
  return { pages, tokensUsed, truncated }
}

// ─── Audio pipeline (OpenAI Whisper) — one page per segment ─────────────────
//
// `response_format=verbose_json` gives per-segment timestamps; each segment
// becomes a page unit so citations resolve to a moment in the recording. The
// timestamp prefix stays in the text so operators can locate it.

async function extractAudio(
  blob:     Blob,
  mimeType: string,
  title:    string,
  apiKey:   string,
): Promise<{ pages: PageOut[]; tokensUsed: number }> {
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

  const segments = Array.isArray(result.segments) && result.segments.length > 0
    ? result.segments
    : [{ id: 0, start: 0, end: 0, text: result.text ?? '' }]

  const pages: PageOut[] = segments
    .map((s, i) => ({
      page: i + 1,
      text: `[${formatTimestamp(s.start)}] ${(s.text ?? '').trim()}`,
    }))
    .filter((p) => p.text.length > 9) // more than just the "[mm:ss] " prefix

  // Whisper pricing is per-second of audio, not tokens; surface seconds so
  // the UI cost hint still means something.
  const totalSeconds = segments.length > 0 ? Math.round(segments[segments.length - 1]?.end ?? 0) : 0
  return { pages, tokensUsed: totalSeconds }
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
// In-process, no external API. Page semantics: paragraph group (docx),
// sheet (xlsx), 50-line block (text/csv). Full text is kept; the shared
// chunker splits oversized units downstream.

async function extractStructured(
  blob:     Blob,
  mimeType: string,
): Promise<{ pages: PageOut[]; tokensUsed: number }> {
  switch (mimeType) {
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDocx(blob)
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return extractXlsx(blob)
    case 'text/plain':
    case 'text/csv':
      return extractPlainText(blob)
    default:
      throw new Error(`extractStructured: unhandled mime ${mimeType}`)
  }
}

interface MammothResult {
  value:    string
  messages: Array<{ type: string; message: string }>
}

async function extractDocx(blob: Blob): Promise<{ pages: PageOut[]; tokensUsed: number }> {
  const arrayBuffer = await blob.arrayBuffer()
  const result = await (mammoth as { extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<MammothResult> })
    .extractRawText({ arrayBuffer })

  const paragraphs = result.value
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const pages: PageOut[] = paragraphs.map((text, i) => ({ page: i + 1, text }))
  return { pages, tokensUsed: result.value.length }
}

async function extractXlsx(blob: Blob): Promise<{ pages: PageOut[]; tokensUsed: number }> {
  const ab = await blob.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(ab), { type: 'array' })
  const pages: PageOut[] = []
  let totalChars = 0
  wb.SheetNames.forEach((sheetName, i) => {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) return
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    if (csv.trim().length === 0) return
    pages.push({ page: i + 1, text: `[${sheetName}] ${csv}` })
    totalChars += csv.length
  })
  return { pages, tokensUsed: totalChars }
}

async function extractPlainText(blob: Blob): Promise<{ pages: PageOut[]; tokensUsed: number }> {
  const text  = await blob.text()
  const lines = text.split(/\r?\n/)
  const GROUP = 50

  const pages: PageOut[] = []
  for (let i = 0; i < lines.length; i += GROUP) {
    const group = lines.slice(i, i + GROUP).join('\n').trim()
    if (group.length === 0) continue
    pages.push({ page: Math.floor(i / GROUP) + 1, text: group })
  }
  return { pages, tokensUsed: text.length }
}
