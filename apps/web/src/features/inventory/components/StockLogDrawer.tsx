// Layer: Flow — variant stock history + Reality Graph flow timeline
// Shows the immutable stock_log audit trail and the causal edge graph
// (consumes, reverts, restocks) for the selected variant.

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { useDateFormat } from '@/features/user/hooks'
import { RotateCcw, TrendingUp, TrendingDown, RefreshCw, BarChart2 } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useStockLogs, useUndoStock } from '../hooks'
import { FlowGraph } from '@/features/graph'
import { useAuthStore } from '@/stores/auth.store'
import { hasPermission } from '@beacon/types'
import type { ProductWithVariants, StockLog } from '@beacon/types'


// ─── Recharts constants (hoisted to avoid re-renders from new object refs) ───

const CHART_MARGIN = { top: 4, right: 4, left: -20, bottom: 0 }
const AXIS_TICK    = { fontSize: 10 }
const TOOLTIP_STYLE = { fontSize: 12, borderRadius: 6 }
const tooltipFormatter = (v: unknown) => [String(v ?? ''), 'Balance']

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  product: ProductWithVariants
}


// ─── Stock Chart ──────────────────────────────────────────────────────────────

function StockChart({ logs }: { logs: StockLog[] }) {
  const fmtDate = useDateFormat()
  // Build a point series from newest→oldest logs (logs are desc, reverse for chart)
  const chartData = useMemo(() => {
    const ordered = [...logs].reverse()
    return ordered.map((l) => ({
      date: fmtDate(new Date(l.timestamp)),
      balance: l.balance_after,
    }))
  }, [logs, fmtDate])

  const kpis = useMemo(() => {
    let totalIn = 0
    let totalOut = 0
    for (const l of logs) {
      if (l.is_revert) continue
      if (l.quantity_change > 0) totalIn += l.quantity_change
      else totalOut += Math.abs(l.quantity_change)
    }
    return { totalIn, totalOut, net: totalIn - totalOut }
  }, [logs])

  if (logs.length < 2) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Need at least 2 log entries to show a chart.
      </p>
    )
  }

  return (
    <div className="space-y-5 py-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Received', value: `+${String(kpis.totalIn)}`, color: 'text-green-700' },
          { label: 'Consumed', value: `-${String(kpis.totalOut)}`, color: 'text-red-700' },
          { label: 'Net', value: kpis.net >= 0 ? `+${String(kpis.net)}` : String(kpis.net), color: kpis.net >= 0 ? 'text-green-700' : 'text-red-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border p-3 text-center">
            <p className={cn('text-lg font-bold tabular-nums', color)}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Balance chart */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Stock balance over time</p>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={tooltipFormatter}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#balanceGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export function StockLogDrawer({ open, onClose, product }: Props) {
  const role = useAuthStore((s) => s.role)
  const canUndo = role ? hasPermission(role, 'can_undo_logs') : false
  const fmtDate = useDateFormat()

  const [tab, setTab] = useState<'logs' | 'flow' | 'chart'>('logs')
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.product_variants[0].id
  )

  const selectedVariant =
    product.product_variants.find((v) => v.id === selectedVariantId) ??
    product.product_variants[0]

  const { data: logs = [], isLoading } = useStockLogs(open ? selectedVariantId : null)
  const undoStock = useUndoStock()

  const handleUndo = async (logId: string) => {
    await undoStock.mutateAsync(logId)
  }

  const hasMultipleVariants = product.product_variants.length > 1

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { onClose() } }}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-base">Stock History — {product.name}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Current stock: <span className="font-semibold text-foreground">{selectedVariant.current_stock}</span>
          </p>

          {/* Variant selector — shown only when there are multiple variants */}
          {hasMultipleVariants && (
            <div className="flex flex-wrap gap-1 mt-2">
              {product.product_variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setSelectedVariantId(v.id) }}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border',
                    v.id === selectedVariantId
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  )}
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => { setTab('logs') }}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                tab === 'logs'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Audit Log
            </button>
            <button
              onClick={() => { setTab('flow') }}
              className={cn(
                'flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition-colors',
                tab === 'flow'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <RefreshCw className="h-3 w-3" />
              Flow Graph
            </button>
            <button
              onClick={() => { setTab('chart') }}
              className={cn(
                'flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition-colors',
                tab === 'chart'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <BarChart2 className="h-3 w-3" />
              Chart
            </button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          {/* ── Audit Log tab ─────────────────────────────────────── */}
          {tab === 'logs' && (
            <>
              {isLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  Loading…
                </div>
              )}

              {!isLoading && logs.length === 0 && (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  No adjustments yet
                </div>
              )}

              {!isLoading && logs.length > 0 && (
                <div className="py-4 space-y-0">
                  {logs.map((log, i) => {
                    const isPositive = log.quantity_change > 0
                    const alreadyReverted = logs.some((l) => l.revert_of === log.id)
                    const canUndoThis = canUndo && !log.is_revert && !alreadyReverted

                    return (
                      <div key={log.id}>
                        <div className="flex items-start gap-3 py-3">
                          {/* Icon */}
                          <div
                            className={cn(
                              'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                              log.is_revert
                                ? 'bg-slate-100 text-slate-500'
                                : isPositive
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-red-100 text-red-600'
                            )}
                          >
                            {log.is_revert ? (
                              <RotateCcw className="h-3.5 w-3.5" />
                            ) : isPositive ? (
                              <TrendingUp className="h-3.5 w-3.5" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span
                                className={cn(
                                  'text-sm font-semibold',
                                  log.is_revert
                                    ? 'text-muted-foreground'
                                    : isPositive
                                      ? 'text-green-700'
                                      : 'text-red-700'
                                )}
                              >
                                {isPositive ? '+' : ''}
                                {log.quantity_change}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Balance: {log.balance_after}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-sm text-foreground">{log.reason}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{`${fmtDate(new Date(log.timestamp))} · ${format(new Date(log.timestamp), 'HH:mm')}`}</span>
                              {log.is_revert && (
                                <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs">
                                  undo
                                </span>
                              )}
                              {alreadyReverted && !log.is_revert && (
                                <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs text-muted-foreground">
                                  undone
                                </span>
                              )}
                              <Link to={`/log/${log.id}`} className="ml-auto text-primary hover:underline text-[10px]">
                                View →
                              </Link>
                            </p>
                            {log.photo_url && (
                              <a
                                href={log.photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1.5 inline-block"
                              >
                                <img
                                  src={log.photo_url}
                                  alt="adjustment photo"
                                  className="h-16 w-16 rounded-md object-cover border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            )}
                          </div>

                          {/* Undo button */}
                          {canUndoThis && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              disabled={undoStock.isPending}
                              onClick={() => { void handleUndo(log.id) }}
                            >
                              Undo
                            </Button>
                          )}
                        </div>
                        {i < logs.length - 1 && <Separator />}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Flow Graph tab ────────────────────────────────────── */}
          {tab === 'flow' && (
            <div className="py-4">
              <p className="mb-3 text-xs text-muted-foreground">
                Causal edges in the Reality Graph for this variant.
              </p>
              <FlowGraph
                variantId={selectedVariantId}
                variantName={selectedVariant.name}
              />
            </div>
          )}

          {/* ── Chart tab ─────────────────────────────────────────── */}
          {tab === 'chart' && (
            <div className="px-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  Loading…
                </div>
              ) : (
                <StockChart logs={logs} />
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
