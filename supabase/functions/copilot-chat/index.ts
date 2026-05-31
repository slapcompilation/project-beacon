// Layer: Eye — LLM-powered copilot with tool-calling for hotel operations
// Phase B1 of Beacon AIP roadmap: replaces keyword-based router with Claude tool-calling.
// Pattern: multi-turn conversation, server-side tool execution, action proposals.
//
// Conversation persistence (migration 122):
//   - If `conversation_id` is provided, prior turns are loaded from
//     `copilot_messages` and prepended to the LLM context. The client only
//     sends the new user turn.
//   - If `conversation_id` is omitted, a new row is created in
//     `copilot_conversations` (titled from the first ~60 chars of the user's
//     prompt) and its id is returned in the response.
//   - User + assistant messages are inserted in `copilot_messages` with the
//     tool_trace + iterations + model preserved per turn.
//   - All persistence runs against the user-scoped Supabase client, so RLS
//     enforces ownership without us needing the service role.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.36.3'
import { corsHeaders, json, preflight } from '../_shared/http.ts'
import { isAuthError, verifyAuth } from '../_shared/auth.ts'

// ─── Tool definitions for Claude ────────────────────────────────────────────────
// Each tool maps to a Supabase RPC. The copilot calls these server-side.

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_shift_intelligence',
    description: 'Get current shift signals ranked by urgency: depletion risks, waste spikes, dead stock, cost-at-risk items. Use this for "what\'s happening now", "what needs attention", "status overview", "briefing".',
    input_schema: {
      type: 'object' as const,
      properties: {
        window_days: { type: 'number', description: 'Lookback window in days (default 30)', default: 30 },
      },
      required: [],
    },
  },
  {
    name: 'get_waste_radar',
    description: 'Get variants with abnormal write-off rates (waste spikes above baseline). Use for "waste", "write-offs", "theft", "spoilage", "breakage" questions.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_consumption_forecast',
    description: 'Get depletion predictions for all variants: burn rate, days until zero, confidence bands. Use for "running out", "how long will X last", "stock levels", "forecast".',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Forecast window in days (default 30)', default: 30 },
      },
      required: [],
    },
  },
  {
    name: 'get_active_incidents',
    description: 'Get cross-domain incidents with severity scores and correlation counts. Use for "problems", "issues", "incidents", "what\'s wrong".',
    input_schema: {
      type: 'object' as const,
      properties: {
        window_days: { type: 'number', description: 'Lookback window (default 7)', default: 7 },
      },
      required: [],
    },
  },
  {
    name: 'get_supplier_reliability',
    description: 'Get supplier delivery performance scorecards: on-time rate, risk tier, avg delay. Use for "suppliers", "delivery", "late", "vendor performance".',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Lookback window (default 90)', default: 90 },
      },
      required: [],
    },
  },
  {
    name: 'get_variant_intelligence',
    description: 'Get comprehensive intelligence for a single product variant by ID: stock, trends, forecasts, anomalies, supplier info. Use when user asks about a specific product.',
    input_schema: {
      type: 'object' as const,
      properties: {
        variant_id: { type: 'string', description: 'The variant UUID' },
      },
      required: ['variant_id'],
    },
  },
  {
    name: 'explain_anomaly',
    description: 'Get root cause explanation for a stock anomaly on a specific variant. Use for "why is X spiking", "explain the anomaly on X".',
    input_schema: {
      type: 'object' as const,
      properties: {
        variant_id:   { type: 'string', description: 'The variant UUID' },
        anomaly_type: { type: 'string', enum: ['waste_spike', 'stock_depletion', 'auto'], description: 'Type of anomaly (default auto-detect)', default: 'auto' },
      },
      required: ['variant_id'],
    },
  },
  {
    name: 'get_team_performance',
    description: 'Get team member activity and performance metrics: adjustments, accuracy, write-offs per person. Use for "team", "who", "staff performance", shift comparisons.',
    input_schema: {
      type: 'object' as const,
      properties: {
        window_days: { type: 'number', description: 'Lookback window (default 30)', default: 30 },
      },
      required: [],
    },
  },
  {
    name: 'get_stock_pressure',
    description: 'Get a ranked list of variants under stock pressure: items most likely to run out, considering demand velocity and supply constraints.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_dead_stock',
    description: 'Get items with no movement for an extended period (dead stock). Use for "stale inventory", "not moving", "slow movers".',
    input_schema: {
      type: 'object' as const,
      properties: {
        idle_days: { type: 'number', description: 'Minimum idle days (default 60)', default: 60 },
      },
      required: [],
    },
  },
  {
    name: 'get_occupancy_adjusted_forecast',
    description: 'Get demand forecasts adjusted for upcoming occupancy. Shows how booking forecasts impact each variant\'s depletion timeline. Use for "occupancy impact", "upcoming demand", "high occupancy weekend", "demand spike".',
    input_schema: {
      type: 'object' as const,
      properties: {
        forecast_days: { type: 'number', description: 'Forward-looking days (default 14)', default: 14 },
        lookback_days: { type: 'number', description: 'Historical lookback for baseline (default 30)', default: 30 },
      },
      required: [],
    },
  },
  {
    name: 'search_products',
    description: 'Search for products/variants by name, SKU, or description. Use when the user refers to a product by name and you need its variant_id for other tools.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search text (product name, SKU, or keyword)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_restock_requests',
    description: 'Get current restock requests with their status. Use for "pending orders", "restock queue", "what needs ordering".',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by status: pending, approved, ordered, received, cancelled. Omit for all.', enum: ['pending', 'pending_manager', 'pending_director', 'approved', 'ordered', 'received', 'cancelled'] },
      },
      required: [],
    },
  },
  // ─── Action tools (propose, don't auto-execute) ─────────────────────────────
  {
    name: 'propose_restock',
    description: 'Propose a restock request for a variant. Returns a structured proposal for the user to confirm — does NOT auto-execute. Use when user says "order more X", "restock X", "we need more X".',
    input_schema: {
      type: 'object' as const,
      properties: {
        variant_id: { type: 'string', description: 'The variant UUID to restock' },
        quantity: { type: 'number', description: 'Quantity to order' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Urgency level' },
        notes: { type: 'string', description: 'Optional notes for the request' },
      },
      required: ['variant_id', 'quantity'],
    },
  },
  {
    name: 'propose_stock_adjustment',
    description: 'Propose a stock adjustment (add, subtract, or set). Returns a structured proposal for user confirmation. Use for "write off X", "add X to stock", "set X to N".',
    input_schema: {
      type: 'object' as const,
      properties: {
        variant_id: { type: 'string', description: 'The variant UUID' },
        action: { type: 'string', enum: ['add', 'subtract', 'set'], description: 'Type of adjustment' },
        quantity: { type: 'number', description: 'Quantity (positive)' },
        reason: { type: 'string', description: 'Reason for adjustment (e.g., "breakage", "received delivery", "cycle count correction")' },
      },
      required: ['variant_id', 'action', 'quantity', 'reason'],
    },
  },
  {
    name: 'propose_batch_approval',
    description: 'Propose batch approval of pending restock requests matching criteria. Returns list for user confirmation. Use for "approve all under $100", "approve pending restocks".',
    input_schema: {
      type: 'object' as const,
      properties: {
        max_cost: { type: 'number', description: 'Maximum estimated cost to include' },
        supplier_id: { type: 'string', description: 'Filter to specific supplier UUID' },
      },
      required: [],
    },
  },
]

