// Layer: Flow — Stock Log Object Page
// Palantir-pattern: every mutation is traceable. This page is the audit record for a single
// stock movement — who did it, why, what changed, and whether it was reverted.
// Route: /log/:logId
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Button,
  Callout,
  Card,
  Icon,
  Intent,
  NonIdealState,
  Tag,
} from '@blueprintjs/core'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { StockLog } from '@beacon/types'
import { GraphConnections } from '@/components/GraphConnections'
import { ObjectActions } from '@/components/ObjectActions'
import { ObjectViewFrame } from '@/components/ObjectViewFrame'
import { OBJECT_PRESENTATION } from '@/lib/objectPresentation'
import { Metric } from '@/components/MetricStrip'
import { AuditRail } from '@/components/AuditRail'

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
  // stock_logs.user_id has no FK (it points at auth.users), so PostgREST can't
  // embed profiles — the old inline embed errored the whole query and every
  // log page rendered "not found". Fetch the email separately instead.
  const { data, error } = await supabase
    .from('stock_logs')
    .select(`
      *,
      product_variants(id, name, sku, products(id, name)),
      reverted_log:revert_of(id, quantity_change, reason, timestamp)
    `)
    .eq('id', logId)
    .single() as unknown as {
      data: StockLogWithContext | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  if (data?.user_id) {
    const { data: prof } = await supabase.from('profiles').select('email').eq('id', data.user_id).maybeSingle() as unknown as
      { data: { email: string } | null }
    if (prof?.email) data.user_profiles = { email: prof.email }
  }
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
    queryFn:   () => fetchStockLog(logId ?? ''),
    enabled:   !!logId,
    staleTime: 60_000,
  })

  const { data: revertsOf = [] } = useQuery({
    queryKey:  ['log-reverts-of', logId],
    queryFn:   () => fetchRevertsOfLog(logId ?? ''),
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
      <NonIdealState
        icon="warning-sign"
        title="Log entry not found"
        description="Log entry not found or access denied."
        action={
          <Button variant="minimal" intent={Intent.PRIMARY} onClick={() => { void navigate(-1) }}>
            ← Go back
          </Button>
        }
      />
    )
  }

  const isPositive = log.quantity_change > 0
  const isRevert   = log.is_revert
  const productName = log.product_variants?.products?.name ?? 'Unknown product'
  const variantName = log.product_variants?.name ?? 'Unknown variant'
  const variantId   = log.product_variants?.id ?? null

  const headerIconName = isRevert ? 'undo' : isPositive ? 'trending-up' : 'trending-down'

  return (
    <ObjectViewFrame
      header={{
        breadcrumb: variantId ? { label: `${productName} · ${variantName}`, to: `/variant/${variantId}` } : OBJECT_PRESENTATION.stock_log.home,
        icon: headerIconName,
        title: `${isPositive ? '+' : ''}${log.quantity_change} → ${log.balance_after} remaining`,
        star: { id: `stock_log:${log.id}`, label: `${isPositive ? '+' : ''}${log.quantity_change} · ${variantName}`, subtitle: 'Stock log', path: `/log/${log.id}`, icon: headerIconName },
        tags: (
          <>
            {isRevert && <Tag intent={Intent.PRIMARY} minimal icon="undo">REVERT</Tag>}
            <Tag minimal icon="user">{log.user_profiles?.email ?? log.user_id}</Tag>
          </>
        ),
        id: log.id,
      }}

      metrics={
        <>
        <Metric label="Delta" value={`${isPositive ? '+' : ''}${log.quantity_change}`} accent={isPositive ? 'green' : 'red'} />
        <Metric label="Balance After" value={log.balance_after} />
        <Metric label="Timestamp" value={format(new Date(log.timestamp), 'dd MMM yyyy')} sub={format(new Date(log.timestamp), 'HH:mm:ss')} />
        <Metric label="Source" value={log.was_offline ? 'Offline sync' : 'Live'} sub={formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })} />
        </>
      }
      rail={<AuditRail nodeType="stock_log" nodeId={log.id} />}
    >

        {/* Reason */}
        <Card compact className="!bg-muted/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reason</p>
          <p className="text-sm text-foreground leading-relaxed">{log.reason || '—'}</p>
          {log.category && (
            <p className={cn('text-xs font-medium mt-1', CATEGORY_COLORS[log.category] ?? 'text-muted-foreground')}>
              Category: {log.category}
            </p>
          )}
        </Card>

        {/* Revert chain */}
        {isRevert && log.reverted_log && (
          <Callout intent={Intent.PRIMARY} icon="undo" title="Compensating Transaction" compact>
            <p>This log reverts an earlier entry.</p>
            <Link
              to={`/log/${log.reverted_log.id}`}
              className="flex items-center gap-2 mt-1 hover:underline"
            >
              <Icon icon="chevron-right" size={12} />
              View original: {isPositive ? '' : '+'}{-log.reverted_log.quantity_change} · {log.reverted_log.reason}
            </Link>
          </Callout>
        )}

        {revertsOf.length > 0 && (
          <Callout intent={Intent.WARNING} icon="warning-sign" compact title={`Reverted By (${revertsOf.length})`}>
            <div className="space-y-1">
              {revertsOf.map((r) => (
                <Link
                  key={r.id}
                  to={`/log/${r.id}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Icon icon="chevron-right" size={12} />
                  {r.quantity_change > 0 ? '+' : ''}{r.quantity_change} · {r.reason} · {formatDistanceToNow(new Date(r.timestamp), { addSuffix: true })}
                </Link>
              ))}
            </div>
          </Callout>
        )}

        {/* Photo */}
        {log.photo_url && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Icon icon="camera" size={12} />
              Photo Evidence
            </p>
            <img
              src={log.photo_url}
              alt="Stock adjustment photo"
              className="max-w-sm rounded border object-cover"
            />
          </div>
        )}

        {/* Metadata */}
        <Card compact className="!p-0 divide-y text-xs">
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
                <Icon icon="chevron-right" size={12} />
              </Link>
            </div>
          )}
        </Card>

        {/* ── Inline actions ── */}
        {variantId && (
          <Card>
            <ObjectActions
              nodeType="stock_log"
              logId={log.id}
              variantId={variantId}
              isRevert={isRevert}
            />
          </Card>
        )}

        {/* ── Graph connections ── */}
        <Card>
          <GraphConnections nodeType="stock_log" nodeId={log.id} />
        </Card>
    </ObjectViewFrame>
  )
}
