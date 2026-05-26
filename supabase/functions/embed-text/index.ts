// embed-text — single-purpose edge function that returns OpenAI embeddings
// for the supplied text(s). Used by:
//   - useCopilotChat / curate (one input at a time, before write)
//   - document-ingest (batch, one per chunk, after OCR)
//
// Keeping it a thin proxy means the OPENAI_API_KEY only ever lives
// server-side. Auth-checked so anonymous clients can't burn the quota.

import { json, preflight } from '../_shared/http.ts'
import { isAuthError, verifyAuth } from '../_shared/auth.ts'

interface EmbedRequest {
  /** One or more strings to embed. */
  texts: string[]
  /** Optional override; defaults to text-embedding-3-small (1536 dims). */
  model?: string
}

interface EmbedResponse {
  embeddings: number[][]
  model:      string
  tokens_used: number
}

interface OpenAIEmbedResponse {
  data:  Array<{ embedding: number[] }>
  model: string
  usage: { prompt_tokens: number }
}

const DEFAULT_MODEL = 'text-embedding-3-small'
const MAX_BATCH     = 100  // OpenAI accepts up to 2048, but 100 keeps payloads small

Deno.serve(async (req: Request) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return json({ error: 'OPENAI_API_KEY secret not set' }, 500)

    const auth = await verifyAuth(req)
    if (isAuthError(auth)) return auth

    const body = await req.json() as EmbedRequest
    if (!Array.isArray(body.texts) || body.texts.length === 0) {
      return json({ error: 'texts array required' }, 400)
    }
    if (body.texts.length > MAX_BATCH) {
      return json({ error: `Max ${String(MAX_BATCH)} texts per request` }, 400)
    }

    // Trim and drop empty entries — OpenAI rejects empty strings.
    const inputs = body.texts.map((t) => (typeof t === 'string' ? t.trim() : '')).filter((t) => t.length > 0)
    if (inputs.length === 0) return json({ error: 'all texts empty after trim' }, 400)

    const model = body.model ?? DEFAULT_MODEL

    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ input: inputs, model }),
    })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      return json({ error: `OpenAI ${String(resp.status)}: ${errText.slice(0, 300)}` }, 502)
    }

    const data = await resp.json() as OpenAIEmbedResponse

    const response: EmbedResponse = {
      embeddings:  data.data.map((d) => d.embedding),
      model:       data.model,
      tokens_used: data.usage.prompt_tokens,
    }
    return json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return json({ error: message }, 500)
  }
})
