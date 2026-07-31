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
import { runScenarioSimulation } from '../_shared/scenario-sim.ts'
import { computeCalibration, orgPolicyToCalibrationOptions, evaluateUserToolAcross, bindToolArgs, evaluateConstraints, copilotProposalToAction, evaluateBatchApprovals, mergeOrgPolicy } from '../_shared/reality-graph.bundle.mjs'

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
    name: 'search_documents',
    description: 'Semantic search across the hotel\'s uploaded documents (contracts, supplier specs, scanned invoices, transcribed calls). Returns the best-matching passages with the document title, page, and text. Use whenever the answer may be written in a document rather than the operational data — e.g. "what\'s the late-delivery penalty in the Premium Spirits contract", "what lead time did we agree with X", "does the agreement allow inter-property transfers", "what does the contract say about minimum order value". Always cite the document title and page in your answer when you use a passage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Natural-language question or phrase to search for in the documents' },
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
  {
    name: 'get_decision_calibration',
    description: 'Get a reliability report on whether an agent\'s stated confidence matches its real hit rate, using the operator\'s past decisions as ground truth (approved = the call was right, rejected or refined = it missed). Returns per-confidence-band accuracy, ECE, Brier score, and a verdict (well-calibrated / overconfident / underconfident / insufficient-data). Use for "is the restock advisor reliable", "can we trust the agent\'s confidence", "how calibrated are the agents", "should we raise the auto-approve threshold".',
    input_schema: {
      type: 'object' as const,
      properties: {
        agent_name:  { type: 'string', description: 'Optional — restrict to one agent (e.g. "restock_advisor"). Omit for all agents.' },
        window_days: { type: 'number', description: 'Optional lookback in days. Omit for all-time.' },
      },
      required: [],
    },
  },
  {
    name: 'get_monitor_config',
    description: 'Get the current detection monitors and their tunable triggers: expiry (days-before-expiry, min € at risk, auto-propose write-offs), stockout (days-until-zero surfacing band), waste (min anomaly score), supplier (max reliability score). Use for "what are my alert thresholds", "which monitors are on", "how is expiry detection configured".',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'tune_monitor',
    description: 'Change a detection monitor\'s tunable trigger — the operator owns these as data, no redeploy. Use for "alert me 10 days before expiry", "ignore expiring stock under €50", "surface stockouts 21 days out", "only flag suppliers below 4", "turn off waste alerts", "auto-propose write-offs". Requires admin/owner; the change is applied and audited. Only set the fields the operator mentions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        monitor:               { type: 'string', enum: ['expiry', 'stockout', 'waste', 'supplier'], description: 'Which monitor to tune' },
        enabled:               { type: 'boolean', description: 'Turn the monitor on/off' },
        threshold_days:        { type: 'number', description: 'expiry: fire within N days of expiry. stockout: surface within N days of zero stock.' },
        min_cost_at_risk:      { type: 'number', description: 'expiry only: ignore batches under this € at risk' },
        auto_propose:          { type: 'boolean', description: 'expiry only: auto-propose write-offs each unattended cycle' },
        min_anomaly_score:     { type: 'number', description: 'waste only: surface anomalies at/above this score (0–10)' },
        max_reliability_score: { type: 'number', description: 'supplier only: surface suppliers at/below this reliability score (0–10, lower is worse)' },
      },
      required: ['monitor'],
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

