// Layer: Eye — Copilot with Tool-Calling + Reasoning Trace (Sprint 29)
//
// Palantir architecture pattern: the LLM never queries the graph directly.
// It calls typed named tools and gets back an object set. The reasoning trace
// is shown to the operator — not hidden. This IS the product (Principle 10).
//
// Implementation: deterministic routing (keyword → tool) over pre-fetched
// Eye Layer data. Each "tool call" runs against cached TanStack Query data.
// The LLM layer can be swapped in via a Supabase edge function later without
// changing the UI contract.
//
// Tools available:
//   getActiveIncidents      → cross-domain incident engine
//   getWasteAnomalies       → waste radar
//   getPredictiveRestockQueue → consumption forecast + lead time
//   getSupplierReliability  → delivery performance scorecard

import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain, Loader2, AlertTriangle, TrendingDown, Truck,
  Radar, ChevronRight, Zap, CheckCircle2, Send, RotateCcw, GitBranch,
  ThumbsUp, ThumbsDown, MessageSquare, Cpu,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useActiveIncidents, useWasteRadar, useSupplierReliability } from '@/features/eye/hooks'
import { useConsumptionForecast, computePredictiveRestocks } from '@/features/eye/hooks'
import { CopilotChatView as ExtractedChatView } from '@/features/eye/components/CopilotChatView'
import { useProducts } from '@/features/inventory/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useRestockRequests } from '@/features/restock/hooks'
import { useHotelEdges } from '@/hooks/useHotelEdges'
import { traverseGraph } from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import type { ActiveIncidentRow, WasteRadarRow, SupplierReliabilityRow } from '@beacon/types'
import type { PredictiveRestockRow } from '@/features/eye/hooks'
import type { EdgeRecord } from '@beacon/reality-graph'

// ─── Tool definitions ─────────────────────────────────────────────────────────

interface ToolDef {
  id:          string
  name:        string
  description: string   // shown in trace
  triggers:    string[] // keyword → route
  icon:        React.ElementType
}

const TOOLS: ToolDef[] = [
  {
    id:          'incidents',
    name:        'getActiveIncidents',
    description: 'Scanning cross-domain incident signals (waste · team · supply · occupancy)…',
    triggers:    ['urgent', 'critical', 'incident', 'problem', 'issue', 'today', 'now',
                  'attention', 'alert', 'situation', 'what', 'briefing', 'summary'],
    icon:        AlertTriangle,
  },
  {
    id:          'restock',
    name:        'getPredictiveRestockQueue',
    description: 'Computing predictive restock queue from burn rate + lead time…',
    triggers:    ['restock', 'order', 'stock', 'low', 'empty', 'buy', 'purchase', 'out',
                  'run', 'need', 'supply', 'replenish'],
    icon:        TrendingDown,
  },
  {
    id:          'waste',
    name:        'getWasteAnomalies',
    description: 'Analysing waste radar — comparing 7d write-offs vs 4-week baseline…',
    triggers:    ['waste', 'write', 'spoil', 'theft', 'breakage', 'loss', 'anomaly',
                  'write-off', 'broken', 'expired', 'discard'],
    icon:        Radar,
  },
  {
    id:          'suppliers',
    name:        'getSupplierReliability',
    description: 'Scoring supplier delivery performance (on-time rate · delay · cost variance)…',
    triggers:    ['supplier', 'deliver', 'late', 'overdue', 'vendor', 'po',
                  'contract', 'reliable', 'delay', 'shipment'],
    icon:        Truck,
  },
]

// ─── Routing ──────────────────────────────────────────────────────────────────

function routeQuery(query: string): ToolDef[] {
  const lower = query.toLowerCase()
  const matched = TOOLS.filter((t) => t.triggers.some((kw) => lower.includes(kw)))
  // If nothing matched or query is very short, run all tools (full briefing)
  return matched.length > 0 ? matched : TOOLS
}

// ─── Result synthesizers ──────────────────────────────────────────────────────

