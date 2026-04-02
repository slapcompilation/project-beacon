// Edge Function: mews-webhook
// Layer: Floor (external integration) → Eye (occupancy data)
// Purpose: Mews PMS connector.
//   Validates Mews HMAC-SHA256 signature, maps Mews event types to the
//   normalised occupancy schema, and writes via ingest_occupancy_webhook().
//
// Setup (per hotel in Mews):
//   Webhook URL: https://<project>.supabase.co/functions/v1/mews-webhook?hotel_id=<beacon-uuid>
//   Secret: Set MEWS_WEBHOOK_SECRET env var to the value configured in Mews.
//
// Supported Mews event types:
//   OccupancyUpdated  — direct occupancy snapshot (preferred)
//   ReservationUpdated — reservation count change; occupancy is computed if total_rooms known

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, mews-signature',
}

// ─── Mews payload shapes ─────────────────────────────────────────────────────

interface MewsOccupancyUpdatedData {
  Date: string           // ISO date YYYY-MM-DD
  OccupancyPercent: number
  OccupiedRooms?: number
  TotalRooms?: number
  SnapshotId?: string    // idempotency key
}

interface MewsReservationUpdatedData {
  Date: string
  OccupiedRooms: number
  TotalRooms: number
  ReservationId?: string
}

interface MewsEvent {
  Type: 'OccupancyUpdated' | 'ReservationUpdated' | string
  Data: MewsOccupancyUpdatedData | MewsReservationUpdatedData
}

interface MewsWebhookPayload {
  /** Beacon hotel_id — must be configured in Mews webhook URL query param */
  Events: MewsEvent[]
}

// ─── HMAC-SHA256 verification ────────────────────────────────────────────────
// Mews signs the raw request body with HMAC-SHA256 using the shared webhook secret.
// The signature is hex-encoded in the Mews-Signature header.

async function verifyMewsSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder  = new TextEncoder()
  const keyData  = encoder.encode(secret)
  const bodyData = encoder.encode(rawBody)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, bodyData)
  const computed = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return computed === signature.toLowerCase()
}

// ─── Event mapper ─────────────────────────────────────────────────────────────

interface NormalisedEvent {
  date: string
  occupancy_pct: number
  occupied_rooms: number | null
  total_rooms: number | null
  external_reference_id: string | null
}

function mapMewsEvent(event: MewsEvent): NormalisedEvent | null {
  if (event.Type === 'OccupancyUpdated') {
    const d = event.Data as MewsOccupancyUpdatedData
    if (!d.Date || typeof d.OccupancyPercent !== 'number') return null
    return {
      date:                   d.Date.slice(0, 10),
      occupancy_pct:          d.OccupancyPercent,
      occupied_rooms:         d.OccupiedRooms   ?? null,
      total_rooms:            d.TotalRooms       ?? null,
      external_reference_id:  d.SnapshotId       ?? null,
    }
  }

  if (event.Type === 'ReservationUpdated') {
    const d = event.Data as MewsReservationUpdatedData
    if (!d.Date || !d.OccupiedRooms || !d.TotalRooms) return null
    const occupancy_pct = Math.round((d.OccupiedRooms / d.TotalRooms) * 1000) / 10
    return {
      date:                   d.Date.slice(0, 10),
      occupancy_pct,
      occupied_rooms:         d.OccupiedRooms,
      total_rooms:            d.TotalRooms,
      external_reference_id:  d.ReservationId ?? null,
    }
  }

  // Unknown event type — skip
  return null
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── hotel_id from query string ───────────────────────────────────────────
  const url     = new URL(req.url)
  const hotelId = url.searchParams.get('hotel_id')
  if (!hotelId) {
    return json({ error: 'hotel_id query parameter is required' }, 400)
  }

  // ── Read raw body (needed for signature verification) ────────────────────
  const rawBody = await req.text()

  // ── Validate Mews HMAC signature ─────────────────────────────────────────
  const webhookSecret = Deno.env.get('MEWS_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('MEWS_WEBHOOK_SECRET env var not set')
    return json({ error: 'Server misconfiguration' }, 500)
  }

  const mewsSignature = req.headers.get('mews-signature') ?? ''
  if (mewsSignature) {
    const valid = await verifyMewsSignature(rawBody, mewsSignature, webhookSecret)
    if (!valid) {
      return json({ error: 'Invalid signature' }, 401)
    }
  } else {
    // No signature header — only allow in dev (check ALLOW_UNSIGNED env var)
    if (Deno.env.get('ALLOW_UNSIGNED_WEBHOOKS') !== 'true') {
      return json({ error: 'Missing Mews-Signature header' }, 401)
    }
  }

  // ── Parse payload ─────────────────────────────────────────────────────────
  let body: MewsWebhookPayload
  try {
    body = JSON.parse(rawBody) as MewsWebhookPayload
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (!Array.isArray(body.Events) || body.Events.length === 0) {
    return json({ message: 'No events to process' }, 200)
  }

  // ── Map and filter Mews events ────────────────────────────────────────────
  const normalised = body.Events
    .map(mapMewsEvent)
    .filter((e): e is NormalisedEvent => e !== null)

  if (normalised.length === 0) {
    return json({ message: 'No mappable occupancy events in payload', total: body.Events.length }, 200)
  }

  // ── Persist via service role ──────────────────────────────────────────────
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  let inserted = 0
  const errors: string[] = []

  for (const event of normalised) {
    const { error } = await adminClient.rpc('ingest_occupancy_webhook', {
      p_hotel_id:              hotelId,
      p_source_system:         'mews',
      p_date:                  event.date,
      p_occupancy_pct:         event.occupancy_pct,
      p_occupied_rooms:        event.occupied_rooms,
      p_total_rooms:           event.total_rooms,
      p_external_reference_id: event.external_reference_id,
    })

    if (error) {
      console.error(`mews-webhook ingest error for ${event.date}:`, error)
      errors.push(`${event.date}: ${error.message}`)
    } else {
      inserted++
    }
  }

  return json(
    {
      source: 'mews',
      inserted,
      total_events: body.Events.length,
      mapped: normalised.length,
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
