// Layer: Flow — Stock Log Object Page
// Palantir-pattern: every mutation is traceable. This page is the audit record for a single
// stock movement — who did it, why, what changed, and whether it was reverted.
// Route: /log/:logId

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, RotateCcw, TrendingDown, TrendingUp, Package,
  Camera, AlertTriangle, ChevronRight, User,
} from 'lucide-react'
import type { StockLog } from '@beacon/types'
import { GraphConnections } from '@/components/GraphConnections'

// ─── Local types ──────────────────────────────────────────────────────────────

interface StockLogWithContext extends StockLog {
  product_variants: {
    id: string
    name: string
    sku: string
    products: { id: string; name: string } | null
  } | null
  user_profiles: { email: string } | null
  reverted_log: Pick<StockLog, 'id' | 'quantity_change' | 'reason' | 'timestamp'> | null
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchStockLog(logId: string): Promise<StockLogWithContext | null> {
  const { data, error } = await supabase
    .from('stock_logs')
    .select(`
      *,
      product_variants(id, name, sku, products(id, name)),
      user_profiles:user_id(email),
      reverted_log:revert_of(id, quantity_change, reason, timestamp)
    `)
    .eq('id', logId)
    .single() as unknown as {
      data: StockLogWithContext | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  return data
}

async function fetchRevertsOfLog(logId: string): Promise<Pick<StockLog, 'id' | 'quantity_change' | 'reason' | 'timestamp'>[]> {
  const { data, error } = await supabase
    .from('stock_logs')
    .select('id, quantity_change, reason, timestamp')
    .eq('revert_of', logId) as unknown as {
      data: Pick<StockLog, 'id' | 'quantity_change' | 'reason' | 'timestamp'>[] | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Breakage:               'text-red-500',
  Theft:                  'text-red-600',
  Spoilage:               'text-orange-500',
  Consumed:               'text-blue-500',
  'Returned to supplier': 'text-purple-500',
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StockLogObjectPage() {
  const { logId }  = useParams<{ logId: string }>()
  const navigate   = useNavigate()

  const { data: log, isLoading, error } = useQuery({
    queryKey:  ['stock-log-object', logId],
    queryFn:   () => fetchStockLog(logId!),
    enabled:   !!logId,
    staleTime: 60_000,
  })

  const { data: revertsOf = [] } = useQuery({
    queryKey:  ['log-reverts-of', logId],
    queryFn:   () => fetchRevertsOfLog(logId!),
    enabled:   !!logId,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading log entry…
      </div>
    )
  }

  if (error || !log) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 text-red-500/60" />
        <p className="text-sm">Log entry not found or access denied.</p>
        <button type="button" onClick={() => { navigate(-1) }} className="text-xs text-primary hover:underline">← Go back</button>
      </div>
    )
  }

  const isPositive = log.quantity_change > 0
  const isRevert   = log.is_revert
  const productName = log.product_variants?.products?.name ?? 'Unknown product'
  const variantName = log.product_variants?.name ?? 'Unknown variant'
  const variantId   = log.product_variants?.id ?? null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0 bg-background">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => { void navigate(-1) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5 shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                isRevert ? 'bg-purple-100 dark:bg-purple-950/40' :
                isPositive ? 'bg-emerald-100 dark:bg-emerald-950/40' : 'bg-red-100 dark:bg-red-950/40',
              )}>
                {isRevert
                  ? <RotateCcw className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  : isPositive
                  ? <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  : <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                }
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-2xl font-bold font-mono tabular-nums',
                    isRevert ? 'text-purple-600 dark:text-purple-400' :
                    isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                  )}>
                    {isPositive ? '+' : ''}{log.quantity_change}
                  </span>
                  <span className="text-sm text-muted-foreground">→ {log.balance_after} remaining</span>
                  {isRevert && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-purple-500/10 text-purple-500 border-purple-500/30">
                      REVERT
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  {variantId ? (
                    <Link to={`/variant/${variantId}`} className="flex items-center gap-1 hover:text-foreground hover:underline">
                      <Package className="h-3 w-3" />
                      {productName} · {variantName}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {productName} · {variantName}
                    </span>
                  )}
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {log.user_profiles?.email ?? log.user_id}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-3xl">

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Delta</div>
            <div className={cn(
              'text-xl font-bold font-mono tabular-nums',
              isRevert ? 'text-purple-600' : isPositive ? 'text-emerald-600' : 'text-red-600',
            )}>
              {isPositive ? '+' : ''}{log.quantity_change}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Balance After</div>
            <div className="text-xl font-bold font-mono tabular-nums">{log.balance_after}</div>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Timestamp</div>
            <div className="text-xs font-medium">{format(new Date(log.timestamp), 'dd MMM yyyy')}</div>
            <div className="text-[10px] text-muted-foreground">{format(new Date(log.timestamp), 'HH:mm:ss')}</div>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Source</div>
            <div className="text-xs font-medium">
              {log.was_offline ? 'Offline sync' : 'Live'}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reason</p>
          <p className="text-sm text-foreground leading-relaxed">{log.reason || '—'}</p>
          {log.removal_category && (
            <p className={cn('text-xs font-medium', CATEGORY_COLORS[log.removal_category] ?? 'text-muted-foreground')}>
              Category: {log.removal_category}
            </p>
          )}
        </div>

        {/* Revert chain */}
        {isRevert && log.reverted_log && (
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500">Compensating Transaction</p>
            <p className="text-xs text-muted-foreground">
              This log reverts an earlier entry.
            </p>
            <Link
              to={`/log/${log.reverted_log.id}`}
              className="flex items-center gap-2 text-xs text-purple-500 hover:underline"
            >
              <ChevronRight className="h-3 w-3" />
              View original: {isPositive ? '' : '+'}{-log.reverted_log.quantity_change} · {log.reverted_log.reason}
            </Link>
          </div>
        )}

        {revertsOf.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
              Reverted By ({revertsOf.length})
            </p>
            <div className="space-y-1">
              {revertsOf.map((r) => (
                <Link
                  key={r.id}
                  to={`/log/${r.id}`}
                  className="flex items-center gap-2 text-xs text-amber-500 hover:underline"
                >
                  <ChevronRight className="h-3 w-3" />
                  {r.quantity_change > 0 ? '+' : ''}{r.quantity_change} · {r.reason} · {formatDistanceToNow(new Date(r.timestamp), { addSuffix: true })}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Photo */}
        {log.photo_url && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Camera className="h-3 w-3" />
              Photo Evidence
            </p>
            <img
              src={log.photo_url}
              alt="Stock adjustment photo"
              className="max-w-sm rounded-lg border object-cover"
            />
          </div>
        )}

        {/* Metadata */}
        <div className="rounded-lg border bg-card divide-y text-xs">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Log ID</span>
            <span className="font-mono text-[10px]">{log.id}</span>
          </div>
          {log.sync_batch_id && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Sync Batch</span>
              <span className="font-mono text-[10px]">{log.sync_batch_id}</span>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Actor</span>
            <span>{log.user_profiles?.email ?? log.user_id}</span>
          </div>
          {variantId && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Variant</span>
              <Link to={`/variant/${variantId}`} className="flex items-center gap-1 text-primary hover:underline">
                {productName} · {variantName}
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>

        {/* ── Graph connections ── */}
        <div className="rounded-lg border border-border bg-card p-4">
          <GraphConnections nodeType="stock_log" nodeId={log.id} />
        </div>
      </div>
    </div>
  )
}