function synthesizeIncidents(rows: ActiveIncidentRow[]): string {
  if (rows.length === 0) return 'No active incidents detected across all domains.'
  const critical = rows.filter((r) => r.incident_severity === 'critical')
  const elevated = rows.filter((r) => r.incident_severity === 'elevated')
  const multiDomain = rows.filter((r) => r.correlation_count >= 2)
  const parts: string[] = []
  if (critical.length > 0) {
    parts.push(`${String(critical.length)} critical incident${critical.length > 1 ? 's' : ''} require immediate attention.`)
    parts.push(`Most urgent: ${critical[0].variant_label} — ${critical[0].primary_signal}`)
  } else if (elevated.length > 0) {
    parts.push(`${String(elevated.length)} elevated incident${elevated.length > 1 ? 's' : ''} need monitoring.`)
  }
  if (multiDomain.length > 0) {
    parts.push(`${String(multiDomain.length)} incident${multiDomain.length > 1 ? 's' : ''} span multiple domains (waste + supply or team).`)
  }
  if (parts.length === 0) {
    parts.push(`${String(rows.length)} watch-level incident${rows.length > 1 ? 's' : ''} detected — no immediate action required.`)
  }
  return parts.join(' ')
}

function synthesizeRestock(rows: PredictiveRestockRow[]): string {
  if (rows.length === 0) return 'No items need ordering in the next 14 days. All stock levels are healthy through lead time.'
  const critical = rows.filter((r) => r.urgency === 'critical')
  const warning  = rows.filter((r) => r.urgency === 'warning')
  const parts: string[] = []
  if (critical.length > 0) {
    parts.push(`${String(critical.length)} item${critical.length > 1 ? 's' : ''} must be ordered today — order window is closing.`)
    const top = critical[0]
    const label = top.variantName !== 'Standard' ? `${top.productName} — ${top.variantName}` : top.productName
    parts.push(`Most critical: ${label} · ${String(top.daysUntilZero)}d left · stockout ${format(top.stockoutDate, 'MMM d')}.`)
  }
  if (warning.length > 0) {
    parts.push(`${String(warning.length)} item${warning.length > 1 ? 's' : ''} should be ordered within 1–3 days.`)
  }
  return parts.join(' ')
}

function synthesizeWaste(rows: WasteRadarRow[], currency: string): string {
  if (rows.length === 0) return 'No waste anomalies detected. All write-off categories are within their 4-week baseline.'
  const critical = rows.filter((r) => r.anomaly_score >= 8)
  const theft    = rows.filter((r) => r.occupancy_band === 'low' && r.theft_qty > 0)
  const totalCost = rows.reduce((s, r) => s + r.waste_cost_7d, 0)
  const parts: string[] = []
  if (critical.length > 0) {
    parts.push(`${String(critical.length)} critical anomal${critical.length > 1 ? 'ies' : 'y'} (score ≥8) detected.`)
    parts.push(`Highest: ${rows[0].variant_label} · score ${String(rows[0].anomaly_score)}/10 · +${String(rows[0].pct_above_baseline)}% above baseline.`)
  } else {
    parts.push(`${String(rows.length)} anomal${rows.length > 1 ? 'ies' : 'y'} above 50% baseline threshold.`)
  }
  if (theft.length > 0) {
    parts.push(`${String(theft.length)} probable theft signal${theft.length > 1 ? 's' : ''} (low occupancy + theft category).`)
  }
  if (totalCost > 0) {
    parts.push(`Total cost at risk this week: ${formatCurrency(totalCost, currency)}.`)
  }
  return parts.join(' ')
}

function synthesizeSuppliers(rows: SupplierReliabilityRow[]): string {
  if (rows.length === 0) return 'No supplier delivery history available in the analysis window. Receive orders to build history.'
  const critical = rows.filter((r) => r.risk_tier === 'critical')
  const high     = rows.filter((r) => r.risk_tier === 'high')
  const reliable = rows.filter((r) => r.risk_tier === 'low')
  const avgOT    = rows.reduce((s, r) => s + r.on_time_pct, 0) / rows.length
  const parts: string[] = []
  if (critical.length > 0) {
    parts.push(`${String(critical.length)} supplier${critical.length > 1 ? 's' : ''} are critically unreliable — renegotiate contracts.`)
    parts.push(`Worst: ${rows[0].supplier_name} · score ${String(rows[0].reliability_score)}/10 · ${rows[0].on_time_pct.toFixed(0)}% on-time.`)
  } else if (high.length > 0) {
    parts.push(`${String(high.length)} supplier${high.length > 1 ? 's' : ''} are high risk.`)
  } else {
    parts.push(`Supplier fleet looks healthy. ${String(reliable.length)} reliable supplier${reliable.length > 1 ? 's' : ''}.`)
  }
  parts.push(`Fleet average on-time rate: ${avgOT.toFixed(1)}%.`)
  return parts.join(' ')
}

