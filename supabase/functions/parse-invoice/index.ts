// Edge Function: parse-invoice
// Layer: Mind — Invoice OCR intake (AIP Expense Reporting pattern)
//
// Accepts a multipart form with a file (image or PDF).
// Uses OpenAI GPT-4o Vision to extract structured invoice fields.
// Returns JSON ready to pre-fill the SUBMIT_PO_INVOICE form.
//
// Required env vars: OPENAI_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders as CORS, preflight } from '../_shared/http.ts'
import { isAuthError, verifyAuth } from '../_shared/auth.ts'

interface ParsedInvoice {
  invoiceNumber: string | null
  invoiceDate:   string | null   // ISO date string YYYY-MM-DD
  invoiceAmount: number | null
  supplierName:  string | null
  notes:         string | null
  lineItems: Array<{
    description: string
    qty:         number | null
    unitPrice:   number | null
    total:       number | null
  }>
  confidence: 'high' | 'medium' | 'low'
}

serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  try {
    // Gate behind auth so anonymous callers can't burn the OpenAI quota.
    const auth = await verifyAuth(req)
    if (isAuthError(auth)) return auth

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    // Convert file to base64 for Vision API
    const buffer  = await file.arrayBuffer()
    const base64  = btoa(String.fromCharCode(...new Uint8Array(buffer)))
    const mimeType = file.type || 'image/jpeg'

    const prompt = `You are an invoice parser. Extract all fields from this invoice image/document.
Return ONLY valid JSON with this exact shape (use null for missing fields):
{
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "invoiceAmount": number or null,
  "supplierName": "string or null",
  "notes": "any special terms or null",
  "lineItems": [{ "description": "string", "qty": number or null, "unitPrice": number or null, "total": number or null }],
  "confidence": "high" | "medium" | "low"
}
confidence = high if all main fields present, medium if some missing, low if very unclear.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'text',       text: prompt },
            { type: 'image_url',  image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
          ],
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI error: ${err}`)
    }

    const json  = await response.json() as { choices: Array<{ message: { content: string } }> }
    const text  = json.choices[0]?.message?.content ?? '{}'

    // Strip markdown fences if present
    const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean) as ParsedInvoice

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
