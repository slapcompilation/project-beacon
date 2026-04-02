// Layer: Mind — Par Level Auto-Optimizer
// Analyzes consumption forecast vs current par levels and recommends optimal thresholds.
// Prevents stockouts permanently by keeping par levels calibrated to real usage patterns.
// Operators accept/reject recommendations per row or batch-accept all.
// Palantir principle: intelligence everywhere — every threshold carries its basis.

import { useMemo, useState, useCallback } from 'react'
import {
  SlidersHorizontal, Check, X, CheckCheck, TrendingUp, TrendingDown,
  Minus, Info, Package, RefreshCw, Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useConsumptionForecast } from '@/features/eye/hooks'
import { useProducts, useUpdateVariant } from '@/features/inventory/hooks'

// ─── Recommendation logic ─────────────────────────────────────────────────────
//
// Optimal par = avg_daily * lead_days + safety_buffer
// Where:
//   lead_days = 3 (default delivery lead time assumption)
//   safety_buffer = avg_daily * 1.5 (50% buffer for demand spikes)
//
// Net: par = avg_daily * (lead_days + 1.5)

const LEAD_DAYS = 3
const SAFETY_FACTOR = 1.5

function calcOptimalPar(avgDaily: number): number {
  return Math.ceil(avgDaily * (LEAD_DAYS + SAFETY_FACTOR))
}

type ChangeType = 'increase' | 'decrease' | 'new' | 'ok'

interface ParRecommendation {
  variantId: string
  productId: string
  productName: string
  variantName: string
  sku: string
  currentPar: number
  recommendedPar: number
  currentStock: number
  avgDaily: number
  daysUntilZero: number | null
  changeType: ChangeType
  changeDelta: number
  // accepted: true = accepted, false = rejected, null = pending
  decision: 'accepted' | 'rejected' | null
}

function getChangeType(current: number, recommended: number): ChangeType {
  if (current === 0 && recommended > 0) return 'new'
  if (recommended > current) return 'increase'
  if (recommended < current) return 'decrease'
  return 'ok'
}

const CHANGE_CFG: Record<ChangeType, { label: string; icon: React.ElementType; cls: string; rowCls: string }> = {
  increase: { label: 'Increase', icon: TrendingUp,   cls: 'text-green-600',  rowCls: 'bg-green-50/30 dark:bg-green-950/10' },
  decrease: { label: 'Decrease', icon: TrendingDown,  cls: 'text-blue-600',   rowCls: 'bg-blue-50/20 dark:bg-blue-950/10' },
  new:      { label: 'Set Par',  icon: TrendingUp,   cls: 'text-amber-600',  rowCls: 'bg-amber-50/30 dark:bg-amber-950/10' },
  ok:       { label: 'On Track', icon: Minus,        cls: 'text-muted-foreground', rowCls: '' },
}

type FilterMode = 'all' | 'increase' | 'decrease' | 'new' | 'ok' | 'pending'

// ─── Row component ────────────────────────────────────────────────────────────

interface ParRowProps {
  rec: ParRecommendation
  onAccept: (variantId: string) => void
  onReject: (variantId: string) => void
}

function ParRow({ rec, onAccept, onReject }: ParRowProps) {
  const cfg = CHANGE_CFG[rec.changeType]
  const Icon = cfg.icon

  return (
    <tr className={cn(
      'border-b border-border/50 transition-colors',
      rec.decision === 'accepted' ? 'opacity-60 bg-green-50/20 dark:bg-green-950/5' :
      rec.decision === 'rejected' ? 'opacity-40 line-through' :
      cfg.rowCls,
    )}>
      <td className="py-2.5 pl-4 pr-2">
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', cfg.cls)} />
          <span className={cn('text-xs font-medium', cfg.cls)}>{cfg.label}</span>
        </div>
      </td>
      <td className="py-2.5 px-2">
        <div>
          <p className="text-sm font-medium leading-tight">
            {rec.variantName !== 'Standard' ? `${rec.productName} — ${rec.variantName}` : rec.productName}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground">{rec.sku}</p>
        </div>
      </td>
      <td className="py-2.5 px-2 text-center">
        <span className="tabular-nums text-sm font-semibold">{rec.currentStock}</span>
        {rec.daysUntilZero != null && (
          <p className={cn(
            'text-[10px] mt-0.5',
            rec.daysUntilZero <= 2 ? 'text-red-600 font-semibold' : rec.daysUntilZero <= 7 ? 'text-yellow-600' : 'text-muted-foreground',
          )}>
            ~{rec.daysUntilZero}d left
          </p>
        )}
      </td>
      <td className="py-2.5 px-2 text-center">
        <span className="text-xs text-muted-foreground tabular-nums">
          {rec.avgDaily > 0 ? rec.avgDaily.toFixed(1) : '—'}/day
        </span>
      </td>
      <td className="py-2.5 px-2 text-center">
        <span className={cn(
          'tabular-nums text-sm font-semibold',
          rec.currentPar === 0 ? 'text-muted-foreground' : '',
        )}>
          {rec.currentPar === 0 ? 'None' : rec.currentPar}
        </span>
      </td>
      <td className="py-2.5 px-2 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className={cn('tabular-nums text-sm font-bold', cfg.cls)}>
            {rec.recommendedPar}
          </span>
          {rec.changeDelta !== 0 && (
            <span className={cn(
              'text-[10px] font-semibold tabular-nums',
              rec.changeDelta > 0 ? 'text-green-600' : 'text-blue-600',
            )}>
              {rec.changeDelta > 0 ? `+${rec.changeDelta}` : rec.changeDelta}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          based on {rec.avgDaily.toFixed(1)}/day · {LEAD_DAYS}d lead + {SAFETY_FACTOR}× buffer
        </p>
      </td>
      <td className="py-2.5 pl-2 pr-4">
        {rec.decision === null ? (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { onAccept(rec.variantId) }}
              className="h-7 w-7 p-0 border-green-300 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/30"
              title="Accept recommendation"
            >
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { onReject(rec.variantId) }}
              className="h-7 w-7 p-0 border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
              title="Reject (keep current par)"
            >
              <X className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        ) : rec.decision === 'accepted' ? (
          <Badge variant="outline" className="text-[10px] border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 h-5">
            <Check className="h-3 w-3 mr-1" /> Applied
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground h-5">
            Skipped
          </Badge>
        )}
      </td>
    </tr>
  )
}

