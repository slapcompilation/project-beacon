// Layer: Flow — atomic stocktake session (snapshot → count → commit delta)
// Palantir principle: every delta carries its cost impact.
// Operators see loss/gain magnitude — not just unit counts.
// Commit review panel surfaces variance severity before any write.

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { useDateFormat } from '@/features/user/hooks'
import {
  Search, CheckCircle2, Loader2, ClipboardCheck,
  AlertTriangle, X, Play, TrendingDown, TrendingUp,
  Eye, ChevronRight, ScanLine, Copy, Check, PackageX, Zap,
} from 'lucide-react'
import { useWasteRadar } from '@/features/eye/hooks'
import type { WasteRadarRow } from '@beacon/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  useActiveDraftSession,
  useSessionLines,
  useBeginStocktake,
  useUpdateStocktakeLine,
  useCommitStocktake,
  useCancelStocktake,
} from '@/features/inventory/hooks/stocktake'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/currency'
import type { StocktakeLine } from '@beacon/types'

// ─── Variance helpers ─────────────────────────────────────────────────────────

type VarianceBand = 'gain' | 'loss-minor' | 'loss-significant' | 'matched' | 'uncounted'

function getVarianceBand(line: StocktakeLine): VarianceBand {
  if (line.counted_qty === null) return 'uncounted'
  const delta = line.counted_qty - line.system_qty
  if (delta === 0) return 'matched'
  if (delta > 0) return 'gain'
  const ratio = Math.abs(delta) / Math.max(line.system_qty, 1)
  return ratio >= 0.2 ? 'loss-significant' : 'loss-minor'
}

const BAND_ROW_BG: Record<VarianceBand, string> = {
  'gain':             'bg-green-50/40 dark:bg-green-950/15',
  'loss-significant': 'bg-red-50/60 dark:bg-red-950/20',
  'loss-minor':       'bg-yellow-50/40 dark:bg-yellow-950/15',
  'matched':          'opacity-60',
  'uncounted':        '',
}

// ─── Landing screen (no active session) ──────────────────────────────────────

function NoSessionScreen() {
  const begin = useBeginStocktake()
  const [note, setNote] = useState('')

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <ClipboardCheck className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No active stocktake</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Starting a session snapshots the current stock of every product. Work through the
          count at your own pace — it persists until you commit or cancel.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Input
          placeholder="Optional note (e.g. End of month count)"
          value={note}
          onChange={(e) => { setNote(e.target.value) }}
        />
        <Button
          onClick={() => { begin.mutate(note || undefined) }}
          disabled={begin.isPending}
          className="w-full"
        >
          {begin.isPending
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Play className="mr-2 h-4 w-4" />}
          Begin Stocktake
        </Button>
      </div>
    </div>
  )
}

// ─── Count row input — saves on blur ─────────────────────────────────────────

