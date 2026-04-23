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
  Radar, ChevronRight, Zap, CheckCircle2, Send, RotateCcw,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useActiveIncidents, useWasteRadar, useSupplierReliability } from '@/features/eye/hooks'
import { useConsumptionForecast, computePredictiveRestocks } from '@/features/eye/hooks'
import { useProducts } from '@/features/inventory/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useRestockRequests } from '@/features/restock/hooks'
import type { ActiveIncidentRow, WasteRadarRow, SupplierReliabilityRow } from '@beacon/types'
import type { PredictiveRestockRow } from '@/features/eye/hooks'

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
    parts.push(`${critical.length} critical incident${critical.length > 1 ? 's' : ''} require immediate attention.`)
    parts.push(`Most urgent: ${critical[0].variant_label} — ${critical[0].primary_signal}`)
  } else if (elevated.length > 0) {
    parts.push(`${elevated.length} elevated incident${elevated.length > 1 ? 's' : ''} need monitoring.`)
  }
  if (multiDomain.length > 0) {
    parts.push(`${multiDomain.length} incident${multiDomain.length > 1 ? 's' : ''} span multiple domains (waste + supply or team).`)
  }
  if (parts.length === 0) {
    parts.push(`${rows.length} watch-level incident${rows.length > 1 ? 's' : ''} detected — no immediate action required.`)
  }
  return parts.join(' ')
}

function synthesizeRestock(rows: PredictiveRestockRow[]): string {
  if (rows.length === 0) return 'No items need ordering in the next 14 days. All stock levels are healthy through lead time.'
  const critical = rows.filter((r) => r.urgency === 'critical')
  const warning  = rows.filter((r) => r.urgency === 'warning')
  const parts: string[] = []
  if (critical.length > 0) {
    parts.push(`${critical.length} item${critical.length > 1 ? 's' : ''} must be ordered today — order window is closing.`)
    const top = critical[0]
    const label = top.variantName !== 'Standard' ? `${top.productName} — ${top.variantName}` : top.productName
    parts.push(`Most critical: ${label} · ${top.daysUntilZero}d left · stockout ${format(top.stockoutDate, 'MMM d')}.`)
  }
  if (warning.length > 0) {
    parts.push(`${warning.length} item${warning.length > 1 ? 's' : ''} should be ordered within 1–3 days.`)
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
    parts.push(`${critical.length} critical anomal${critical.length > 1 ? 'ies' : 'y'} (score ≥8) detected.`)
    parts.push(`Highest: ${rows[0].variant_label} · score ${rows[0].anomaly_score}/10 · +${rows[0].pct_above_baseline}% above baseline.`)
  } else {
    parts.push(`${rows.length} anomal${rows.length > 1 ? 'ies' : 'y'} above 50% baseline threshold.`)
  }
  if (theft.length > 0) {
    parts.push(`${theft.length} probable theft signal${theft.length > 1 ? 's' : ''} (low occupancy + theft category).`)
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
    parts.push(`${critical.length} supplier${critical.length > 1 ? 's' : ''} are critically unreliable — renegotiate contracts.`)
    parts.push(`Worst: ${rows[0].supplier_name} · score ${rows[0].reliability_score}/10 · ${rows[0].on_time_pct.toFixed(0)}% on-time.`)
  } else if (high.length > 0) {
    parts.push(`${high.length} supplier${high.length > 1 ? 's' : ''} are high risk.`)
  } else {
    parts.push(`Supplier fleet looks healthy. ${reliable.length} reliable supplier${reliable.length > 1 ? 's' : ''}.`)
  }
  parts.push(`Fleet average on-time rate: ${avgOT.toFixed(1)}%.`)
  return parts.join(' ')
}

// ─── Trace step component ─────────────────────────────────────────────────────

type TraceStep =
  | { type: 'pending';  tool: ToolDef }
  | { type: 'running';  tool: ToolDef }
  | { type: 'done';     tool: ToolDef; resultLine: string }

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

// ─── Main page ────────────────────────────────────────────────────────────────

type CopilotState =
  | { phase: 'idle' }
  | { phase: 'running'; query: string; steps: TraceStep[] }
  | { phase: 'done';    query: string; steps: TraceStep[]; answer: string; navigations: { label: string; path: string }[] }

