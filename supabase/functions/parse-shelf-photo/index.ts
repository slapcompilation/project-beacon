// Layer: Floor — Photo Stocktake edge function
//
// Accepts: multipart/form-data with `file` (image)
// Returns: { items: RecognizedItem[] }
//
// Uses GPT-4o Vision to identify items on a shelf and estimate quantities.
// The response is structured for operator review — AI pre-fills, operator confirms.
//
// Palantir Principle #4: decision support, not autonomous action.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { preflight } from '../_shared/http.ts'
import { isAuthError, verifyAuth } from '../_shared/auth.ts'

interface RecognizedItem {
  productName:  string
  variantName:  string
  estimatedQty: number
  confidence:   number   // 0-1
  variantId:    string | null
  delta:        number
  reason:       string
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

const SYSTEM_PROMPT = `You are a hotel inventory stocktake assistant.
Analyze the shelf photo and identify all visible food, beverage, and supply items.
For each item return:
- productName: the product name (e.g. "Tomatoes", "Olive Oil 500ml")
- variantName: variant if visible (e.g. "Standard", "Extra Virgin", "1L")
- estimatedQty: your best estimate of visible units (integer)
- confidence: 0.0-1.0 (how sure you are about the identification and count)
- delta: same as estimatedQty (operator can adjust; we treat photo scan as absolute count)
- reason: "photo stocktake"

Return a JSON object: { "items": [...] }
Only return the JSON — no markdown, no explanation.`

serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  try {
    const auth = await verifyAuth(req)
    if (isAuthError(auth)) return auth

    // Parse form
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return new Response('Missing file', { status: 400 })

    // Convert image to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const mimeType = file.type || 'image/jpeg'

    // Call GPT-4o Vision
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured in edge function env vars' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
              },
              {
                type: 'text',
                text: 'Identify all items on this shelf and estimate quantities. Return only the JSON.',
              },
            ],
          },
        ],
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${errText}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const openaiData = await openaiRes.json() as OpenAIResponse
    const content = openaiData.choices?.[0]?.message?.content ?? '{}'

    // Strip markdown code fences if present
    const jsonStr = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    let parsed: { items: RecognizedItem[] }
    try {
      parsed = JSON.parse(jsonStr) as { items: RecognizedItem[] }
    } catch {
      return new Response(
        JSON.stringify({ items: [], error: 'Failed to parse model response' }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
      )
    }

    // Sanitize: ensure all required fields, clamp confidence 0-1
    const items: RecognizedItem[] = (parsed.items ?? []).map((item) => ({
      productName:  String(item.productName  ?? 'Unknown'),
      variantName:  String(item.variantName  ?? 'Standard'),
      estimatedQty: Math.max(0, Math.round(Number(item.estimatedQty ?? 0))),
      confidence:   Math.min(1, Math.max(0, Number(item.confidence ?? 0.5))),
      variantId:    item.variantId ?? null,
      delta:        Math.max(0, Math.round(Number(item.delta ?? item.estimatedQty ?? 0))),
      reason:       String(item.reason ?? 'photo stocktake'),
    }))

    return new Response(
      JSON.stringify({ items }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
    )
  }
})