// ─── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Beacon Copilot, the AI operations assistant for a hotel inventory management system. You help hotel managers, owners, bartenders, maids, and warehouse workers understand their inventory, make decisions, and take actions.

IDENTITY:
- You are part of Beacon, a Palantir AIP-grade hotel operations platform
- You operate on the Reality Graph — a unified data model where every entity (product, supplier, PO, alert) is a connected node
- You can query real-time data, explain anomalies, and propose actions

CAPABILITIES:
- Query any aspect of hotel operations: stock levels, forecasts, waste, suppliers, team performance, incidents
- Explain anomalies with root cause analysis using graph traversal
- Propose actions (restock, write-off, approval) — but NEVER auto-execute. Always present as a proposal for user confirmation.
- Cross-domain synthesis: combine signals from multiple sources to answer complex questions

RULES:
1. Always ground answers in data. Call tools to get current data before answering — never guess stock levels or metrics.
2. When the user mentions a product by name, use search_products first to resolve to a variant_id before calling other tools.
3. For action proposals, return a structured JSON block with type "action_proposal" containing the action details. The UI will render confirmation buttons.
4. Show confidence basis inline: "based on 30-day avg", "94% restock adherence", etc.
5. Be concise and operational. Managers are making decisions under time pressure.
6. When multiple signals point to the same root cause, synthesize them — don't list each separately.
7. If you can't find what the user is asking about, say so clearly rather than guessing.
8. For numbers and costs, always be precise — never round unless the user asks for a summary.