export default function EyeCopilotPage() {
  const currency    = useCurrency()
  const navigate    = useNavigate()
  const inputRef    = useRef<HTMLInputElement>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)

  const [input, setInput]     = useState('')
  const [state, setState]     = useState<CopilotState>({ phase: 'idle' })

  // Pre-fetch all Eye Layer data — copilot routes against cached results
  const { data: incidents  = [] } = useActiveIncidents(7)
  const { data: wasteRows  = [] } = useWasteRadar()
  const { data: suppRows   = [] } = useSupplierReliability(90)
  const { data: forecast   = [] } = useConsumptionForecast(30)
  const { data: products   = [] } = useProducts()
  const { data: suppliers  = [] } = useSuppliers()
  const { data: requests   = [] } = useRestockRequests()

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

      // Compute result line from pre-fetched data
      let resultLine = ''
      const tool = tools[i]
      if (tool.id === 'incidents') {
        const c = incidents.filter((r) => r.incident_severity === 'critical').length
        const e = incidents.filter((r) => r.incident_severity === 'elevated').length
        resultLine = incidents.length === 0
          ? '→ 0 incidents · all clear'
          : `→ ${incidents.length} incidents · ${c} critical · ${e} elevated`
      } else if (tool.id === 'restock') {
        const c = restockRows.filter((r) => r.urgency === 'critical').length
        const w = restockRows.filter((r) => r.urgency === 'warning').length
        resultLine = restockRows.length === 0
          ? '→ 0 items · no orders needed'
          : `→ ${restockRows.length} items · ${c} critical · ${w} warning`
      } else if (tool.id === 'waste') {
        const c = wasteRows.filter((r) => r.anomaly_score >= 8).length
        resultLine = wasteRows.length === 0
          ? '→ 0 anomalies · within baseline'
          : `→ ${wasteRows.length} anomalies · ${c} critical (score ≥8)`
      } else if (tool.id === 'suppliers') {
        const cr = suppRows.filter((r) => r.risk_tier === 'critical').length
        const hi = suppRows.filter((r) => r.risk_tier === 'high').length
        resultLine = suppRows.length === 0
          ? '→ no delivery history yet'
          : `→ ${suppRows.length} suppliers scored · ${cr} critical · ${hi} high risk`
      }

      finalSteps[i] = { type: 'done', tool, resultLine }
      setState({ phase: 'running', query, steps: [...finalSteps] })
    }

    // Synthesize answer
    const paragraphs: string[] = []
    const navs: { label: string; path: string }[] = []

    for (const tool of tools) {
      if (tool.id === 'incidents') {
        paragraphs.push(synthesizeIncidents(incidents))
        if (incidents.filter((r) => r.incident_severity === 'critical').length > 0) {
          navs.push({ label: 'View Incident Engine →', path: '/eye?panel=insights' })
        }
      }
      if (tool.id === 'restock') {
        paragraphs.push(synthesizeRestock(restockRows))
        if (restockRows.filter((r) => r.urgency === 'critical').length > 0) {
          navs.push({ label: 'Open Restock Queue →', path: '/eye?panel=restock' })
        }
      }
      if (tool.id === 'waste') {
        paragraphs.push(synthesizeWaste(wasteRows, currency))
        if (wasteRows.length > 0) {
          navs.push({ label: 'Open Waste Radar →', path: '/eye?panel=signals' })
        }
      }
      if (tool.id === 'suppliers') {
        paragraphs.push(synthesizeSuppliers(suppRows))
        if (suppRows.filter((r) => r.risk_tier === 'critical' || r.risk_tier === 'high').length > 0) {
          navs.push({ label: 'Supplier Scorecard →', path: '/eye?panel=suppliers' })
          navs.push({ label: 'Renegotiate Contracts →', path: '/mind?panel=contracts' })
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
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/30">
            <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Eye · Copilot</h2>
            <p className="text-xs text-muted-foreground">
              Ask a question · routed to typed tools · reasoning shown · based on live data
            </p>
          </div>
        </div>
      </div>

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
                        onClick={() => navigate(path)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors font-medium"
                      >
                        {label}
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Confidence footnote */}
                <p className="text-[10px] text-muted-foreground">
                  Based on: {state.steps.length} tool{state.steps.length > 1 ? 's' : ''} called ·
                  live data ·{' '}
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
            onChange={(e) => setInput(e.target.value)}
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
    </div>
  )
}
