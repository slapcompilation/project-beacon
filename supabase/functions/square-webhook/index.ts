// Edge Function: square-webhook
// Layer: Floor (Square POS integration) → Flow (stock decrement via ingest_pos_sale)
// Purpose: Square-specific connector.
//   Validates Square HMAC-SHA256 signature, maps Square payment/order events to
//   Beacon menu_item sales, writes via ingest_pos_sale().
//
// Setup in Square Developer Dashboard:
//   Webhook URL:        https://<project>.supabase.co/functions/v1/square-webhook?hotel_id=<beacon-uuid>
//   Subscribed events:  payment.created
//   Signature key:      set as SQUARE_WEBHOOK_SIGNATURE_KEY env var
//
// Square sends the HMAC-SHA256 signature in the x-square-hmacsha256-signature header.
// Signature = base64( HMAC-SHA256( signatureKey, webhookUrl + rawBody ) )
//
// Menu item mapping:
//   Square catalog item variation IDs must be mapped to Beacon menu_item IDs.
//   This mapping lives in hotel.config.square_catalog_map:
//   { "<square_variation_id>": "<beacon_menu_item_id>" }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-square-hmacsha256-signature',
}

// ─── Square payload shapes ────────────────────────────────────────────────────

interface SquareLineItem {
  catalog_object_id?: string   // catalog item variation ID
  quantity:           string   // decimal string e.g. "2.0"
  name?:              string
}

interface SquareOrder {
  id:          string
  line_items?: SquareLineItem[]
  created_at:  string
}

interface SquarePaymentCreatedEvent {
  type:      'payment.created'
  event_id:  string
  data: {
    object: {
      payment: {
        order_id?:   string
        created_at:  string
        amount_money?: { amount: number }
      }
    }
  }
}

type SquareWebhookEvent = SquarePaymentCreatedEvent | { type: string; event_id: string }

// ─── HMAC-SHA256 verification ─────────────────────────────────────────────────
// Square signs: webhookNotificationUrl + requestBody (raw UTF-8 string concatenated)

async function verifySquareSignature(
  signatureKey: string,
  webhookUrl:   string,
  rawBody:      string,
  signature:    string,
): Promise<boolean> {
  const encoder  = new TextEncoder()
  const message  = encoder.encode(webhookUrl + rawBody)
  const keyBytes = encoder.encode(signatureKey)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )

  const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, message)
  const computed = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))

  return computed === signature
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const url     = new URL(req.url)
  const hotelId = url.searchParams.get('hotel_id')
  if (!hotelId) return json({ error: 'hotel_id query parameter required' }, 400)

  const rawBody = await req.text()

  // ── Signature validation ──────────────────────────────────────────────────
  const signatureKey = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY')
  if (!signatureKey) {
    console.error('SQUARE_WEBHOOK_SIGNATURE_KEY not set')
    return json({ error: 'Server misconfiguration' }, 500)
  }

  const incomingSignature = req.headers.get('x-square-hmacsha256-signature') ?? ''
  if (incomingSignature) {
    const valid = await verifySquareSignature(
      signatureKey,
      req.url,
      rawBody,
      incomingSignature,
    )
    if (!valid) return json({ error: 'Invalid signature' }, 401)
  } else {
    if (Deno.env.get('ALLOW_UNSIGNED_WEBHOOKS') !== 'true') {
      return json({ error: 'Missing x-square-hmacsha256-signature header' }, 401)
    }
  }

  // ── Parse ─────────────────────────────────────────────────────────────────
  let event: SquareWebhookEvent
  try {
    event = JSON.parse(rawBody) as SquareWebhookEvent
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (event.type !== 'payment.created') {
    // Acknowledge without processing — Square requires 200 for all subscribed events
    return json({ message: `Event type ${event.type} not handled` }, 200)
  }

  const paymentEvent = event as SquarePaymentCreatedEvent
  const orderId      = paymentEvent.data.object.payment.order_id
  const saleTime     = paymentEvent.data.object.payment.created_at

  if (!orderId) {
    return json({ message: 'No order_id in payment event — skipping' }, 200)
  }

  // ── Fetch Square order to get line items ──────────────────────────────────
  const squareAccessToken = Deno.env.get('SQUARE_ACCESS_TOKEN')
  if (!squareAccessToken) {
    console.error('SQUARE_ACCESS_TOKEN not set')
    return json({ error: 'Server misconfiguration' }, 500)
  }

  const orderRes = await fetch(
    `https://connect.squareup.com/v2/orders/${orderId}`,
    { headers: { 'Square-Version': '2024-01-17', Authorization: `Bearer ${squareAccessToken}` } },
  )

  if (!orderRes.ok) {
    return json({ error: `Square API error fetching order: ${String(orderRes.status)}` }, 502)
  }

  const orderData = await orderRes.json() as { order?: SquareOrder }
  const order     = orderData.order
  if (!order?.line_items?.length) {
    return json({ message: 'No line items in order' }, 200)
  }

  // ── Load hotel catalog map from hotel.config ──────────────────────────────
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: hotel } = await adminClient
    .from('hotels')
    .select('config')
    .eq('id', hotelId)
    .single()

  const catalogMap: Record<string, string> =
    (hotel?.config as Record<string, unknown>)?.square_catalog_map as Record<string, string> ?? {}

  // ── Map line items → ingest_pos_sale calls ────────────────────────────────
  let inserted = 0
  const errors: string[] = []
  const skipped: string[] = []

  for (const item of order.line_items) {
    const catalogId = item.catalog_object_id
    if (!catalogId) { skipped.push('item without catalog_object_id'); continue }

    const menuItemId = catalogMap[catalogId]
    if (!menuItemId) { skipped.push(`unmapped catalog_id: ${catalogId}`); continue }

    const qty = parseFloat(item.quantity)
    if (isNaN(qty) || qty <= 0) { skipped.push(`invalid qty for ${catalogId}`); continue }

    const { error } = await adminClient.rpc('ingest_pos_sale', {
      p_hotel_id:              hotelId,
      p_menu_item_id:          menuItemId,
      p_quantity_sold:         qty,
      p_sale_time:             saleTime,
      p_source_system:         'square',
      p_external_reference_id: `${order.id}:${catalogId}`,
    })

    if (error) {
      console.error('ingest_pos_sale error:', error)
      errors.push(`${menuItemId}: ${error.message}`)
    } else {
      inserted++
    }
  }

  return json(
    {
      source: 'square',
      order_id: orderId,
      inserted,
      total_line_items: order.line_items.length,
      ...(skipped.length > 0 ? { skipped } : {}),
      ...(errors.length > 0  ? { errors }  : {}),
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