RESPONSE FORMAT:
- Use markdown for structure (headers, bullets, bold for emphasis)
- For action proposals, include a JSON block marked with \`\`\`action that the UI will parse
- Keep responses under 300 words unless the user asks for detail`

// ─── Tool execution ─────────────────────────────────────────────────────────────

interface ToolInput {
  window_days?: number
  days?: number
  forecast_days?: number
  lookback_days?: number
  variant_id?: string
  idle_days?: number
  query?: string
  status?: string
  quantity?: number
  urgency?: string
  notes?: string
  action?: string
  reason?: string
  max_cost?: number
  supplier_id?: string
}

async function executeTool(
  supabase: SupabaseClient,
  toolName: string,
  input: ToolInput,
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_shift_intelligence': {
        const { data, error } = await supabase.rpc('get_shift_intelligence', { p_window_days: input.window_days ?? 30 })
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'get_waste_radar': {
        const { data, error } = await supabase.rpc('get_waste_radar')
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'get_consumption_forecast': {
        const { data, error } = await supabase.rpc('get_consumption_forecast', { p_days: input.days ?? 30 })
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'get_active_incidents': {
        const { data, error } = await supabase.rpc('get_active_incidents', { p_window_days: input.window_days ?? 7 })
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'get_supplier_reliability': {
        const { data, error } = await supabase.rpc('get_supplier_reliability', { p_days: input.days ?? 90 })
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'get_variant_intelligence': {
        const { data, error } = await supabase.rpc('get_variant_intelligence', { p_variant_id: input.variant_id })
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'explain_anomaly': {
        const { data, error } = await supabase.rpc('explain_anomaly', {
          p_variant_id:   input.variant_id,
          p_anomaly_type: input.anomaly_type ?? 'auto',
        })
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'get_team_performance': {
        const { data, error } = await supabase.rpc('get_team_performance', { p_window_days: input.window_days ?? 30 })
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'get_stock_pressure': {
        const { data, error } = await supabase.rpc('get_stock_pressure')
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'get_dead_stock': {
        const { data, error } = await supabase.rpc('get_dead_stock', { p_idle_days: input.idle_days ?? 60 })
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'get_occupancy_adjusted_forecast': {
        const { data, error } = await supabase.rpc('get_occupancy_adjusted_forecast', {
          p_forecast_days: input.forecast_days ?? 14,
          p_lookback_days: input.lookback_days ?? 30,
        })
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'search_products': {
        const { data, error } = await supabase
          .from('product_variants')
          .select('id, sku, product:products!inner(name, hotel_id)')
          .or(`sku.ilike.%${input.query}%,products.name.ilike.%${input.query}%`)
          .limit(10)
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'get_restock_requests': {
        let query = supabase
          .from('restock_requests')
          .select('id, variant_id, quantity_needed, estimated_cost, status, notes, created_at, variant:product_variants!inner(sku, product:products!inner(name))')
          .order('created_at', { ascending: false })
          .limit(20)
        if (input.status) {
          query = query.eq('status', input.status)
        }
        const { data, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(data)
      }
      case 'propose_restock': {
        // Don't execute — return a structured proposal for the UI to render
        return JSON.stringify({
          type: 'action_proposal',
          action: 'REQUEST_RESTOCK',
          params: {
            variant_id: input.variant_id,
            quantity: input.quantity,
            urgency: input.urgency ?? 'medium',
            notes: input.notes ?? '',
          },
          message: 'Restock proposal ready for confirmation.',
        })
      }
      case 'propose_stock_adjustment': {
        return JSON.stringify({
          type: 'action_proposal',
          action: input.action === 'subtract' ? 'WRITE_OFF' : 'ADJUST_STOCK',
          params: {
            variant_id: input.variant_id,
            action: input.action,
            quantity: input.quantity,
            reason: input.reason,
          },
          message: 'Stock adjustment proposal ready for confirmation.',
        })
      }
      case 'propose_batch_approval': {
        // Fetch eligible pending requests
        let query = supabase
          .from('restock_requests')
          .select('id, variant_id, estimated_cost, status, variant:product_variants!inner(sku, product:products!inner(name))')
          .in('status', ['pending', 'pending_manager'])
        if (input.max_cost) {
          query = query.lte('estimated_cost', input.max_cost)
        }
        const { data, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({
          type: 'action_proposal',
          action: 'BATCH_APPROVE',
          params: {
            request_ids: (data ?? []).map((r: { id: string }) => r.id),
            max_cost: input.max_cost,
          },
          requests: data,
          message: `${(data ?? []).length} requests eligible for batch approval.`,
        })
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SelectionContext {
  kind:   string
  id:     string
  label?: string
}

interface RequestBody {
  /** New user turn (and optionally any client-side override of prior turns).
   *  When `conversation_id` is provided, history is loaded server-side; the
   *  client typically only sends a single new `user` message. */
  messages: ChatMessage[]
  /** Existing conversation to continue. Omit to start a new conversation. */
  conversation_id?: string
  /** Selection-aware copilot (Phase D). What the operator is currently
   *  looking at — appended to the system prompt so tool defaults / action
   *  proposals fall back to this id when no override is given. */
  selection?: SelectionContext
}

function buildSystemPrompt(selection?: SelectionContext): string {
  if (!selection) return SYSTEM_PROMPT
  return SYSTEM_PROMPT + `

CURRENT VIEW:
The operator is currently looking at a ${selection.kind} (id: \`${selection.id}\`)${selection.label ? ` — "${selection.label}"` : ''}. When a tool input or proposal field needs a ${selection.kind} id and the operator hasn't named a different one, default to this id. When the operator's question is vague ("forecast this?", "is this OK?"), assume it refers to the current ${selection.kind} unless they say otherwise.`
}

/** First-message → derived conversation title. Trimmed to 60 chars,
 *  whitespace collapsed, no trailing fragment. */
function deriveTitle(firstUserContent: string): string {
  const cleaned = firstUserContent.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 60) return cleaned || 'New conversation'
  return cleaned.slice(0, 57).trimEnd() + '…'
}

/** A single action proposal emitted by the assistant. Mirrors the structured
 *  payload returned by the propose_* tools and the JSON block format documented
 *  in the system prompt. The UI renders Confirm / Edit / Cancel cards from
 *  these — they are NEVER auto-executed. */
interface ParsedActionProposal {
  type:    'action_proposal'
  action:  string                   // e.g. 'REQUEST_RESTOCK', 'WRITE_OFF', 'BATCH_APPROVE'
  params:  Record<string, unknown>
  message?: string
}

/** Extract every ```action … ``` fenced block from the assistant's final text,
 *  parse each as JSON, and return the well-shaped ones.
 *
 *  The system prompt instructs Claude: "include a JSON block marked with
 *  ```action that the UI will parse". The propose_* tools also return the same
 *  shape; the LLM typically echoes their results into a fenced block. We
 *  ignore non-conforming blocks rather than throwing — a malformed response
 *  shouldn't crash persistence. */
function extractActionProposals(text: string): ParsedActionProposal[] {
  const fenceRe   = /```action\s*\n([\s\S]*?)```/g
  const proposals: ParsedActionProposal[] = []
  let match: RegExpExecArray | null
  while ((match = fenceRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as Partial<ParsedActionProposal>
      if (
        parsed
        && parsed.type === 'action_proposal'
        && typeof parsed.action === 'string'
        && parsed.params
        && typeof parsed.params === 'object'
        && !Array.isArray(parsed.params)
      ) {
        proposals.push({
          type:    'action_proposal',
          action:  parsed.action,
          params:  parsed.params as Record<string, unknown>,
          message: typeof parsed.message === 'string' ? parsed.message : undefined,
        })
      }
    } catch {
      // Malformed JSON inside an ```action fence — silently skip.
      // Future revision: log to system_health_events for telemetry.
    }
  }
  return proposals
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req)
  if (pre) return pre

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY secret not set' }, 500)

    const auth = await verifyAuth(req)
    if (isAuthError(auth)) return auth
    const { supabase, user } = auth

    const body = await req.json() as RequestBody
    if (!body.messages || body.messages.length === 0) {
      return json({ error: 'messages array is required' }, 400)
    }

    // ── Per-hotel tool allowlist (Phase 10.b) ────────────────────────────────
    // Resolve the caller's hotel + look up the copilot_tool_configs row.
    // Absence of a row = every TOOL enabled; rows list tools that should be
    // hidden from the LLM. Filter once and reuse everywhere TOOLS appears.
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('hotel_id')
      .eq('id', user.id)
      .single() as unknown as { data: { hotel_id: string } | null }
    let disabledTools: string[] = []
    if (callerProfile?.hotel_id) {
      const { data: config } = await supabase
        .from('copilot_tool_configs')
        .select('disabled_tools')
        .eq('hotel_id', callerProfile.hotel_id)
        .maybeSingle() as unknown as { data: { disabled_tools: string[] | null } | null }
      disabledTools = config?.disabled_tools ?? []
    }
    const allowedTools = disabledTools.length === 0
      ? TOOLS
      : TOOLS.filter((t) => !disabledTools.includes(t.name))

    // ── Conversation persistence (Phase B1) ──────────────────────────────
    // Resolve / create the conversation row up front so subsequent inserts
    // have a valid foreign key. RLS scopes both reads and writes to the
    // current user via the user-bound supabase client — no service-role hop.

    let conversationId = body.conversation_id ?? null
    let priorMessages: ChatMessage[] = []

    if (conversationId) {
      // Load the prior turn history. RLS guarantees the user owns the row.
      const { data: rows, error: loadErr } = await supabase
        .from('copilot_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }) as unknown as {
          data: { role: 'user' | 'assistant' | 'system'; content: string }[] | null
          error: { message: string; code?: string } | null
        }
      if (loadErr) {
        return json({ error: `Failed to load conversation history: ${loadErr.message}` }, 403)
      }
      priorMessages = (rows ?? [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    } else {
      // Brand-new conversation — derive a title from the first user message.
      const firstUser = body.messages.find((m) => m.role === 'user')
      if (!firstUser) {
        return json({ error: 'first message must include a user role' }, 400)
      }

      // Resolve hotel_id from the auth profile (RLS WITH CHECK requires it).
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('hotel_id')
        .eq('id', user.id)
        .single() as unknown as {
          data: { hotel_id: string } | null
          error: { message: string } | null
        }
      if (profErr || !profile) {
        return json({ error: 'Failed to resolve hotel for caller' }, 403)
      }

      const { data: convRow, error: convErr } = await supabase
        .from('copilot_conversations')
        .insert({
          user_id:  user.id,
          hotel_id: profile.hotel_id,
          title:    deriveTitle(firstUser.content),
        })
        .select('id')
        .single() as unknown as {
          data: { id: string } | null
          error: { message: string } | null
        }
      if (convErr || !convRow) {
        return json({ error: `Failed to create conversation: ${convErr?.message ?? 'unknown'}` }, 500)
      }
      conversationId = convRow.id
    }

    const anthropic = new Anthropic({ apiKey })

    // Convert chat messages to Anthropic format. Server-loaded history
    // precedes the client-supplied turn(s) so Claude sees the full context.
    const anthropicMessages: Anthropic.MessageParam[] = [
      ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
      ...body.messages.map((m) => ({ role: m.role, content: m.content })),
    ]

    // ── Streaming branch (SSE) ───────────────────────────────────────────
    // When the caller advertises `Accept: text/event-stream`, we stream the
    // assistant's response token-by-token over Server-Sent Events. Tool calls
    // are emitted as `tool_call` / `tool_result` markers between iterations
    // (no streaming of tool input/output — those are server-internal).
    //
    // Event shape (one JSON object per `data:` line):
    //   { type: 'conversation_id', conversation_id }
    //   { type: 'text_delta',      delta }
    //   { type: 'tool_call',       name, input, iteration }
    //   { type: 'tool_result',     name, duration_ms, iteration }
    //   { type: 'done',            tool_trace, iterations, model,
    //                              conversation_id, action_proposals }
    //   { type: 'error',           message }
    //
    // Persistence + action_proposal extraction happen exactly as in the JSON
    // path; only the transport changes.
    const acceptHeader = req.headers.get('accept') ?? ''
    if (acceptHeader.includes('text/event-stream')) {
      const encoder = new TextEncoder()
      const sseStream = new ReadableStream({
        async start(controller) {
          const send = (event: object) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }
          try {
            // Emit the conversation id up front so the client can pin the URL /
            // associate UI state before the first token arrives.
            send({ type: 'conversation_id', conversation_id: conversationId })

            const toolTrace: { tool: string; input: ToolInput; duration_ms: number }[] = []
            let iterations = 0
            const MAX_ITERATIONS = 8
            let finalMessage: Anthropic.Message | null = null

            while (iterations < MAX_ITERATIONS) {
              iterations++

              const llmStream = anthropic.messages.stream({
                model:      'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                system:     buildSystemPrompt(body.selection),
                tools:      allowedTools,
                messages:   anthropicMessages,
              })

              // Forward text deltas as they arrive — cuts perceived latency.
              for await (const event of llmStream) {
                if (
                  event.type === 'content_block_delta'
                  && event.delta.type === 'text_delta'
                ) {
                  send({ type: 'text_delta', delta: event.delta.text })
                }
              }

              finalMessage = await llmStream.finalMessage()

              // No tool calls → assistant is done; break out of the agentic loop.
              if (finalMessage.stop_reason !== 'tool_use') break

              // Otherwise, run each tool synchronously and emit markers.
              const toolUses = finalMessage.content.filter(
                (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
              )
              const toolResults: Anthropic.ToolResultBlockParam[] = []
              for (const tu of toolUses) {
                send({
                  type:      'tool_call',
                  name:      tu.name,
                  input:     tu.input as Record<string, unknown>,
                  iteration: iterations,
                })
                const start    = Date.now()
                const result   = await executeTool(supabase, tu.name, tu.input as ToolInput)
                const duration = Date.now() - start
                send({
                  type:        'tool_result',
                  name:        tu.name,
                  duration_ms: duration,
                  iteration:   iterations,
                })
                toolTrace.push({ tool: tu.name, input: tu.input as ToolInput, duration_ms: duration })
                toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
              }

              anthropicMessages.push({ role: 'assistant', content: finalMessage.content })
              anthropicMessages.push({ role: 'user',      content: toolResults })
            }

            // Reconstruct the final text response from the last message's
            // content blocks (delta accumulation isn't safe across iterations).
            let finalResponse = ''
            if (finalMessage) {
              for (const block of finalMessage.content) {
                if (block.type === 'text') finalResponse += block.text
              }
            }

            const actionProposals = extractActionProposals(finalResponse)
            const proposalsForRow = actionProposals.length > 0 ? actionProposals : null

            // Persist user + assistant turn pair (same shape as JSON path).
            const lastUserMsg = [...body.messages].reverse().find((m) => m.role === 'user')
            if (lastUserMsg) {
              const { error: insErr } = await supabase
                .from('copilot_messages')
                .insert([
                  {
                    conversation_id: conversationId,
                    role:            'user' as const,
                    content:         lastUserMsg.content,
                    tool_trace:      [],
                    iterations:      0,
                    model:           null,
                    action_proposal: null,
                  },
                  {
                    conversation_id: conversationId,
                    role:            'assistant' as const,
                    content:         finalResponse,
                    tool_trace:      toolTrace,
                    iterations,
                    model:           'claude-haiku-4-5-20251001',
                    action_proposal: proposalsForRow,
                  },
                ]) as unknown as { error: { message: string } | null }
              if (insErr) {
                console.warn('[copilot-chat] persistence failed (stream):', insErr.message)
              }
            }

            send({
              type:             'done',
              tool_trace:       toolTrace,
              iterations,
              model:            'claude-haiku-4-5-20251001',
              conversation_id:  conversationId,
              action_proposals: actionProposals,
            })
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            send({ type: 'error', message })
          } finally {
            controller.close()
          }
        },
      })

      return new Response(sseStream, {
        headers: {
          ...corsHeaders,
          'Content-Type':  'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection:      'keep-alive',
        },
      })
    }
    // ── End streaming branch ─────────────────────────────────────────────

    // Tool-calling loop: Claude may call multiple tools before responding
    const toolTrace: { tool: string; input: ToolInput; duration_ms: number }[] = []
    let finalResponse = ''
    let iterations = 0
    const MAX_ITERATIONS = 8

    // Initial request
    let response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: buildSystemPrompt(body.selection),
      tools: allowedTools,
      messages: anthropicMessages,
    })

    // Agentic loop: keep going while Claude wants to call tools
    while (response.stop_reason === 'tool_use' && iterations < MAX_ITERATIONS) {
      iterations++

      // Extract tool calls from response
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      )

      // Execute each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const toolUse of toolUseBlocks) {
        const start = Date.now()
        const result = await executeTool(supabase, toolUse.name, toolUse.input as ToolInput)
        const duration = Date.now() - start

        toolTrace.push({
          tool: toolUse.name,
          input: toolUse.input as ToolInput,
          duration_ms: duration,
        })

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        })
      }

      // Continue conversation with tool results
      anthropicMessages.push({
        role: 'assistant',
        content: response.content,
      })
      anthropicMessages.push({
        role: 'user',
        content: toolResults,
      })

      response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: buildSystemPrompt(body.selection),
        tools: allowedTools,
        messages: anthropicMessages,
      })
    }

    // Extract final text response
    for (const block of response.content) {
      if (block.type === 'text') {
        finalResponse += block.text
      }
    }

    // ── Extract any structured action proposals from the assistant text ──
    // The system prompt asks Claude to emit ```action JSON blocks for any
    // mutation it suggests. We parse them out of the final response so the
    // UI can render Confirm / Edit / Cancel cards. Stored as an array on the
    // copilot_messages row (or null if none) — never auto-executed.
    const actionProposals = extractActionProposals(finalResponse)
    const proposalsForRow  = actionProposals.length > 0 ? actionProposals : null

    // ── Persist the new user + assistant turn pair ───────────────────────
    // Insert the LATEST user message (the one the client just sent — usually
    // body.messages[body.messages.length - 1]) and the assistant's final
    // response. The trigger trg_copilot_msg_bump_conv updates message_count
    // and last_message_at on the parent conversation.
    const lastUserMsg = [...body.messages].reverse().find((m) => m.role === 'user')
    if (lastUserMsg) {
      const turnRows = [
        {
          conversation_id: conversationId,
          role:            'user' as const,
          content:         lastUserMsg.content,
          tool_trace:      [],
          iterations:      0,
          model:           null,
          action_proposal: null,
        },
        {
          conversation_id: conversationId,
          role:            'assistant' as const,
          content:         finalResponse,
          tool_trace:      toolTrace,
          iterations,
          model:           'claude-haiku-4-5-20251001',
          action_proposal: proposalsForRow,
        },
      ]
      const { error: insErr } = await supabase
        .from('copilot_messages')
        .insert(turnRows) as unknown as { error: { message: string } | null }
      if (insErr) {
        // Persistence failure is non-fatal — return the LLM result anyway.
        // Surface the error so the caller can decide whether to retry sync.
        console.warn('[copilot-chat] persistence failed:', insErr.message)
      }
    }

    return json({
      response:         finalResponse,
      tool_trace:       toolTrace,
      model:            'claude-haiku-4-5-20251001',
      iterations,
      conversation_id:  conversationId,
      action_proposals: actionProposals,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: `Internal error: ${message}` }, 500)
  }
})