// ─── Graph traversal helpers ──────────────────────────────────────────────────
//
// These run synchronously against the pre-fetched hotel edge corpus.
// Each helper answers: "what else in the graph is connected to this node?"

interface GraphInsight {
  /** Human-readable cross-domain finding, injected into synthesis */
  sentence: string
  /** Optional direct nav chip to the implicated node */
  nav?: { label: string; path: string }
}

/**
 * For a variant node, follow: variant →restocks→ restock_request →linked_to_po→
 * purchase_order →sourced_from→ supplier, then cross-reference supplier
 * reliability to surface a supplier-risk insight.
 */
function supplierInsightForVariant(
  variantId: string,
  variantLabel: string,
  hotelEdges: EdgeRecord[],
  suppRows: SupplierReliabilityRow[],
): GraphInsight | null {
  const nodes = traverseGraph(hotelEdges, variantId, 'variant', {
    maxDepth: 3,
    edgeFilter: ['restocks', 'linked_to_po', 'sourced_from'],
    direction: 'out',
  })

  const supplierNodes = nodes.filter((n) => n.nodeType === 'supplier')
  if (supplierNodes.length === 0) return null

  // Cross-reference with reliability scores
  for (const sn of supplierNodes) {
    const row = suppRows.find((r) => r.supplier_id === sn.nodeId)
    if (!row) continue
    if (row.risk_tier === 'critical' || row.risk_tier === 'high') {
      return {
        sentence: `Graph trace: ${variantLabel} is sourced via ${row.supplier_name} (${row.risk_tier} reliability, ${row.on_time_pct.toFixed(0)}% on-time) — supply chain risk compounds this incident.`,
        nav: { label: `${row.supplier_name} →`, path: `/supplier/${row.supplier_id ?? ''}` },
      }
    }
  }
  return null
}

/**
 * For a variant, check if there's already an open restock_request linked to a PO.
 * Returns the count of linked PO nodes found via traversal.
 */
function linkedPOCount(variantId: string, hotelEdges: EdgeRecord[]): number {
  const nodes = traverseGraph(hotelEdges, variantId, 'variant', {
    maxDepth: 2,
    edgeFilter: ['restocks', 'linked_to_po'],
    direction: 'out',
  })
  return nodes.filter((n) => n.nodeType === 'purchase_order').length
}

/**
 * For a supplier node, count how many variants depend on it via reverse
 * sourced_from traversal. A high count = high blast radius if supplier fails.
 */
function variantDependencyCount(supplierId: string, hotelEdges: EdgeRecord[]): number {
  const nodes = traverseGraph(hotelEdges, supplierId, 'supplier', {
    maxDepth: 3,
    edgeFilter: ['sourced_from', 'linked_to_po', 'restocks'],
    direction: 'in',
  })
  return nodes.filter((n) => n.nodeType === 'variant').length
}

// ─── Trace step component ─────────────────────────────────────────────────────

type TraceStep =
  | { type: 'pending';  tool: ToolDef }
  | { type: 'running';  tool: ToolDef }
  | { type: 'done';     tool: ToolDef; resultLine: string; graphHops?: number }