function CountInput({
  lineId,
  sessionId,
  systemQty,
  countedQty,
}: {
  lineId: string
  sessionId: string
  systemQty: number
  countedQty: number | null
}) {
  const update = useUpdateStocktakeLine()
  const [localValue, setLocalValue] = useState(
    countedQty !== null ? String(countedQty) : ''
  )

  const handleBlur = useCallback(() => {
    const parsed = localValue === '' ? null : parseInt(localValue, 10)
    if (localValue !== '' && (isNaN(parsed ?? NaN) || (parsed ?? -1) < 0)) return
    if (parsed !== countedQty) {
      update.mutate({ lineId, sessionId, countedQty: parsed })
    }
  }, [localValue, countedQty, lineId, sessionId, update])

  const parsed = localValue === '' ? null : parseInt(localValue, 10)
  const isInvalid = localValue !== '' && (isNaN(parsed ?? NaN) || (parsed ?? -1) < 0)
  const delta = parsed !== null && !isNaN(parsed) ? parsed - systemQty : null

  return (
    <div className="flex items-center justify-end gap-3">
      <Input
        type="number"
        min="0"
        step="1"
        placeholder={String(systemQty)}
        value={localValue}
        onChange={(e) => { setLocalValue(e.target.value) }}
        onBlur={handleBlur}
        className={cn(
          'h-8 w-24 text-right',
          isInvalid && 'border-destructive focus-visible:ring-destructive'
        )}
      />
      <span className={cn(
        'w-16 text-right text-sm font-semibold tabular-nums',
        delta === null || delta === 0 ? 'text-muted-foreground' :
        delta > 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'
      )}>
        {delta === null || delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${String(delta)}`}
      </span>
    </div>
  )
}

// ─── Commit review panel ──────────────────────────────────────────────────────

type EnrichedLine = StocktakeLine & { delta: number; costImpact: number; band: VarianceBand }

function CommitReviewPanel({
  lines,
  currency,
  onConfirm,
  onClose,
  isPending,
  wasteRadarMap,
}: {
  lines: EnrichedLine[]
  currency: string
  onConfirm: () => void
  onClose: () => void
  isPending: boolean
  wasteRadarMap: Map<string, WasteRadarRow>
}) {
  const changed = lines.filter((l) => l.band !== 'uncounted' && l.band !== 'matched')
  const sorted = [...changed].sort((a, b) => Math.abs(b.costImpact) - Math.abs(a.costImpact))

  // Count how many loss lines have a correlating waste radar signal
  const wasteCorrelatedCount = sorted.filter(
    (l) => l.delta < 0 && wasteRadarMap.has(l.variant_id)
  ).length

  const totalLoss = changed.filter((l) => l.delta < 0).reduce((s, l) => s + l.costImpact, 0)
  const totalGain = changed.filter((l) => l.delta > 0).reduce((s, l) => s + l.costImpact, 0)
  const netImpact = totalGain + totalLoss // loss is negative
  const significantCount = changed.filter((l) => l.band === 'loss-significant').length

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col border-l bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="font-semibold">Review variances</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {String(changed.length)} changed line{changed.length !== 1 ? 's' : ''} will generate stock adjustments
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cost summary strip */}
        <div className="flex items-center gap-6 border-b px-6 py-3 text-sm bg-muted/30">
          {totalLoss < 0 && (
            <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
              <TrendingDown className="h-3.5 w-3.5" />
              <span className="font-semibold tabular-nums">{formatCurrency(Math.abs(totalLoss), currency)}</span>
              <span className="text-xs text-muted-foreground">loss</span>
            </span>
          )}
          {totalGain > 0 && (
            <span className="flex items-center gap-1.5 text-green-700 dark:text-green-500">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="font-semibold tabular-nums">{formatCurrency(totalGain, currency)}</span>
              <span className="text-xs text-muted-foreground">gain</span>
            </span>
          )}
          <span className={cn(
            'ml-auto font-semibold tabular-nums',
            netImpact < 0 ? 'text-red-700 dark:text-red-400' : netImpact > 0 ? 'text-green-700 dark:text-green-500' : 'text-muted-foreground'
          )}>
            Net {netImpact >= 0 ? '+' : ''}{formatCurrency(netImpact, currency)}
          </span>
        </div>

        {/* Significant variance alert */}
        {significantCount > 0 && (
          <div className="flex items-start gap-2 border-b px-6 py-3 bg-red-50/60 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">{String(significantCount)} significant variance{significantCount !== 1 ? 's' : ''}</span>
              {' '}(≥20% of system stock) — verify before committing.
            </span>
          </div>
        )}

        {/* Waste radar correlation banner */}
        {wasteCorrelatedCount > 0 && (
          <div className="flex items-start gap-2 border-b px-6 py-3 bg-amber-50/60 dark:bg-amber-950/20 text-sm text-amber-700 dark:text-amber-400">
            <Zap className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">Waste radar correlation detected</span>
              {' '}— {wasteCorrelatedCount} loss line{wasteCorrelatedCount !== 1 ? 's' : ''} match active write-off spikes.
              Shrinkage may be ongoing, not a counting error.
            </span>
          </div>
        )}

        {/* Variance lines */}
        <div className="flex-1 overflow-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-green-500/60" />
              <p className="text-sm">All counted quantities match system stock.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">System</TableHead>
                  <TableHead className="text-right">Counted</TableHead>
                  <TableHead className="text-right">Δ Units</TableHead>
                  <TableHead className="text-right">Δ Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((l) => {
                  const pv = l.product_variants
                  const displayName = pv?.products?.name
                    ? (pv.name !== 'Standard' ? `${pv.products.name} — ${pv.name}` : pv.products.name)
                    : pv?.name ?? '—'
                  return (
                    <TableRow
                      key={l.id}
                      className={cn(
                        l.band === 'loss-significant' && 'bg-red-50/50 dark:bg-red-950/20',
                        l.band === 'loss-minor' && 'bg-yellow-50/40 dark:bg-yellow-950/15',
                        l.band === 'gain' && 'bg-green-50/40 dark:bg-green-950/15',
                      )}
                    >
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          {l.band === 'loss-significant' && (
                            <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                          )}
                          <span className="font-medium">{displayName}</span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">{pv?.sku}</span>
                        {(() => {
                          const wr = wasteRadarMap.get(l.variant_id)
                          if (!wr || l.delta >= 0) return null
                          return (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                              <Zap className="h-2.5 w-2.5 shrink-0" />
                              <span>
                                Waste spike: +{String(wr.pct_above_baseline)}% above baseline
                                {wr.occupancy_band === 'low' ? ' · low occupancy — unexplained' : ''}
                                {wr.top_user_email ? ` · top actor: ${wr.top_user_email}` : ''}
                              </span>
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{l.system_qty}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{l.counted_qty}</TableCell>
                      <TableCell className={cn(
                        'text-right tabular-nums font-semibold',
                        l.delta > 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-400'
                      )}>
                        {l.delta > 0 ? '+' : ''}{String(l.delta)}
                      </TableCell>
                      <TableCell className={cn(
                        'text-right tabular-nums font-semibold text-sm',
                        l.costImpact > 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-400'
                      )}>
                        {l.costImpact > 0 ? '+' : ''}{formatCurrency(l.costImpact, currency)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Back to count
          </Button>
          <Button
            className="flex-1"
            variant={significantCount > 0 ? 'destructive' : 'default'}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Commit {String(changed.length)} change{changed.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'uncounted' | 'changed'

function FilterTabs({
  active,
  onChange,
  uncountedCount,
  changedCount,
}: {
  active: FilterTab
  onChange: (t: FilterTab) => void
  uncountedCount: number
  changedCount: number
}) {
  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'uncounted', label: 'Uncounted', count: uncountedCount },
    { key: 'changed', label: 'Changed', count: changedCount },
  ]
  return (
    <div className="flex gap-0.5 rounded-md border p-0.5">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => { onChange(t.key) }}
          className={cn(
            'flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
            active === t.key
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
              active === t.key
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}>
              {String(t.count)}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Post-commit variance report ──────────────────────────────────────────────

function PostCommitReport({
  lines,
  currency,
  onDismiss,
}: {
  lines: EnrichedLine[]
  currency: string
  onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)

  const changed        = lines.filter((l) => l.band !== 'uncounted' && l.band !== 'matched')
  const matched        = lines.filter((l) => l.band === 'matched')
  const uncounted      = lines.filter((l) => l.band === 'uncounted')
  const losses         = changed.filter((l) => l.delta < 0)
  const gains          = changed.filter((l) => l.delta > 0)
  const nowEmpty       = changed.filter((l) => l.counted_qty === 0)
  const significant    = losses.filter((l) => l.band === 'loss-significant')
  const totalLoss      = losses.reduce((s, l) => s + Math.abs(l.costImpact), 0)
  const totalGain      = gains.reduce((s, l) => s + l.costImpact, 0)
  const netImpact      = totalGain - totalLoss
  const sorted         = [...changed].sort((a, b) => Math.abs(b.costImpact) - Math.abs(a.costImpact))

  const getDisplayName = (l: EnrichedLine) => {
    const pv = l.product_variants
    if (!pv) return '—'
    return pv.products?.name
      ? (pv.name !== 'Standard' ? `${pv.products.name} — ${pv.name}` : pv.products.name)
      : pv.name
  }

  const handleCopy = async () => {
    const rows = [
      `STOCKTAKE VARIANCE REPORT`,
      `Generated: ${format(new Date(), 'PPp')}`,
      ``,
      `SUMMARY`,
      `• ${String(lines.length)} lines counted · ${String(changed.length)} variances · ${String(matched.length)} matched · ${String(uncounted.length)} uncounted`,
      totalLoss > 0 ? `• Loss: ${formatCurrency(totalLoss, currency)}` : null,
      totalGain > 0 ? `• Gain: ${formatCurrency(totalGain, currency)}` : null,
      `• Net: ${netImpact >= 0 ? '+' : ''}${formatCurrency(netImpact, currency)}`,
      significant.length > 0 ? `• ⚠  ${String(significant.length)} significant variances (≥20% shrinkage)` : null,
      ``,
      `VARIANCES (sorted by cost impact)`,
      ...sorted.map((l) =>
        `• ${getDisplayName(l)}: ${String(l.system_qty)} → ${String(l.counted_qty ?? '?')} (${l.delta > 0 ? '+' : ''}${String(l.delta)} units · ${l.costImpact >= 0 ? '+' : ''}${formatCurrency(l.costImpact, currency)})`
      ),
      nowEmpty.length > 0 ? `` : null,
      nowEmpty.length > 0 ? `NOW EMPTY — schedule restock:` : null,
      ...nowEmpty.map((l) => `• ${getDisplayName(l)} (${l.product_variants?.sku ?? '—'})`),
      ``,
      `— Beacon Inventory Intelligence`,
    ].filter((s) => s !== null).join('\n')

    await navigator.clipboard.writeText(rows)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2500)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Stocktake committed
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {changed.length} variance{changed.length !== 1 ? 's' : ''} written · {matched.length} matched · {uncounted.length} uncounted
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { void handleCopy() }}>
            {copied
              ? <><Check className="mr-2 h-3.5 w-3.5 text-green-600" />Copied!</>
              : <><Copy className="mr-2 h-3.5 w-3.5" />Copy report</>}
          </Button>
          <Button size="sm" onClick={onDismiss}>
            <Play className="mr-2 h-3.5 w-3.5" />
            New count
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 border-b px-8 py-4 sm:grid-cols-4 flex-shrink-0 bg-muted/10">
        {[
          { label: 'Lines changed',      value: String(changed.length),                                       color: '' },
          { label: 'Total loss',         value: totalLoss > 0 ? formatCurrency(totalLoss, currency) : '—',    color: totalLoss > 0 ? 'text-red-600 dark:text-red-400' : '' },
          { label: 'Total gain',         value: totalGain > 0 ? formatCurrency(totalGain, currency) : '—',    color: totalGain > 0 ? 'text-green-600 dark:text-green-400' : '' },
          {
            label: 'Net impact',
            value: netImpact === 0 ? '—' : `${netImpact > 0 ? '+' : ''}${formatCurrency(netImpact, currency)}`,
            color: netImpact < 0 ? 'text-red-600 dark:text-red-400' : netImpact > 0 ? 'text-green-600 dark:text-green-400' : '',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border bg-card px-3 py-2.5 text-center">
            <p className={cn('text-lg font-bold tabular-nums leading-none', color)}>{value}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Significant alert */}
      {significant.length > 0 && (
        <div className="flex items-start gap-2 border-b px-8 py-3 bg-red-50/60 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400 flex-shrink-0">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">{significant.length} significant variance{significant.length !== 1 ? 's' : ''}</span>
            {' '}(≥20% shrinkage) — investigate before next shift.
          </span>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto px-8 py-5 space-y-6">
        {/* Variance table */}
        {sorted.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Flow · Variances
            </h2>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">System</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Δ Units</TableHead>
                    <TableHead className="text-right">Δ Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((l) => (
                    <TableRow
                      key={l.id}
                      className={cn(
                        l.band === 'loss-significant' && 'bg-red-50/50 dark:bg-red-950/20',
                        l.band === 'loss-minor'       && 'bg-yellow-50/40 dark:bg-yellow-950/15',
                        l.band === 'gain'             && 'bg-green-50/40 dark:bg-green-950/15',
                      )}
                    >
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          {l.band === 'loss-significant' && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                          <span className="font-medium">{getDisplayName(l)}</span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">{l.product_variants?.sku}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{l.system_qty}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{l.counted_qty}</TableCell>
                      <TableCell className={cn(
                        'text-right tabular-nums font-semibold',
                        l.delta > 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-400',
                      )}>
                        {l.delta > 0 ? '+' : ''}{String(l.delta)}
                      </TableCell>
                      <TableCell className={cn(
                        'text-right tabular-nums font-semibold text-sm',
                        l.costImpact > 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-400',
                      )}>
                        {l.costImpact > 0 ? '+' : ''}{formatCurrency(l.costImpact, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Now-empty items */}
        {nowEmpty.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Eye · Now empty — request restock
            </h2>
            <div className="space-y-1.5">
              {nowEmpty.map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-lg border bg-red-50/30 dark:bg-red-950/15 px-3 py-2.5">
                  <PackageX className="h-4 w-4 text-red-500 shrink-0" />
                  <span className="flex-1 text-sm font-medium">{getDisplayName(l)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{l.product_variants?.sku}</span>
                  <span className="text-xs font-semibold text-red-600">0 units</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {changed.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500/60" />
            <p className="text-sm font-medium">Perfect match</p>
            <p className="text-xs text-muted-foreground">Every counted quantity matched the system stock.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Active session screen ────────────────────────────────────────────────────

function ActiveSession({ sessionId, onCommitSuccess }: { sessionId: string; onCommitSuccess: (lines: EnrichedLine[]) => void }) {
  const { data: session } = useActiveDraftSession()
  const { data: lines = [], isLoading } = useSessionLines(sessionId)
  const commit = useCommitStocktake()
  const cancel = useCancelStocktake()
  const currency = useCurrency()
  const fmtDate = useDateFormat()
  const { data: wasteRadarRows = [] } = useWasteRadar()

  // Build O(1) lookup map: variant_id → WasteRadarRow
  const wasteRadarMap = useMemo(
    () => new Map(wasteRadarRows.map((r) => [r.variant_id, r])),
    [wasteRadarRows]
  )

  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [highlightedLineId, setHighlightedLineId] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())

  // Clear scan error after 3s
  useEffect(() => {
    if (!scanError) return
    const t = setTimeout(() => { setScanError(null) }, 3000)
    return () => { clearTimeout(t) }
  }, [scanError])

  // Clear highlight after 2.5s
  useEffect(() => {
    if (!highlightedLineId) return
    const t = setTimeout(() => { setHighlightedLineId(null) }, 2500)
    return () => { clearTimeout(t) }
  }, [highlightedLineId])

  const handleScanToCount = useCallback((raw: string) => {
    const q = raw.trim().toLowerCase()
    if (!q) return
    const match = lines.find((l) => {
      const pv = l.product_variants
      if (!pv) return false
      return (
        pv.sku.toLowerCase() === q ||
        (pv.barcode?.toLowerCase() ?? '') === q ||
        pv.products?.name.toLowerCase().includes(q)
      )
    })
    if (!match) {
      setScanError(`No item found for "${raw}"`)
      return
    }
    // Show all lines, reset filter so the row is visible
    setFilterTab('all')
    setSearch('')
    setHighlightedLineId(match.id)
    setScanInput('')
    // Scroll to the row after a tick (filter state needs to propagate)
    setTimeout(() => {
      rowRefs.current.get(match.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }, [lines])

  // Enrich lines with delta, costImpact, band
  const enriched = useMemo<EnrichedLine[]>(() =>
    lines.map((l) => {
      const delta = l.counted_qty !== null ? l.counted_qty - l.system_qty : 0
      const cost = l.product_variants?.cost ?? 0
      const band = getVarianceBand(l)
      return { ...l, delta, costImpact: delta * cost, band }
    }),
    [lines]
  )

  const uncountedCount = enriched.filter((l) => l.band === 'uncounted').length
  const changedCount = enriched.filter((l) => l.band !== 'uncounted' && l.band !== 'matched').length
  const countedCount = lines.length - uncountedCount

  // Sort: uncounted first → then by cost impact magnitude desc
  const sorted = useMemo(() =>
    [...enriched].sort((a, b) => {
      if (a.band === 'uncounted' && b.band !== 'uncounted') return -1
      if (a.band !== 'uncounted' && b.band === 'uncounted') return 1
      return Math.abs(b.costImpact) - Math.abs(a.costImpact)
    }),
    [enriched]
  )

  const filtered = useMemo(() => {
    let result = sorted
    if (filterTab === 'uncounted') result = result.filter((l) => l.band === 'uncounted')
    if (filterTab === 'changed') result = result.filter((l) => l.band !== 'uncounted' && l.band !== 'matched')

    const q = search.toLowerCase()
    if (!q) return result
    return result.filter((l) => {
      const pv = l.product_variants
      return (
        pv?.products?.name.toLowerCase().includes(q) ||
        pv?.name.toLowerCase().includes(q) ||
        pv?.sku.toLowerCase().includes(q)
      )
    })
  }, [sorted, filterTab, search])

  const handleCommit = async () => {
    const snapshot = [...enriched]
    try {
      await commit.mutateAsync(sessionId)
      setReviewOpen(false)
      onCommitSuccess(snapshot)
    } catch {
      // error surfaced by useCommitStocktake's onError
    }
  }

  const totalLines = lines.length

  return (
    <div className="flex flex-col h-full">
      {/* Commit review panel */}
      {reviewOpen && (
        <CommitReviewPanel
          lines={enriched}
          currency={currency}
          onConfirm={() => { void handleCommit() }}
          onClose={() => { setReviewOpen(false) }}
          isPending={commit.isPending}
          wasteRadarMap={wasteRadarMap}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Flow · Stocktake in progress</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Started {session ? `${fmtDate(new Date(session.started_at))}, ${format(new Date(session.started_at), 'HH:mm')}` : '…'}
            {session?.note ? ` · ${session.note}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress pill */}
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: totalLines > 0 ? `${String((countedCount / totalLines) * 100)}%` : '0%' }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {countedCount} / {totalLines}
            </span>
            {countedCount === totalLines && totalLines > 0 && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { cancel.mutate(sessionId) }}
            disabled={cancel.isPending || commit.isPending}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </Button>

          <Button
            onClick={() => { setReviewOpen(true) }}
            disabled={countedCount === 0 || commit.isPending}
          >
            <Eye className="mr-2 h-4 w-4" />
            Review &amp; Commit
            {changedCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-semibold">
                {String(changedCount)}
              </span>
            )}
            <ChevronRight className="ml-1 h-3.5 w-3.5 opacity-60" />
          </Button>
        </div>
      </div>

      {/* Toolbar: search + scan + filter tabs */}
      <div className="flex items-center justify-between gap-4 border-b px-8 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search product or SKU…"
              value={search}
              onChange={(e) => { setSearch(e.target.value) }}
              className="pl-9"
            />
          </div>

          {/* Scan to Count input — accepts hardware scanner or manual SKU entry */}
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Scan to count…"
              value={scanInput}
              onChange={(e) => { setScanInput(e.target.value) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleScanToCount(scanInput)
                  e.preventDefault()
                }
              }}
              className={cn(
                'pl-9 w-44',
                scanError && 'border-destructive focus-visible:ring-destructive',
              )}
            />
            {scanError && (
              <p className="absolute top-full mt-1 whitespace-nowrap text-[10px] text-destructive">
                {scanError}
              </p>
            )}
          </div>
        </div>

        <FilterTabs
          active={filterTab}
          onChange={setFilterTab}
          uncountedCount={uncountedCount}
          changedCount={changedCount}
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            No lines match the current filter.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">System qty</TableHead>
                  <TableHead className="text-right">Cost / unit</TableHead>
                  <TableHead className="text-right w-52">Counted · Δ units</TableHead>
                  <TableHead className="text-right">Δ Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((line) => {
                  const pv = line.product_variants
                  const displayName = pv?.products?.name
                    ? (pv.name !== 'Standard' ? `${pv.products.name} — ${pv.name}` : pv.products.name)
                    : pv?.name ?? '—'
                  const showCostImpact = line.band !== 'uncounted' && line.band !== 'matched'

                  const isHighlighted = highlightedLineId === line.id

                  return (
                    <TableRow
                      key={line.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(line.id, el)
                        else rowRefs.current.delete(line.id)
                      }}
                      className={cn(
                        BAND_ROW_BG[line.band],
                        isHighlighted && 'ring-2 ring-inset ring-primary bg-primary/5 dark:bg-primary/10',
                      )}
                    >
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-1.5">
                          {line.band === 'loss-significant' && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          )}
                          {isHighlighted && (
                            <ScanLine className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
                          )}
                          {displayName}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {pv?.sku ?? '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {line.system_qty}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {pv ? formatCurrency(pv.cost, currency) : '—'}
                      </TableCell>
                      <TableCell>
                        <CountInput
                          lineId={line.id}
                          sessionId={sessionId}
                          systemQty={line.system_qty}
                          countedQty={line.counted_qty}
                        />
                      </TableCell>
                      <TableCell className={cn(
                        'text-right tabular-nums font-semibold text-sm',
                        !showCostImpact && 'text-muted-foreground font-normal',
                        showCostImpact && line.costImpact > 0 && 'text-green-700 dark:text-green-500',
                        showCostImpact && line.costImpact < 0 && 'text-red-700 dark:text-red-400',
                      )}>
                        {!showCostImpact
                          ? '—'
                          : `${line.costImpact > 0 ? '+' : ''}${formatCurrency(line.costImpact, currency)}`}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StocktakePage() {
  const { data: session, isLoading } = useActiveDraftSession()
  const currency    = useCurrency()

  const [postCommitLines, setPostCommitLines] = useState<EnrichedLine[] | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading…
      </div>
    )
  }

  if (postCommitLines !== null) {
    return (
      <PostCommitReport
        lines={postCommitLines}
        currency={currency}
        onDismiss={() => { setPostCommitLines(null) }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {!session
        ? <NoSessionScreen />
        : (
          <ActiveSession
            sessionId={session.id}
            onCommitSuccess={(lines) => { setPostCommitLines(lines) }}
          />
        )}
    </div>
  )
}
