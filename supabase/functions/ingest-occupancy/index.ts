// Edge Function: ingest-occupancy
// Layer: Floor (webhook ingestion) → Eye (occupancy data)
// Purpose: Source-agnostic occupancy webhook endpoint.
//   Any PMS that can POST JSON hits this endpoint.
//   Auth: x-beacon-secret header matched against WEBHOOK_SIGNING_SECRET env var.
//   Normalised payload → ingest_occupancy_webhook() RPC → occupancy_logs + pms_connections.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-beacon-secret',
}

// ─── Payload types ────────────────────────────────────────────────────────────

interface OccupancyEvent {
  /** ISO date: YYYY-MM-DD */
  date: string
  /** 0–100 */
  occupancy_pct: number
  occupied_rooms?: number
  total_rooms?: number
  /**
   * Opaque PMS event/snapshot ID used for audit. Not required for dedup —
   * the (hotel_id, date) uniqueness handles that.
   */
  external_reference_id?: string
}

interface IngestPayload {
  hotel_id: string
  source_system: string
  events: OccupancyEvent[]
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json('ok', 200)
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Auth: shared webhook signing secret ──────────────────────────────────
  const signingSecret = Deno.env.get('WEBHOOK_SIGNING_SECRET')
  if (!signingSecret) {
    console.error('WEBHOOK_SIGNING_SECRET env var not set')
    return json({ error: 'Server misconfiguration' }, 500)
  }

  const providedSecret = req.headers.get('x-beacon-secret')
  if (!providedSecret || providedSecret !== signingSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── Parse & validate payload ──────────────────────────────────────────────
  let body: IngestPayload
  try {
    body = await req.json() as IngestPayload
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { hotel_id, source_system, events } = body

  if (!hotel_id || typeof hotel_id !== 'string') {
    return json({ error: 'hotel_id is required' }, 400)
  }
  if (!source_system || typeof source_system !== 'string') {
    return json({ error: 'source_system is required' }, 400)
  }
  if (!Array.isArray(events) || events.length === 0) {
    return json({ error: 'events[] must be a non-empty array' }, 400)
  }

  // ── Persist via service role ──────────────────────────────────────────────
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  let inserted = 0
  const errors: string[] = []

  for (const event of events) {
    if (!event.date || typeof event.occupancy_pct !== 'number') {
      errors.push(`Skipped malformed event: ${JSON.stringify(event)}`)
      continue
    }

    const { error } = await adminClient.rpc('ingest_occupancy_webhook', {
      p_hotel_id:              hotel_id,
      p_source_system:         source_system,
      p_date:                  event.date,
      p_occupancy_pct:         event.occupancy_pct,
      p_occupied_rooms:        event.occupied_rooms   ?? null,
      p_total_rooms:           event.total_rooms      ?? null,
      p_external_reference_id: event.external_reference_id ?? null,
    })

    if (error) {
      console.error(`ingest_occupancy_webhook error for ${event.date}:`, error)
      errors.push(`${event.date}: ${error.message}`)
    } else {
      inserted++
    }
  }

  const status = errors.length > 0 && inserted === 0 ? 422 : 200
  return json(
    {
      inserted,
      total: events.length,
      ...(errors.length > 0 ? { errors } : {}),
    },
    status,
  )
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