function TraceStepRow({ step }: { step: TraceStep }) {
  const Icon = step.tool.icon
  return (
    <div className="flex items-start gap-3 text-xs font-mono">
      <div className="shrink-0 mt-0.5">
        {step.type === 'pending' && (
          <span className="w-3.5 h-3.5 rounded-full border border-border block" />
        )}
        {step.type === 'running' && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        )}
        {step.type === 'done' && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className={cn(
            'font-semibold',
            step.type === 'pending' ? 'text-muted-foreground/50' :
            step.type === 'running' ? 'text-primary' : 'text-foreground',
          )}>
            {step.tool.name}
          </span>
        </div>
        <div className={cn(
          'text-[10px] mt-0.5',
          step.type === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/60',
        )}>
          {step.type === 'done' ? step.resultLine : step.tool.description}
        </div>
        {step.type === 'done' && step.graphHops !== undefined && step.graphHops > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-violet-500 dark:text-violet-400 mt-0.5">
            <GitBranch className="w-2.5 h-2.5" />
            {step.graphHops} graph hop{step.graphHops !== 1 ? 's' : ''} traversed
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Preset chips ─────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Full briefing',          query: 'what needs my attention today' },
  { label: 'Restock urgency',        query: 'what do I need to restock or order' },
  { label: 'Waste anomalies',        query: 'any waste anomalies or write-off spikes' },
  { label: 'Supplier performance',   query: 'how are my suppliers performing' },
  { label: 'Active incidents',       query: 'what are the active incidents and alerts' },
]

// ─── Chat mode (LLM tool-calling conversation) ───────────────────────────────

// CHAT_PRESETS, CopilotChatView, and ChatBubble extracted to
// @/features/eye/components/CopilotChatView.tsx


// ─── Main page ────────────────────────────────────────────────────────────────

type CopilotMode = 'quick' | 'chat'

type FeedbackState = 'none' | 'positive' | 'negative' | 'submitted'

type CopilotState =
  | { phase: 'idle' }
  | { phase: 'running'; query: string; steps: TraceStep[] }
  | { phase: 'done';    query: string; steps: TraceStep[]; answer: string; navigations: { label: string; path: string }[] }

export default function EyeCopilotPage() {
  const currency    = useCurrency()
  const navigate    = useNavigate()
  const inputRef    = useRef<HTMLInputElement>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)

  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? null)

  const [mode, setMode]             = useState<CopilotMode>('chat')
  const [input, setInput]           = useState('')
  const [state, setState]           = useState<CopilotState>({ phase: 'idle' })
  const [feedback, setFeedback]     = useState<FeedbackState>('none')
  const [correction, setCorrection] = useState('')

  // Pre-fetch all Eye Layer data — copilot routes against cached results
  const { data: incidents  = [] } = useActiveIncidents(7)
  const { data: wasteRows  = [] } = useWasteRadar()
  const { data: suppRows   = [] } = useSupplierReliability(90)
  const { data: forecast   = [] } = useConsumptionForecast(30)
  const { data: products   = [] } = useProducts()
  const { data: suppliers  = [] } = useSuppliers()
  const { data: requests   = [] } = useRestockRequests()
  // Hotel-wide operational edge corpus — used for multi-hop graph traversal
  const { data: hotelEdges = [] } = useHotelEdges()

  const suppliersMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers],
  )
  const openRestockIds = useMemo(
    () => new Set(
      requests
        .filter((r) => ['pending', 'pending_manager', 'pending_director', 'approved'].includes(r.status))
        .map((r) => r.variant_id),
    ),
    [requests],
  )
  const restockRows = useMemo(
    () => computePredictiveRestocks(forecast, products, suppliersMap, openRestockIds),
    [forecast, products, suppliersMap, openRestockIds],
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state])

  async function runQuery(query: string) {
    if (!query.trim()) return
    const tools = routeQuery(query)

    // Reset feedback state for new query
    setFeedback('none')
    setCorrection('')

    // Build initial pending steps
    const initialSteps: TraceStep[] = tools.map((t) => ({ type: 'pending', tool: t }))
    setState({ phase: 'running', query, steps: initialSteps })

    // Simulate tool execution with staged timing
    const finalSteps: TraceStep[] = [...initialSteps]

    for (let i = 0; i < tools.length; i++) {
      // Mark as running
      finalSteps[i] = { type: 'running', tool: tools[i] }
      setState({ phase: 'running', query, steps: [...finalSteps] })

      // Simulate async tool execution delay
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400))

      // Compute result line from pre-fetched data + graph traversal
      let resultLine = ''
      let graphHops  = 0
      const tool = tools[i]

      if (tool.id === 'incidents') {
        const c = incidents.filter((r) => r.incident_severity === 'critical').length
        const e = incidents.filter((r) => r.incident_severity === 'elevated').length
        // Graph: count how many critical incidents trace back to a known supplier
        const supplierLinked = incidents
          .filter((r) => r.incident_severity === 'critical')
          .filter((r) => {
            const nodes = traverseGraph(hotelEdges, r.variant_id, 'variant', {
              maxDepth: 3, edgeFilter: ['restocks', 'linked_to_po', 'sourced_from'], direction: 'out',
            })
            graphHops += nodes.length
            return nodes.some((n) => n.nodeType === 'supplier')
          }).length
        resultLine = incidents.length === 0
          ? '→ 0 incidents · all clear'
          : `→ ${String(incidents.length)} incidents · ${String(c)} critical · ${String(e)} elevated${supplierLinked > 0 ? ` · ${String(supplierLinked)} supplier-linked` : ''}`
      } else if (tool.id === 'restock') {
        const c = restockRows.filter((r) => r.urgency === 'critical').length
        const w = restockRows.filter((r) => r.urgency === 'warning').length
        // Graph: count critical items already covered by an open PO
        const alreadyOrdered = restockRows
          .filter((r) => r.urgency === 'critical')
          .filter((r) => {
            const count = linkedPOCount(r.variantId, hotelEdges)
            graphHops += count
            return count > 0
          }).length
        resultLine = restockRows.length === 0
          ? '→ 0 items · no orders needed'
          : `→ ${String(restockRows.length)} items · ${String(c)} critical · ${String(w)} warning${alreadyOrdered > 0 ? ` · ${String(alreadyOrdered)} already on PO` : ''}`
      } else if (tool.id === 'waste') {
        const c = wasteRows.filter((r) => r.anomaly_score >= 8).length
        // Graph: check top anomaly for supplier linkage
        const top = wasteRows.at(0)
        if (top) {
          const nodes = traverseGraph(hotelEdges, top.variant_id, 'variant', {
            maxDepth: 2, edgeFilter: ['restocks', 'sourced_from'], direction: 'out',
          })
          graphHops += nodes.length
        }
        resultLine = wasteRows.length === 0
          ? '→ 0 anomalies · within baseline'
          : `→ ${String(wasteRows.length)} anomalies · ${String(c)} critical (score ≥8)`
      } else if (tool.id === 'suppliers') {
        const cr = suppRows.filter((r) => r.risk_tier === 'critical').length
        const hi = suppRows.filter((r) => r.risk_tier === 'high').length
        // Graph: count total variant dependencies on critical suppliers
        const depCount = suppRows
          .filter((r) => r.risk_tier === 'critical' && r.supplier_id != null)
          .reduce((sum, r) => {
            const n = variantDependencyCount(r.supplier_id ?? '', hotelEdges)
            graphHops += n
            return sum + n
          }, 0)
        resultLine = suppRows.length === 0
          ? '→ no delivery history yet'
          : `→ ${String(suppRows.length)} suppliers scored · ${String(cr)} critical · ${String(hi)} high risk${depCount > 0 ? ` · ${String(depCount)} variant${depCount !== 1 ? 's' : ''} at risk` : ''}`
      }

      finalSteps[i] = { type: 'done', tool, resultLine, graphHops }
      setState({ phase: 'running', query, steps: [...finalSteps] })
    }

    // Synthesize answer
    const paragraphs: string[] = []
    const navs: { label: string; path: string }[] = []

    const graphInsights: GraphInsight[] = []

    for (const tool of tools) {
      if (tool.id === 'incidents') {
        paragraphs.push(synthesizeIncidents(incidents))
        if (incidents.filter((r) => r.incident_severity === 'critical').length > 0) {
          navs.push({ label: 'View Incident Engine →', path: '/eye?panel=incidents' })
        }
        // Graph enrichment: for each critical incident, trace supplier chain
        for (const inc of incidents.filter((r) => r.incident_severity === 'critical').slice(0, 3)) {
          const insight = supplierInsightForVariant(inc.variant_id, inc.variant_label, hotelEdges, suppRows)
          if (insight) {
            graphInsights.push(insight)
            if (insight.nav) navs.push(insight.nav)
          }
        }
      }
      if (tool.id === 'restock') {
        paragraphs.push(synthesizeRestock(restockRows))
        if (restockRows.filter((r) => r.urgency === 'critical').length > 0) {
          navs.push({ label: 'Open Restock Queue →', path: '/eye?panel=restock' })
        }
        // Graph enrichment: flag critical items with no open PO
        const unordered = restockRows
          .filter((r) => r.urgency === 'critical')
          .filter((r) => linkedPOCount(r.variantId, hotelEdges) === 0)
        if (unordered.length > 0) {
          const labels = unordered.slice(0, 2).map((r) =>
            r.variantName !== 'Standard' ? `${r.productName} — ${r.variantName}` : r.productName
          ).join(', ')
          graphInsights.push({
            sentence: `Graph check: ${String(unordered.length)} critical item${unordered.length !== 1 ? 's' : ''} (${labels}${unordered.length > 2 ? ', …' : ''}) have no linked purchase order — these require a new PO immediately.`,
            nav: { label: 'Create PO →', path: '/mind?panel=suppliers' },
          })
        }
      }
      if (tool.id === 'waste') {
        paragraphs.push(synthesizeWaste(wasteRows, currency))
        if (wasteRows.length > 0) {
          navs.push({ label: 'Open Waste Radar →', path: '/eye?panel=waste' })
        }
        // Graph enrichment: trace top anomaly's supplier chain
        const top = wasteRows.at(0)
        if (top) {
          const insight = supplierInsightForVariant(top.variant_id, top.variant_label, hotelEdges, suppRows)
          if (insight) graphInsights.push(insight)
        }
      }
      if (tool.id === 'suppliers') {
        paragraphs.push(synthesizeSuppliers(suppRows))
        if (suppRows.filter((r) => r.risk_tier === 'critical' || r.risk_tier === 'high').length > 0) {
          navs.push({ label: 'Supplier Scorecard →', path: '/mind?panel=suppliers' })
          navs.push({ label: 'Renegotiate Contracts →', path: '/mind?panel=contracts' })
        }
        // Graph enrichment: blast radius per critical supplier
        for (const s of suppRows.filter((r) => r.risk_tier === 'critical' && r.supplier_id != null).slice(0, 2)) {
          const deps = variantDependencyCount(s.supplier_id ?? '', hotelEdges)
          if (deps > 0) {
            graphInsights.push({
              sentence: `Blast radius: ${s.supplier_name} supplies ${String(deps)} variant${deps !== 1 ? 's' : ''} — failure affects ${String(deps)} product line${deps !== 1 ? 's' : ''} simultaneously.`,
              nav: { label: `${s.supplier_name} →`, path: `/supplier/${s.supplier_id ?? ''}` },
            })
          }
        }
      }
    }

    // Append unique graph insights as a cross-domain synthesis paragraph
    if (graphInsights.length > 0) {
      paragraphs.push(graphInsights.map((g) => g.sentence).join(' '))
      for (const g of graphInsights) {
        if (g.nav && !navs.some((n) => n.path === g.nav?.path)) {
          navs.push(g.nav)
        }
      }
    }

    const answer = paragraphs.filter(Boolean).join('\n\n')

    setState({
      phase: 'done',
      query,
      steps: finalSteps,
      answer,
      navigations: navs,
    })
  }

  function handleSubmit() {
    const q = input.trim()
    if (!q || state.phase === 'running') return
    setInput('')
    void runQuery(q)
  }

  function handleReset() {
    setState({ phase: 'idle' })
    setInput('')
    setFeedback('none')
    setCorrection('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function submitFeedback(rating: 1 | -1, corr?: string) {
    if (state.phase !== 'done' || !hotelId) return
    setFeedback(rating === 1 ? 'positive' : 'negative')
    const totalHops = state.steps.reduce((s, step) => s + (step.type === 'done' ? (step.graphHops ?? 0) : 0), 0)
    await supabase.from('copilot_feedback').insert({
      hotel_id:         hotelId,
      actor_id:         userId,
      query:            state.query,
      answer:           state.answer,
      tools_called:     state.steps.map((s) => s.tool.name),
      graph_hops_total: totalHops,
      rating,
      correction:       corr ?? null,
    })
    setFeedback('submitted')
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/30">
              <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Eye · Copilot</h2>
              <p className="text-xs text-muted-foreground">
                {mode === 'chat' ? 'LLM-powered · multi-turn · cross-domain synthesis' : 'Deterministic routing · traced tools · live cache'}
              </p>
            </div>
          </div>
          {/* Mode toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => { setMode('chat') }}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                mode === 'chat' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <MessageSquare className="w-3 h-3" />Chat
            </button>
            <button
              type="button"
              onClick={() => { setMode('quick') }}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                mode === 'quick' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Cpu className="w-3 h-3" />Quick
            </button>
          </div>
        </div>
      </div>

      {/* Chat mode — LLM-powered conversational copilot */}
      {mode === 'chat' && <ExtractedChatView />}

      {/* Quick mode — deterministic routing with trace */}
      {mode === 'quick' && <>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Idle state — preset chips */}
        {state.phase === 'idle' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <Zap className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Try asking:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(({ label, query }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { void runQuery(query) }}
                  className="px-3 py-1.5 text-xs rounded-full border border-border bg-card hover:bg-muted/40 hover:border-foreground/20 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Capability overview */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {TOOLS.map((t) => {
                const Icon = t.icon
                return (
                  <div key={t.id} className="border rounded-lg p-3 bg-card space-y-1">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-mono text-[10px] text-muted-foreground">{t.name}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {t.description.replace('…', '')}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Running / done state */}
        {(state.phase === 'running' || state.phase === 'done') && (
          <div className="space-y-5">

            {/* Query echo */}
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">Q</span>
              </div>
              <p className="text-sm font-medium pt-0.5">{state.query}</p>
            </div>

            {/* Reasoning trace */}
            <div className="border rounded-lg bg-muted/20 p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Reasoning trace
              </p>
              {state.steps.map((step, i) => (
                <TraceStepRow key={i} step={step} />
              ))}
            </div>

            {/* Answer */}
            {state.phase === 'done' && (
              <div className="space-y-3">
                <div className="border rounded-lg bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
                      <Brain className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Eye · Synthesis
                    </span>
                  </div>
                  <div className="space-y-3">
                    {state.answer.split('\n\n').map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed">{para}</p>
                    ))}
                  </div>
                </div>

                {/* Navigation actions */}
                {state.navigations.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {state.navigations.map(({ label, path }) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => { void navigate(path) }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors font-medium"
                      >
                        {label}
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Feedback */}
                {feedback === 'none' && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">Was this helpful?</span>
                    <button
                      type="button"
                      onClick={() => { void submitFeedback(1) }}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-emerald-500 transition-colors"
                    >
                      <ThumbsUp className="w-3 h-3" /> Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFeedback('negative'); }}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <ThumbsDown className="w-3 h-3" /> No
                    </button>
                  </div>
                )}
                {feedback === 'negative' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground">What was wrong? (optional — helps improve future answers)</p>
                    <textarea
                      rows={2}
                      value={correction}
                      onChange={(e) => { setCorrection(e.target.value); }}
                      placeholder="The answer missed… / The supplier risk was actually…"
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { void submitFeedback(-1, correction) }}
                        className="px-3 py-1 text-[10px] rounded border border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        Submit correction
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFeedback('none'); }}
                        className="px-3 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {feedback === 'submitted' && (
                  <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Feedback recorded — thank you
                  </p>
                )}

                {/* Confidence footnote */}
                <p className="text-[10px] text-muted-foreground">
                  Based on: {String(state.steps.length)} tool{state.steps.length > 1 ? 's' : ''} called ·
                  live data ·{' '}
                  {(() => {
                    const totalHops = state.steps.reduce((s, step) => s + (step.type === 'done' ? (step.graphHops ?? 0) : 0), 0)
                    return totalHops > 0 ? `${String(totalHops)} graph nodes traversed · ` : ''
                  })()}
                  {state.steps.map((s) => s.tool.name).join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t shrink-0 px-6 py-4 bg-background">
        <div className="flex items-center gap-2">
          {state.phase !== 'idle' && (
            <button
              type="button"
              onClick={handleReset}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
              title="New question"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            placeholder={
              state.phase === 'running'
                ? 'Running…'
                : 'Ask about incidents, restock, waste, or suppliers…'
            }
            disabled={state.phase === 'running'}
            className="flex-1 h-9 rounded-lg border border-border bg-card px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || state.phase === 'running'}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
          >
            {state.phase === 'running'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Routes to typed tools · shows full reasoning · based on real-time graph data
        </p>
      </div>

      </>}
    </div>
  )
}