// ─── Scenario tools (H4) ──────────────────────────────────────────────────────
// Only sent to the model when the operator is looking at a scenario
// (selection.kind === 'scenario'). They edit + read the sandbox graph_overlay;
// they never touch real state. Running a fresh simulation stays the operator's
// "Simulate" button this release (server-side LLM-run sim is H5).
const SCENARIO_TOOLS: Anthropic.Tool[] = [
  {
    name: 'apply_overlay_edit',
    description:
      'Edit one value in the current scenario\'s graph_overlay (a sandbox — nothing touches real state). ' +
      'path is the list of keys into the overlay; common paths: ' +
      '["policy","auto_execution","thresholds","REQUEST_RESTOCK"] (0-1 confidence floor), ' +
      '["policy","overstock","factor"], ["policy","par","service_level"] (0-1), ' +
      '["policy","caps","max_variants_per_cycle"]. Pass value=null to clear an override (inherit org policy). ' +
      'After editing, tell the operator to click Simulate to see the effect, or ask if they want more changes first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path:  { type: 'array', items: { type: 'string' }, description: 'Keys into graph_overlay, e.g. ["policy","overstock","factor"]' },
        value: { description: 'New value at the path. Number for policy knobs; null to clear the override.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'query_simulation_result',
    description:
      'Read the cached most-recent simulation for the current scenario (scanned / proposed / auto-executed / queued). ' +
      'Use to summarize what the overlay would do before suggesting more edits. Returns nulls if it has never been simulated.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'simulate_scenario',
    description:
      'Run the intelligence cycle against the current scenario\'s overlay with no-op persistence (nothing touches ' +
      'real state) and return the result: scanned / proposed / auto-executed / queued. Use after applying overlay ' +
      'edits to see their effect immediately — you do NOT need the operator to click Simulate. The result is also ' +
      'cached, so a later query_simulation_result returns the same numbers.',
    input_schema: {
      type: 'object' as const,
      properties: {},
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
9. For anything that might be written in a document (contract terms, agreed lead times, penalties, policies, spec sheets), call search_documents. When you use a retrieved passage, cite it inline as (Document Title, p.N) and answer only from what the passages actually say — never invent contract terms.

RESPONSE FORMAT:
- Use markdown for structure (headers, bullets, bold for emphasis)
- For action proposals, include a JSON block marked with \`\`\`action that the UI will parse
- Keep responses under 300 words unless the user asks for detail`

// ─── Tool execution ─────────────────────────────────────────────────────────────

interface ToolInput {
  /** run_authored_tool: which authored tool to answer. */
  tool_api_name?: string
  args?: Record<string, unknown>
  window_days?: number
  days?: number
  forecast_days?: number
  lookback_days?: number
  variant_id?: string
  idle_days?: number
  query?: string
  status?: string
  agent_name?: string
  quantity?: number
  urgency?: string
  notes?: string
  action?: string
  reason?: string
  max_cost?: number
  supplier_id?: string
  // Monitor tuning (#5)
  monitor?: 'expiry' | 'stockout' | 'waste' | 'supplier'
  enabled?: boolean
  threshold_days?: number
  min_cost_at_risk?: number
  auto_propose?: boolean
  min_anomaly_score?: number
  max_reliability_score?: number
  // Scenario tools (H4)
  path?: string[]
  value?: unknown
  scenario_id?: string
}

/** Hard constraint violations a proposed action would incur, evaluated server-side
 *  with the same engine + { now } context as dispatch. Empty when compliant. */
function hardViolationsFor(
  actionType: string,
  params: Record<string, unknown>,
  hotelId: string | undefined,
  constraints: ConstraintRecordLite[],
): ConstraintViolationLite[] {
  if (!hotelId || constraints.length === 0) return []
  const action = copilotProposalToAction(actionType, params, hotelId)
  if (!action) return []
  const violations = evaluateConstraints(action, constraints, { now: new Date() }) as ConstraintViolationLite[]
  return violations.filter((v) => v.severity === 'hard')
}

/** A propose_* tool result that the model should NOT surface as-is. Returning the
 *  violation in the tool result makes the model self-correct within its normal
 *  loop — propose a compliant alternative or explain the limit (corrections #7,
 *  the corrective-turn half). The final annotateProposals stays as the UI backstop. */
function blockedProposalResult(actionType: string, params: Record<string, unknown>, hard: ConstraintViolationLite[]): string {
  return JSON.stringify({
    type: 'action_proposal',
    action: actionType,
    params,
    blocked: true,
    violations: hard,
    message:
      `This action is BLOCKED by a hard house rule (${hard.map((v) => v.body).join('; ')}: ` +
      `${hard.map((v) => v.message).join('; ')}). Do NOT propose it as-is. Propose a compliant ` +
      `alternative (e.g. within the limit / allowed window) or tell the operator why it can't be done.`,
  })
}

interface AuthoredToolRow {
  id: string
  name: string
  api_name: string
  description: string
  /** Exactly one is set: one type, or an interface (every implementer). */
  subject_type_id: string | null
  subject_interface_id: string | null
  parameters: { key: string; label: string; type: string; required: boolean }[]
  filters: { property: string; op: string; value: number | string | boolean; param?: string }[]
  aggregation: { fn: 'count' | 'sum' | 'avg' | 'min' | 'max'; property?: string }
}

/** Authored Logic Tools the caller can see (RLS scopes to their org). Capped so
 *  a large catalogue can't quietly inflate every request's token bill. */
async function fetchAuthoredTools(supabase: SupabaseClient): Promise<AuthoredToolRow[]> {
  const { data, error } = await supabase
    .from('user_tools')
    .select('id, name, api_name, description, subject_type_id, subject_interface_id, parameters, filters, aggregation')
    .eq('enabled', true)
    .order('created_at', { ascending: true })
    .limit(25) as unknown as { data: AuthoredToolRow[] | null; error: { message: string } | null }
  if (error || !data) return []
  return data
}

/** ONE tool slot for the whole catalogue, with the api names as an enum, rather
 *  than one Anthropic tool per authored tool — the enum gives the model exact
 *  valid choices while keeping the tool list bounded as orgs author more. */
function authoredToolDescriptor(tools: AuthoredToolRow[]): Anthropic.Tool | null {
  if (tools.length === 0) return null
  const catalogue = tools.map((t) => `${t.api_name}: ${t.description || t.name}`).join('\n')
  return {
    name: 'run_authored_tool',
    description:
      'Answer a Logic Tool this organization authored over its own ontology. Each returns a ' +
      'number with the basis it was computed from and a confidence. Available tools:\n' + catalogue,
    input_schema: {
      type: 'object',
      properties: {
        tool_api_name: { type: 'string', enum: tools.map((t) => t.api_name), description: 'Which authored tool to run' },
        args: { type: 'object', description: 'Arguments for the declared parameters of that tool, keyed by parameter name' },
      },
      required: ['tool_api_name'],
    },
  }
}

async function executeTool(
  supabase: SupabaseClient,
  toolName: string,
  input: ToolInput,
  selection: SelectionContext | undefined,
  hotelId: string | undefined,
  constraints: ConstraintRecordLite[],
  authHeader: string,
  authoredTools: AuthoredToolRow[] = [],
): Promise<string> {
  try {
    switch (toolName) {
      case 'run_authored_tool': {
        const def = authoredTools.find((t) => t.api_name === input.tool_api_name)
        if (!def) return JSON.stringify({ error: `no authored tool named ${String(input.tool_api_name)}` })

        // An interface tool runs over every implementer, so resolve the target
        // types first — reading only subject_type_id would answer a confident
        // zero for them.
        let typeIds: string[] = def.subject_type_id ? [def.subject_type_id] : []
        if (def.subject_interface_id) {
          const { data: impls } = await supabase
            .from('object_type_interfaces').select('object_type_id')
            .eq('interface_id', def.subject_interface_id) as unknown as
            { data: { object_type_id: string }[] | null }
          typeIds = (impls ?? []).map((i) => i.object_type_id)
        }
        if (typeIds.length === 0) {
          return JSON.stringify({
            tool: def.api_name, value: 0, confidence: 0,
            basis: 'no object type currently implements this interface',
          })
        }

        // Fetch the subject types alongside their records so computed properties
        // resolve — the same read the Studio surface does.
        const [{ data: typeRows }, { data: records }] = await Promise.all([
          supabase.from('object_types').select('*').in('id', typeIds),
          supabase.from('object_records').select('object_type_id, data').in('object_type_id', typeIds).limit(1000),
        ]) as unknown as [
          { data: Record<string, unknown>[] | null },
          { data: { object_type_id: string; data: Record<string, unknown> }[] | null },
        ]

        const groups = (typeRows ?? []).map((typeRow) => ({
          type: {
            id: String(typeRow.id), organizationId: String(typeRow.organization_id),
            hotelId: (typeRow.hotel_id as string | null),
            apiName: String(typeRow.api_name), label: String(typeRow.label),
            icon: String(typeRow.icon), description: String(typeRow.description),
            properties: typeRow.properties, computedProperties: typeRow.computed_properties ?? [],
            viewConfig: typeRow.view_config, enabled: true, version: 1,
          },
          records: (records ?? []).filter((r) => r.object_type_id === typeRow.id).map((r) => r.data),
        }))

        // A tool with parameters is answered with the caller's arguments; a
        // missing required one is an error, never the authored fallback.
        const bound = bindToolArgs(
          { filters: def.filters, parameters: def.parameters ?? [] },
          (input.args ?? {}) as Record<string, unknown>,
        )
        if (bound.errors.length > 0) return JSON.stringify({ error: bound.errors.join('; ') })

        const result = evaluateUserToolAcross({ filters: bound.filters, aggregation: def.aggregation }, groups)
        return JSON.stringify({ tool: def.api_name, question: def.description || def.name, ...result })
      }
      case 'get_decision_calibration': {
        // Reliability of an agent's confidence, scored against the operator's
        // own resolved proposals. RLS already scopes rows to the caller; we
        // also pin the hotel so org users get their property, not the network.
        let q = supabase
          .from('proposals')
          .select('confidence, status, decided_at, edited_before_approval')
          .neq('status', 'pending')
          .limit(5000)
        if (hotelId) q = q.eq('hotel_id', hotelId)
        if (input.agent_name) q = q.eq('agent_name', input.agent_name)
        if (typeof input.window_days === 'number') {
          q = q.gte('created_at', new Date(Date.now() - input.window_days * 86_400_000).toISOString())
        }
        const { data, error } = await q as unknown as {
          data: { confidence: number; status: string; decided_at: string | null; edited_before_approval: boolean | null }[] | null
          error: { message: string } | null
        }
        if (error) return JSON.stringify({ error: error.message })
        const samples = (data ?? []).map((r) => ({ confidence: Number(r.confidence), status: r.status, decidedAt: r.decided_at, edited: r.edited_before_approval === true }))
        // Score with the org's calibration policy so the copilot quotes the same
        // numbers the operator sees on the Studio page.
        const { data: calPol } = await supabase.rpc('get_org_policy')
        return JSON.stringify(computeCalibration(samples, orgPolicyToCalibrationOptions(mergeOrgPolicy(calPol))))
      }
      case 'apply_overlay_edit': {
        const scenarioId = input.scenario_id ?? selection?.id
        if (!scenarioId) return JSON.stringify({ error: 'no scenario in context' })
        if (!Array.isArray(input.path) || input.path.length === 0) {
          return JSON.stringify({ error: 'path (array of keys) is required' })
        }
        const { data, error } = await supabase.rpc('apply_overlay_edit', {
          p_scenario_id: scenarioId,
          p_path:        input.path,
          p_value:       input.value ?? null,
          p_source:      'llm',
        })
        if (error) return JSON.stringify({ error: error.message })
        const row = data as { graph_overlay?: unknown } | null
        return JSON.stringify({ ok: true, appliedPath: input.path, graphOverlay: row?.graph_overlay ?? {} })
      }
      case 'simulate_scenario': {
        const scenarioId = input.scenario_id ?? selection?.id
        if (!scenarioId) return JSON.stringify({ error: 'no scenario in context' })
        try {
          const summary = await runScenarioSimulation(supabase, scenarioId)
          return JSON.stringify({ ok: true, ...summary })
        } catch (err) {
          return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
        }
      }
      case 'query_simulation_result': {
        const scenarioId = input.scenario_id ?? selection?.id
        if (!scenarioId) return JSON.stringify({ error: 'no scenario in context' })
        const { data, error } = await supabase
          .from('scenarios')
          .select('last_simulation, last_simulated_at')
          .eq('id', scenarioId)
          .maybeSingle() as unknown as {
            data: { last_simulation: { result?: Record<string, number> } | null; last_simulated_at: string | null } | null
            error: { message: string } | null
          }
        if (error) return JSON.stringify({ error: error.message })
        const sim = data?.last_simulation
        if (!sim?.result) return JSON.stringify({ simulated: false, message: 'never simulated — ask the operator to click Simulate' })
        return JSON.stringify({
          simulated:    true,
          ranAt:        data?.last_simulated_at,
          scanned:      sim.result.scanned,
          proposed:     sim.result.proposed,
          autoExecuted: sim.result.autoExecuted,
          queued:       sim.result.queued,
        })
      }
      case 'get_monitor_config': {
        const { data, error } = await supabase.rpc('get_org_policy')
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify(mergeOrgPolicy(data).monitors)
      }
      case 'tune_monitor': {
        const monitor = input.monitor
        if (!monitor) return JSON.stringify({ error: 'monitor is required (expiry | stockout | waste | supplier)' })
        const { data: polData, error: getErr } = await supabase.rpc('get_org_policy')
        if (getErr) return JSON.stringify({ error: getErr.message })
        const policy = mergeOrgPolicy(polData)
        const m = policy.monitors[monitor] as Record<string, unknown>
        if (typeof input.enabled === 'boolean') m.enabled = input.enabled
        if (monitor === 'expiry') {
          if (typeof input.threshold_days   === 'number') m.threshold_days   = input.threshold_days
          if (typeof input.min_cost_at_risk === 'number') m.min_cost_at_risk = input.min_cost_at_risk
          if (typeof input.auto_propose     === 'boolean') m.auto_propose    = input.auto_propose
        } else if (monitor === 'stockout') {
          if (typeof input.threshold_days === 'number') m.threshold_days = input.threshold_days
        } else if (monitor === 'waste') {
          if (typeof input.min_anomaly_score === 'number') m.min_anomaly_score = input.min_anomaly_score
        } else if (monitor === 'supplier') {
          if (typeof input.max_reliability_score === 'number') m.max_reliability_score = input.max_reliability_score
        }
        // Re-merge to clamp the operator's values into range before persisting.
        const clamped = mergeOrgPolicy(policy)
        const { error: setErr } = await supabase.rpc('set_org_policy', { p_policy: clamped })
        if (setErr) return JSON.stringify({ error: setErr.message, hint: 'tuning a monitor requires admin or owner' })
        return JSON.stringify({ ok: true, monitor, config: clamped.monitors[monitor] })
      }
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
      case 'search_documents': {
        // Foundry Ontology-Augmented Generation: embed the question, semantic
        // search over chunk summaries, hand the passages back for a cited answer.
        if (!hotelId) return JSON.stringify({ error: 'no hotel in context' })
        if (typeof input.query !== 'string' || input.query.trim().length < 2) {
          return JSON.stringify({ error: 'query is required' })
        }
        const embedResp = await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/embed-text`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
          body:    JSON.stringify({ texts: [input.query] }),
        })
        if (!embedResp.ok) {
          return JSON.stringify({ error: `document search unavailable (embed failed ${String(embedResp.status)})` })
        }
        const { embeddings } = await embedResp.json() as { embeddings: number[][] }
        const queryVec = embeddings[0]
        if (!queryVec) return JSON.stringify({ error: 'query could not be embedded' })

        const { data, error } = await supabase.rpc('match_document_chunks', {
          p_hotel_id:  hotelId,
          p_query:     `[${queryVec.join(',')}]`,
          p_threshold: 0.35,
          p_limit:     8,
        }) as unknown as {
          data: Array<{ document_id: string; document_title: string; page: number; summary: string | null; text_full: string | null; text_preview: string; similarity: number }> | null
          error: { message: string } | null
        }
        if (error) return JSON.stringify({ error: error.message })
        const passages = (data ?? []).map((m) => ({
          document:   m.document_title,
          documentId: m.document_id,
          page:       m.page,
          similarity: Number(m.similarity.toFixed(3)),
          summary:    m.summary ?? undefined,
          text:       m.text_full ?? m.text_preview,
        }))
        return JSON.stringify({
          passages,
          count: passages.length,
          note: passages.length === 0
            ? 'No matching document passages. Say so — do not invent document contents.'
            : 'Answer only from these passages; cite each as (document, p.page).',
        })
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
        // Don't execute — return a structured proposal for the UI to render.
        const params = {
          variant_id: input.variant_id,
          quantity: input.quantity,
          urgency: input.urgency ?? 'medium',
          notes: input.notes ?? '',
        }
        const hard = hardViolationsFor('REQUEST_RESTOCK', params, hotelId, constraints)
        if (hard.length > 0) return blockedProposalResult('REQUEST_RESTOCK', params, hard)
        return JSON.stringify({
          type: 'action_proposal',
          action: 'REQUEST_RESTOCK',
          params,
          message: 'Restock proposal ready for confirmation.',
        })
      }
      case 'propose_stock_adjustment': {
        const actionType = input.action === 'subtract' ? 'WRITE_OFF' : 'ADJUST_STOCK'
        const params = {
          variant_id: input.variant_id,
          action: input.action,
          quantity: input.quantity,
          reason: input.reason,
        }
        const hard = hardViolationsFor(actionType, params, hotelId, constraints)
        if (hard.length > 0) return blockedProposalResult(actionType, params, hard)
        return JSON.stringify({
          type: 'action_proposal',
          action: actionType,
          params,
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
        // A5: the batch path was the one propose_* tool that skipped the
        // constraint engine — precisely where spend/time-window rules bite.
        // Evaluate each request as its own APPROVE_RESTOCK; hard violations
        // drop out of the batch with the reason surfaced to the model.
        type BatchRow = { id: string; variant_id: string | null; estimated_cost: number | null }
        // Shared, behavior-eval'd logic (reality-graph evaluateBatchApprovals) —
        // the fn stays a thin adapter over the graded implementation.
        const { eligible, blocked } = evaluateBatchApprovals(
          (data ?? []) as BatchRow[], constraints, hotelId ?? '', new Date(),
        ) as { eligible: BatchRow[]; blocked: { row: BatchRow; violations: ConstraintViolationLite[] }[] }
        if (eligible.length === 0 && blocked.length > 0) {
          return JSON.stringify({
            type: 'action_proposal', action: 'BATCH_APPROVE', params: { request_ids: [] }, blocked: true,
            violations: blocked.flatMap((b) => b.violations),
            message: 'Every eligible request is BLOCKED by a hard house rule. Do NOT propose the batch; explain the limit to the operator.',
          })
        }
        return JSON.stringify({
          type: 'action_proposal',
          action: 'BATCH_APPROVE',
          params: {
            request_ids: eligible.map((r) => r.id),
            max_cost: input.max_cost,
          },
          requests: eligible,
          excluded: blocked.length > 0
            ? blocked.map((b) => ({ request_id: b.row.id, violations: b.violations.map((v) => v.message) }))
            : undefined,
          message: `${eligible.length} requests eligible for batch approval` +
            (blocked.length > 0 ? ` (${blocked.length} excluded by hard house rules — tell the operator why).` : '.'),
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

// ── Tier-1 curated answers (5.1) ─────────────────────────────────────────────

interface CuratedAnswer { id: string; question: string; answer: string }

/** ts_rank floor for serving a curated answer instead of the model. Ranks on a
 *  question+answer tsvector land around 0.05–0.1 for a real match; below this a
 *  hit is a shared word rather than the same question. */
const CURATED_MIN_RANK = 0.05

const lastUserContent = (msgs: { role: string; content: string }[]): string =>
  [...msgs].reverse().find((m) => m.role === 'user')?.content ?? ''

/** The top curated answer, but only when it is unambiguously the answer.
 *  Returns null on a weak match, or when a second answer scores close enough
 *  that picking one would be a guess — the model handles those. */
async function findCuratedAnswer(supabase: SupabaseClient, question: string): Promise<CuratedAnswer | null> {
  if (question.trim().length < 4) return null
  const { data, error } = await supabase.rpc('help_search', { p_query: question, p_limit: 3 }) as unknown as {
    data: { id: string; question: string; answer: string; rank: number }[] | null
    error: { message: string } | null
  }
  if (error || !data || data.length === 0) return null

  const [top, second] = data
  if (!top || Number(top.rank) < CURATED_MIN_RANK) return null
  // Ambiguous: two curated answers this close means the question matches a
  // topic, not an entry. Answering with either would be a coin flip.
  if (second && Number(second.rank) > Number(top.rank) * 0.8) return null
  return { id: top.id, question: top.question, answer: top.answer }
}

/** Persist a user+assistant pair. Shared with the model path so a curated turn
 *  appears in history identically — the operator should be able to scroll back
 *  without the answer's origin changing its shape. */
async function persistTurn(
  supabase: SupabaseClient, conversationId: string | null,
  userContent: string, assistantContent: string, model: string,
): Promise<void> {
  if (!conversationId || !userContent) return
  const { error } = await supabase.from('copilot_messages').insert([
    { conversation_id: conversationId, role: 'user', content: userContent, tool_trace: [], iterations: 0, model: null, action_proposal: null },
    { conversation_id: conversationId, role: 'assistant', content: assistantContent, tool_trace: [], iterations: 0, model, action_proposal: null },
  ]) as unknown as { error: { message: string } | null }
  if (error) console.warn('[copilot-chat] persistence failed:', error.message)
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

/** Fetches the active Principles + Constraints for the hotel and renders them
 *  as a prompt section. Principles are soft guidance the copilot weighs and
 *  cites; Constraints are hard rules it must never propose around — the same
 *  rules the agents obey and the Action Registry enforces at submission.
 *  Returns '' when there are none (no section added). */
async function fetchHouseRules(supabase: SupabaseClient, hotelId: string): Promise<string> {
  const [principlesRes, constraintsRes] = await Promise.all([
    supabase.from('principles')
      .select('body, category')
      .eq('hotel_id', hotelId).eq('active', true)
      .order('created_at', { ascending: true }).limit(40),
    supabase.from('constraints')
      .select('body, bucket, severity')
      .eq('hotel_id', hotelId).eq('active', true)
      .order('created_at', { ascending: true }).limit(40),
  ]) as unknown as [
    { data: { body: string; category: string }[] | null },
    { data: { body: string; bucket: string; severity: string }[] | null },
  ]

  const principles  = principlesRes.data ?? []
  const constraints = constraintsRes.data ?? []
  if (principles.length === 0 && constraints.length === 0) return ''

  let section = `

HOUSE RULES (the operator's standing instructions — they bind you exactly as they bind the automated agents):`

  if (principles.length > 0) {
    section += `

Principles (soft guidance — weigh these in every answer and proposal; when you follow one, say so):
${principles.map((p) => `- ${p.body}${p.category ? `  [${p.category}]` : ''}`).join('\n')}`
  }
  if (constraints.length > 0) {
    section += `

Constraints (HARD rules — never propose an action that would violate one. If the operator asks for something that would, refuse, name the constraint that blocks it, and offer a compliant alternative):
${constraints.map((c) => `- ${c.body}  (${c.bucket}${c.severity ? `/${c.severity}` : ''})`).join('\n')}`
  }
  return section
}

function buildSystemPrompt(selection?: SelectionContext, houseRules?: string): string {
  let prompt = SYSTEM_PROMPT
  if (houseRules) prompt += houseRules
  if (!selection) return prompt
  prompt += `

CURRENT VIEW:
The operator is currently looking at a ${selection.kind} (id: \`${selection.id}\`)${selection.label ? ` — "${selection.label}"` : ''}. When a tool input or proposal field needs a ${selection.kind} id and the operator hasn't named a different one, default to this id. When the operator's question is vague ("forecast this?", "is this OK?"), assume it refers to the current ${selection.kind} unless they say otherwise.`

  if (selection.kind === 'scenario') {
    prompt += `

SCENARIO SANDBOX:
This is a what-if sandbox — a graph_overlay merged over real state at simulation time. Nothing you do here touches production.
- Translate the operator's intent into apply_overlay_edit calls (e.g. "tighten restock to 0.95" → path ["policy","auto_execution","thresholds","REQUEST_RESTOCK"], value 0.95). The scenario id is the current selection — you don't need to ask for it.
- To clear an override and inherit org policy, call apply_overlay_edit with value null.
- After editing, call simulate_scenario to run the cycle against the overlay yourself (no-op persistence — nothing touches real state), then summarize the result: scanned / proposed / auto-executed / queued.
- Don't guess the numbers — run simulate_scenario and report what it returns. Use query_simulation_result to recall the last run without re-simulating.`
  }
  return prompt
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
  /** Suggest-time constraint check (corrections #7). Absent/empty = clean. */
  violations?: ConstraintViolationLite[]
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

// ─── Suggest-time constraint enforcement (corrections #7) ─────────────────────
// The house-rules prompt section tells the LLM not to propose constraint-violating
// actions, but that's advisory — if it does anyway, nothing caught it until the
// operator hit Apply (dispatch). Here we run the SAME constraint engine the
// Action Registry uses, server-side, on each proposed action, and attach the
// violations to the proposal so the UI can block (hard) or warn (soft) at
// suggest-time. There is no second gate — this is the dispatch gate, earlier.

interface ConstraintViolationLite {
  constraintId: string
  body: string
  severity: 'hard' | 'soft'
  bucket: string
  message: string
}

interface ConstraintRecordLite {
  id: string
  body: string
  bucket: string
  typedRule: unknown
  severity: 'hard' | 'soft'
  appliesToActionTypes: string[]
  active: boolean
}

async function loadConstraintRecords(supabase: SupabaseClient, hotelId: string): Promise<ConstraintRecordLite[]> {
  const { data, error } = await supabase
    .from('constraints')
    .select('id, body, bucket, severity, applies_to_action_types, typed_rule, active')
    .eq('hotel_id', hotelId)
    .eq('active', true) as unknown as {
      data: {
        id: string; body: string; bucket: string; severity: 'hard' | 'soft'
        applies_to_action_types: string[] | null; typed_rule: unknown; active: boolean
      }[] | null
      error: { message: string } | null
    }
  if (error || !data) return []
  return data.map((r) => ({
    id: r.id, body: r.body, bucket: r.bucket, typedRule: r.typed_rule,
    severity: r.severity, appliesToActionTypes: r.applies_to_action_types ?? [], active: r.active,
  }))
}

/** Attaches constraint violations to each proposal. Maps the proposal to a typed
 *  action via the shared reality-graph mapper, then evaluates with the same engine
 *  + { now }-only context as dispatchAction so suggest-time and dispatch verdicts
 *  agree. */
function annotateProposals(
  proposals: ParsedActionProposal[],
  records: ConstraintRecordLite[],
  hotelId: string | undefined,
): ParsedActionProposal[] {
  if (records.length === 0 || !hotelId) return proposals
  const now = new Date()
  return proposals.map((p) => {
    const action = copilotProposalToAction(p.action, p.params, hotelId)
    if (!action) return p
    const violations = evaluateConstraints(action, records, { now }) as ConstraintViolationLite[]
    return violations.length > 0 ? { ...p, violations } : p
  })
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
    // Forwarded to embed-text for document search (same authenticated user).
    const authHeader = req.headers.get('Authorization') ?? ''

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
    const callerHotelId = callerProfile?.hotel_id ?? undefined
    let disabledTools: string[] = []
    if (callerHotelId) {
      const { data: config } = await supabase
        .from('copilot_tool_configs')
        .select('disabled_tools')
        .eq('hotel_id', callerHotelId)
        .maybeSingle() as unknown as { data: { disabled_tools: string[] | null } | null }
      disabledTools = config?.disabled_tools ?? []
    }

    // ── House rules (Mind flywheel) ──────────────────────────────────────────
    // The same Principles + Constraints the automated agents obey, injected so
    // the copilot advises and proposes within them — instead of suggesting an
    // action the Action Registry would later reject at submission.
    const houseRules = callerHotelId ? await fetchHouseRules(supabase, callerHotelId) : ''
    // Typed constraint records for suggest-time enforcement (#7) — the same rules
    // dispatchAction evaluates, loaded once and reused to annotate every proposal.
    const constraintRecords = callerHotelId ? await loadConstraintRecords(supabase, callerHotelId) : []
    // P4.2 — authored Logic Tools are callable by the copilot, not just by the
    // operator in Studio. Same definition, same interpreter, one contract.
    const authoredTools = await fetchAuthoredTools(supabase)
    const authoredDescriptor = authoredToolDescriptor(authoredTools)
    const registeredTools = authoredDescriptor ? [...TOOLS, authoredDescriptor] : TOOLS
    const baseTools = disabledTools.length === 0
      ? registeredTools
      : registeredTools.filter((t) => !disabledTools.includes(t.name))
    // H4: surface the scenario overlay tools only when the operator is looking
    // at a scenario — keeps the global tool list lean everywhere else.
    const allowedTools = body.selection?.kind === 'scenario'
      ? [...baseTools, ...SCENARIO_TOOLS]
      : baseTools

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

    // ── Tier-1: a curated answer beats a fresh LLM call ──────────────────
    // ApprovedAnswer exists to be served BEFORE spending a model call. Three
    // curated answers sat at hit_count = 0 because nothing consulted them.
    // Only a confident single match short-circuits: an operator asking
    // something adjacent must still reach the model, so a weak or ambiguous
    // match falls through rather than answering approximately.
    const curated = await findCuratedAnswer(supabase, lastUserContent(body.messages))
    if (curated) {
      await persistTurn(supabase, conversationId, lastUserContent(body.messages), curated.answer, 'approved_answer')
      // Served, not merely found — that distinction is the whole point of
      // record_answer_served being its own function.
      const { error: hitErr } = await supabase.rpc('record_answer_served', { p_answer_id: curated.id })
      if (hitErr) console.warn('[copilot-chat] record_answer_served failed:', hitErr.message)

      const payload = {
        response:         curated.answer,
        tool_trace:       [{ tool: 'approved_answer', input: { question: curated.question }, duration_ms: 0 }],
        model:            'approved_answer',
        iterations:       0,
        conversation_id:  conversationId,
        action_proposals: [],
      }
      if ((req.headers.get('accept') ?? '').includes('text/event-stream')) {
        const enc = new TextEncoder()
        return new Response(new ReadableStream({
          start(controller) {
            const send = (e: object) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`))
            send({ type: 'conversation_id', conversation_id: conversationId })
            send({ type: 'text_delta', delta: curated.answer })
            send({ type: 'done', ...payload })
            controller.close()
          },
        }), { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
      }
      return json(payload)
    }

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
                system:     buildSystemPrompt(body.selection, houseRules),
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
                const result   = await executeTool(supabase, tu.name, tu.input as ToolInput, body.selection, callerHotelId, constraintRecords, authHeader, authoredTools)
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

            const actionProposals = annotateProposals(extractActionProposals(finalResponse), constraintRecords, callerHotelId)
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
      system: buildSystemPrompt(body.selection, houseRules),
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
        const result = await executeTool(supabase, toolUse.name, toolUse.input as ToolInput, body.selection, callerHotelId, constraintRecords, authHeader, authoredTools)
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
        system: buildSystemPrompt(body.selection, houseRules),
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
    const actionProposals = annotateProposals(extractActionProposals(finalResponse), constraintRecords, callerHotelId)
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
