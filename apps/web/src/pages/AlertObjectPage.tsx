// Layer: Eye — Alert Object Page
// Palantir-pattern: every alert is a navigable entity with full context — what triggered it,
// which node it concerns, how it was resolved, and the operator's feedback.
// Route: /alert/:alertId

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Bell, Package,
  TrendingDown, Truck, FileText, Zap, ShieldAlert,
} from 'lucide-react'
import type { Notification } from '@beacon/types'

// ─── Local types ──────────────────────────────────────────────────────────────

interface AlertWithContext extends Notification {
  product_variants: {
    id: string
    name: string
    sku: string
    current_stock: number
    products: { id: string; name: string } | null
  } | null
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchAlert(alertId: string): Promise<AlertWithContext | null> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, product_variants(id, name, sku, current_stock, products(id, name))')
    .eq('id', alertId)
    .single() as unknown as {
      data: AlertWithContext | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  return data
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AlertType = Notification['type']

const ALERT_META: Record<AlertType, { label: string; icon: React.ElementType; cls: string; dot: string }> = {
  low_stock:          { label: 'Low Stock',           icon: Package,     cls: 'bg-amber-500/10 text-amber-500 border-amber-500/30',   dot: 'bg-amber-500' },
  expiry:             { label: 'Expiry Warning',       icon: AlertTriangle, cls: 'bg-orange-500/10 text-orange-500 border-orange-500/30', dot: 'bg-orange-500' },
  approval:           { label: 'Approval Required',    icon: CheckCircle2,  cls: 'bg-blue-500/10 text-blue-500 border-blue-500/30',     dot: 'bg-blue-500' },
  system:             { label: 'System',               icon: Bell,        cls: 'bg-muted text-muted-foreground border-border',         dot: 'bg-muted-foreground' },
  predicted_outage:   { label: 'Predicted Outage',     icon: TrendingDown, cls: 'bg-red-500/10 text-red-500 border-red-500/30',        dot: 'bg-red-500' },
  waste_alert:        { label: 'Waste Alert',          icon: ShieldAlert,  cls: 'bg-orange-500/10 text-orange-500 border-orange-500/30', dot: 'bg-orange-500' },
  consumption_spike:  { label: 'Consumption Spike',    icon: Zap,         cls: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30', dot: 'bg-yellow-500' },
  price_drift:        { label: 'Price Drift',          icon: FileText,    cls: 'bg-purple-500/10 text-purple-500 border-purple-500/30', dot: 'bg-purple-500' },
  pos_variance:       { label: 'POS Variance',         icon: FileText,    cls: 'bg-purple-500/10 text-purple-500 border-purple-500/30', dot: 'bg-purple-500' },
  po_discrepancy:     { label: 'PO Discrepancy',       icon: Truck,       cls: 'bg-red-500/10 text-red-500 border-red-500/30',         dot: 'bg-red-500' },
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AlertObjectPage() {
  const { alertId } = useParams<{ alertId: string }>()
  const navigate    = useNavigate()

  const { data: alert, isLoading, error } = useQuery({
    queryKey:  ['alert-object', alertId],
    queryFn:   () => fetchAlert(alertId!),
    enabled:   !!alertId,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading alert…
      </div>
    )
  }

  if (error || !alert) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 text-red-500/60" />
        <p className="text-sm">Alert not found or access denied.</p>
        <button type="button" onClick={() => { navigate(-1) }} className="text-xs text-primary hover:underline">← Go back</button>
      </div>
    )
  }

  const meta       = ALERT_META[alert.type]
  const Icon       = meta.icon
  const variantId  = alert.variant_id ?? alert.product_variants?.id ?? null
  const pv         = alert.product_variants
  const productName = pv?.products?.name ?? null
  const variantLabel = productName && pv ? `${productName} · ${pv.name}` : pv?.name ?? null

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
            <div className="flex items-start gap-3">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', meta.cls)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border', meta.cls)}>
                    <span className={cn('inline-block h-1.5 w-1.5 rounded-full mr-1', meta.dot)} />
                    {meta.label}
                  </span>
                  {alert.read ? (
                    <span className="text-[10px] text-muted-foreground">Read</span>
                  ) : (
                    <span className="text-[10px] font-bold text-primary">Unread</span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-foreground leading-snug">{alert.message}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {variantId && variantLabel && (
                    <Link to={`/variant/${variantId}`} className="flex items-center gap-1 hover:text-foreground hover:underline">
                      <Package className="h-3 w-3" />
                      {variantLabel}
                    </Link>
                  )}
                  <span>{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-3xl">

        {/* Message card */}
        <div className={cn('rounded-lg border px-4 py-4', meta.cls)}>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-2">{meta.label}</p>
          <p className="text-sm leading-relaxed">{alert.message}</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</div>
            <div className={cn('text-sm font-semibold', alert.read ? 'text-muted-foreground' : 'text-primary')}>
              {alert.read ? 'Read' : 'Unread'}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Triggered</div>
            <div className="text-xs font-medium">{format(new Date(alert.timestamp), 'dd MMM yyyy')}</div>
            <div className="text-[10px] text-muted-foreground">{format(new Date(alert.timestamp), 'HH:mm')}</div>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</div>
            <div className="text-xs font-medium">{meta.label}</div>
          </div>
        </div>

        {/* Variant context */}
        {pv && variantId && (
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-2.5 border-b">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Related Variant</p>
            </div>
            <Link
              to={`/variant/${variantId}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{variantLabel}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{pv.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-bold tabular-nums',
                  pv.current_stock === 0 ? 'text-red-600' : 'text-foreground',
                )}>
                  {pv.current_stock} in stock
                </span>
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
            </Link>
          </div>
        )}

        {/* Dismissal reason */}
        {alert.dismissed_reason && (
          <div className="rounded-lg border bg-muted/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Dismissal Reason</p>
            <p className="text-xs text-foreground leading-relaxed">{alert.dismissed_reason}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="rounded-lg border bg-card divide-y text-xs">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Alert ID</span>
            <span className="font-mono text-[10px]">{alert.id}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">User</span>
            <span className="font-mono text-[10px]">{alert.user_id}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
