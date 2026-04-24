/**
 * fire-webhooks — Phase 8 outbound webhook dispatcher
 *
 * Called by dispatchAction (fire-and-forget) after every successful BeaconAction.
 * For each enabled matching endpoint in webhook_endpoints:
 *   1. Build the signed payload
 *   2. POST to the configured URL with X-Beacon-Signature header
 *   3. Write a webhook_deliveries record (success or failure)
 *
 * Signing: HMAC-SHA256(body, endpoint.secret)
 * Header:  X-Beacon-Signature: sha256=<hex>
 *          X-Beacon-Event:     <actionType>
 *          X-Beacon-Hotel:     <hotelId>
 *          X-Beacon-Delivery:  <deliveryId>
 *
 * This function runs with the service role so it can read secrets and write
 * delivery records without client-side RLS. The caller (dispatchAction) must
 * already be authenticated — hotelId is passed explicitly.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TIMEOUT_MS = 8_000

interface FireWebhooksPayload {
  hotelId:     string
  actionType:  string
  payload:     Record<string, unknown>
  triggeredBy: string
  actorId:     string | null
}

interface WebhookEndpointRow {
  id:          string
  url:         string
  secret:      string
  event_types: string[]
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: FireWebhooksPayload
  try {
    body = await req.json() as FireWebhooksPayload
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const { hotelId, actionType, payload, triggeredBy, actorId } = body

  // ── Fetch enabled, matching endpoints ──────────────────────────────────────

  const { data: endpoints, error: fetchError } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret, event_types')
    .eq('hotel_id', hotelId)
    .eq('enabled', true)

  if (fetchError) {
    console.error('[fire-webhooks] Failed to fetch endpoints:', fetchError.message)
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })
  }

  const matching = (endpoints as WebhookEndpointRow[]).filter(
    (ep) => ep.event_types.length === 0 || ep.event_types.includes(actionType),
  )

  if (matching.length === 0) {
    return new Response(JSON.stringify({ fired: 0, failed: 0 }), { status: 200 })
  }

  // ── Build the standard beacon envelope ─────────────────────────────────────

  const envelope = {
    event:        actionType,
    hotel_id:     hotelId,
    timestamp:    new Date().toISOString(),
    actor_id:     actorId,
    triggered_by: triggeredBy,
    data:         payload,
  }

  const bodyStr = JSON.stringify(envelope)

  let fired = 0
  let failed = 0

  // ── Dispatch to each endpoint ───────────────────────────────────────────────

  await Promise.all(matching.map(async (ep) => {
    const deliveryId = crypto.randomUUID()
    const start = Date.now()
    let statusCode: number | null = null
    let success = false
    let error: string | null = null

    try {
      const signature = await hmacSha256(ep.secret, bodyStr)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

      let response: Response
      try {
        response = await fetch(ep.url, {
          method:  'POST',
          headers: {
            'Content-Type':         'application/json',
            'X-Beacon-Signature':   `sha256=${signature}`,
            'X-Beacon-Event':       actionType,
            'X-Beacon-Hotel':       hotelId,
            'X-Beacon-Delivery':    deliveryId,
          },
          body:    bodyStr,
          signal:  controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }

      statusCode = response.status
      success = response.ok
      if (!response.ok) {
        error = `HTTP ${response.status}`
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }

    const duration = Date.now() - start
    success ? fired++ : failed++

    // Write delivery record — best-effort, never throws
    await supabase.from('webhook_deliveries').insert({
      id:           deliveryId,
      endpoint_id:  ep.id,
      hotel_id:     hotelId,
      action_type:  actionType,
      payload:      envelope,
      status_code:  statusCode,
      success,
      error,
      duration_ms:  duration,
    }).then(({ error: insertError }) => {
      if (insertError) {
        console.warn('[fire-webhooks] Failed to write delivery record:', insertError.message)
      }
    })
  }))

  return new Response(JSON.stringify({ fired, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── HMAC-SHA256 helper ────────────────────────────────────────────────────────

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