// ─── Content (also embeddable in InventoryPage sheet) ─────────────────────────

export function ParOptimizerContent() {
  const { data: forecast = [], isLoading: forecastLoading } = useConsumptionForecast(30)
  const { data: products = [], isLoading: productsLoading } = useProducts()
  const updateVariant = useUpdateVariant()

  const [filterMode, setFilterMode] = useState<FilterMode>('pending')
  const [search, setSearch] = useState('')
  const [decisions, setDecisions] = useState<Record<string, 'accepted' | 'rejected'>>({})
  const [applying, setApplying] = useState(false)

  // Build par lookup: variantId → low_stock_threshold
  const parMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) {
      for (const v of p.product_variants) {
        m.set(v.id, v.low_stock_threshold)
      }
    }
    return m
  }, [products])

  // Build recommendations
  const allRecs = useMemo<ParRecommendation[]>(() => {
    return forecast
      .filter((r) => r.avg_daily > 0) // Only items with measurable consumption
      .map((r) => {
        const currentPar = parMap.get(r.variant_id) ?? 0
        const recommendedPar = calcOptimalPar(r.avg_daily)
        const changeType = getChangeType(currentPar, recommendedPar)
        const changeDelta = recommendedPar - currentPar
        return {
          variantId: r.variant_id,
          productId: '',
          productName: r.product_name,
          variantName: r.variant_name,
          sku: r.sku,
          currentPar,
          recommendedPar,
          currentStock: r.current_stock,
          avgDaily: r.avg_daily,
          daysUntilZero: r.days_until_zero,
          changeType,
          changeDelta,
          decision: decisions[r.variant_id] ?? null,
        } satisfies ParRecommendation
      })
      .sort((a, b) => {
        // Sort: new → increase → decrease → ok, then by delta desc
        const order: Record<ChangeType, number> = { new: 0, increase: 1, decrease: 2, ok: 3 }
        if (order[a.changeType] !== order[b.changeType]) return order[a.changeType] - order[b.changeType]
        return Math.abs(b.changeDelta) - Math.abs(a.changeDelta)
      })
  }, [forecast, parMap, decisions])

  // Filter
  const filteredRecs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRecs.filter((r) => {
      if (filterMode === 'pending' && r.decision !== null) return false
      if (filterMode !== 'all' && filterMode !== 'pending' && r.changeType !== filterMode) return false
      if (q) {
        const name = r.variantName !== 'Standard' ? `${r.productName} ${r.variantName}` : r.productName
        return name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
      }
      return true
    })
  }, [allRecs, filterMode, search])

  const pendingRecs = useMemo(() => allRecs.filter((r) => r.decision === null && r.changeType !== 'ok'), [allRecs])
  const acceptedCount = Object.values(decisions).filter((d) => d === 'accepted').length

  const handleAccept = useCallback((variantId: string) => {
    setDecisions((prev) => ({ ...prev, [variantId]: 'accepted' }))
  }, [])

  const handleReject = useCallback((variantId: string) => {
    setDecisions((prev) => ({ ...prev, [variantId]: 'rejected' }))
  }, [])

  const handleAcceptAll = useCallback(() => {
    const actionable = pendingRecs.filter((r) => r.changeType !== 'ok')
    if (actionable.length === 0) {
      toast.info('No pending recommendations')
      return
    }
    const next: Record<string, 'accepted' | 'rejected'> = { ...decisions }
    for (const r of actionable) {
      next[r.variantId] = 'accepted'
    }
    setDecisions(next)
    toast.success(`Accepted ${actionable.length} recommendations — click Apply to save`)
  }, [pendingRecs, decisions])

  const handleApply = useCallback(async () => {
    const toApply = allRecs.filter((r) => decisions[r.variantId] === 'accepted')
    if (toApply.length === 0) {
      toast.info('No accepted recommendations to apply')
      return
    }
    setApplying(true)
    let success = 0
    let failed = 0
    for (const rec of toApply) {
      try {
        await updateVariant.mutateAsync({
          id: rec.variantId,
          input: { low_stock_threshold: rec.recommendedPar } as Parameters<typeof updateVariant.mutateAsync>[0]['input'],
        })
        success++
      } catch {
        failed++
      }
    }
    setApplying(false)
    if (success > 0) toast.success(`Applied ${success} par level update${success !== 1 ? 's' : ''}`)
    if (failed > 0) toast.error(`${failed} updates failed`)
  }, [allRecs, decisions, updateVariant])

  const isLoading = forecastLoading || productsLoading

  // Summary counts
  const increaseCount = allRecs.filter((r) => r.changeType === 'increase').length
  const decreaseCount = allRecs.filter((r) => r.changeType === 'decrease').length
  const newCount      = allRecs.filter((r) => r.changeType === 'new').length
  const okCount       = allRecs.filter((r) => r.changeType === 'ok').length
  const pendingCount  = pendingRecs.length

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-start justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
            Par Level Optimizer
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading ? 'Analyzing consumption patterns…' : (
              `${allRecs.length} variants analyzed · ${pendingCount} recommendations pending · based on 30-day avg + ${LEAD_DAYS}d lead time`
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleAcceptAll}>
              <CheckCheck className="h-3.5 w-3.5" />
              Accept All ({pendingCount})
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => { void handleApply() }}
            disabled={acceptedCount === 0 || applying}
          >
            {applying ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Apply {acceptedCount > 0 ? `(${acceptedCount})` : ''} Changes
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-px border-b bg-border flex-shrink-0">
        {[
          { label: 'Pending',    value: pendingCount,   sub: 'need your decision',          highlight: pendingCount > 0 },
          { label: 'Increase',   value: increaseCount,  sub: 'par too low for usage' },
          { label: 'Decrease',   value: decreaseCount,  sub: 'par higher than needed' },
          { label: 'Set New',    value: newCount,       sub: 'no par configured',           highlight: newCount > 0 },
          { label: 'On Track',   value: okCount,        sub: 'par correctly calibrated' },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className="bg-card px-5 py-3">
            <p className={cn('text-lg font-bold tabular-nums leading-none', highlight ? 'text-amber-600' : '')}>{value}</p>
            <p className="text-xs font-medium mt-0.5">{label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-6 py-2.5 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by product or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value) }}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {([
            { mode: 'pending',  label: `Pending (${pendingCount})` },
            { mode: 'all',      label: 'All' },
            { mode: 'increase', label: `↑ Increase (${increaseCount})` },
            { mode: 'decrease', label: `↓ Decrease (${decreaseCount})` },
            { mode: 'new',      label: `New (${newCount})` },
            { mode: 'ok',       label: `OK (${okCount})` },
          ] as { mode: FilterMode; label: string }[]).map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => { setFilterMode(mode) }}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                filterMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {Object.keys(decisions).length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 ml-auto"
            onClick={() => { setDecisions({}) }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset decisions
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredRecs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
            <div className="rounded-full bg-muted/50 p-4">
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium">No items match this filter</p>
            {filterMode === 'pending' && allRecs.length > 0 && (
              <p className="text-xs text-muted-foreground">
                All recommendations have been reviewed. Click Apply Changes to save.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Method note */}
            <div className="flex items-center gap-2 px-6 py-2.5 border-b bg-muted/20 text-[11px] text-muted-foreground">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Optimal par = <span className="font-mono">⌈avg_daily × ({LEAD_DAYS} lead days + {SAFETY_FACTOR}× safety buffer)⌉</span>
                · Based on 30-day consumption history · Accept or reject each recommendation individually, or batch-accept all.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pl-4 pr-2 w-28">Change</th>
                    <th className="py-2 px-2">Product</th>
                    <th className="py-2 px-2 text-center w-24">Stock</th>
                    <th className="py-2 px-2 text-center w-24">Avg Usage</th>
                    <th className="py-2 px-2 text-center w-24">Current Par</th>
                    <th className="py-2 px-2 text-center w-40">Recommended Par</th>
                    <th className="py-2 pl-2 pr-4 w-28">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecs.map((rec) => (
                    <ParRow
                      key={rec.variantId}
                      rec={rec}
                      onAccept={handleAccept}
                      onReject={handleReject}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom action bar */}
            {acceptedCount > 0 && (
              <div className="sticky bottom-0 border-t bg-background px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                    <Check className="h-3 w-3 mr-1" />
                    {acceptedCount} accepted
                  </Badge>
                  {Object.values(decisions).filter((d) => d === 'rejected').length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {Object.values(decisions).filter((d) => d === 'rejected').length} rejected
                    </span>
                  )}
                </div>
                <Button
                  onClick={() => { void handleApply() }}
                  disabled={applying}
                  className="gap-1.5 text-sm"
                >
                  {applying ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Apply {acceptedCount} Change{acceptedCount !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function ParOptimizerPage() {
  return <ParOptimizerContent />
}
