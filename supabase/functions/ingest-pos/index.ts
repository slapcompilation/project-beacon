// Edge Function: ingest-pos
// Layer: Floor (POS event ingestion) → Flow (stock log creation)
// Purpose: Source-agnostic POS webhook endpoint.
//   Any POS system that can POST JSON hits this endpoint.
//   Auth: x-beacon-secret header vs WEBHOOK_SIGNING_SECRET env var.
//   Calls ingest_pos_sale() which auto-decrements stock via the immutable log pipeline.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-beacon-secret',
}

interface POSSaleEvent {
  menu_item_id:           string
  qty:                    number
  sale_time:              string   // ISO timestamptz
  external_reference_id?: string
}

interface IngestPayload {
  hotel_id:      string
  source_system: string
  sales:         POSSaleEvent[]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const signingSecret = Deno.env.get('WEBHOOK_SIGNING_SECRET')
  if (!signingSecret) {
    console.error('WEBHOOK_SIGNING_SECRET not set')
    return json({ error: 'Server misconfiguration' }, 500)
  }
  if (req.headers.get('x-beacon-secret') !== signingSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── Parse payload ─────────────────────────────────────────────────────────
  let body: IngestPayload
  try {
    body = await req.json() as IngestPayload
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { hotel_id, source_system, sales } = body
  if (!hotel_id)                              return json({ error: 'hotel_id required' }, 400)
  if (!source_system)                         return json({ error: 'source_system required' }, 400)
  if (!Array.isArray(sales) || !sales.length) return json({ error: 'sales[] must be non-empty' }, 400)

  // ── Persist ───────────────────────────────────────────────────────────────
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  let inserted = 0
  const errors: string[] = []

  for (const sale of sales) {
    if (!sale.menu_item_id || typeof sale.qty !== 'number' || !sale.sale_time) {
      errors.push(`Skipped malformed event: ${JSON.stringify(sale)}`)
      continue
    }

    const { error } = await adminClient.rpc('ingest_pos_sale', {
      p_hotel_id:              hotel_id,
      p_menu_item_id:          sale.menu_item_id,
      p_quantity_sold:         sale.qty,
      p_sale_time:             sale.sale_time,
      p_source_system:         source_system,
      p_external_reference_id: sale.external_reference_id ?? null,
    })

    if (error) {
      console.error(`ingest_pos_sale error:`, error)
      errors.push(`${sale.menu_item_id}: ${error.message}`)
    } else {
      inserted++
    }
  }

  return json(
    {
      inserted,
      total: sales.length,
      ...(errors.length > 0 ? { errors } : {}),
    },
    errors.length > 0 && inserted === 0 ? 422 : 200,
  )
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
