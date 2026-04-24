import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { subHours } from 'date-fns'
import {
  AlertTriangle, ChevronDown, ChevronRight,
  Users, ArrowUp, RotateCcw, Flame, Loader2, Package,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useShiftActivity } from '@/features/inventory/hooks/reports'
import { useProducts } from '@/features/inventory/hooks'
import { useTeamMembers } from '@/features/team/hooks'
import { useConsumptionForecast } from '@/features/eye/hooks'
import { useRestockRequests } from '@/features/restock/hooks'
import { Section, Row } from './Section'
import { SummaryStrip } from './SummaryStrip'

export function ShiftActivity({
  windowHours, setWindowHours, currency,
}: {
  windowHours: 8 | 12 | 24 | 48
  setWindowHours: (v: 8 | 12 | 24 | 48) => void
  currency: string
}) {
  const navigate = useNavigate()
  const [shiftOpen, setShiftOpen] = useState(false)
  const since = useMemo(() => subHours(new Date(), windowHours).toISOString(), [windowHours])

  const { data: logs = [], isLoading }  = useShiftActivity(since)
  const { data: members = [] }          = useTeamMembers()
  const { data: forecast = [] }         = useConsumptionForecast(7)
  const { data: restocks = [] }         = useRestockRequests()
  const { data: products = [] }         = useProducts()

  const emailMap = useMemo(() => new Map(members.map((m) => [m.id, m.email])), [members])

  const costMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) for (const v of p.product_variants) m.set(v.id, v.cost)
    return m
  }, [products])

  const nonReverts  = logs.filter((l) => !l.is_revert)
  const additions   = nonReverts.filter((l) => l.quantity_change > 0)
  const writeOffs   = nonReverts.filter((l) => l.quantity_change < 0 && l.removal_category)
  const corrections = logs.filter((l) => l.is_revert)

  const staffBreakdown = useMemo(() => {
    const map = new Map<string, { email: string; added: number; removed: number; events: number }>()
    for (const l of nonReverts) {
      const key   = l.user_id ?? '__unknown__'
      const email = l.user_id ? (emailMap.get(l.user_id) ?? l.user_id.slice(0, 8) + '…') : 'System'
      const prev  = map.get(key) ?? { email, added: 0, removed: 0, events: 0 }
      map.set(key, { email, events: prev.events + 1, added: prev.added + (l.quantity_change > 0 ? l.quantity_change : 0), removed: prev.removed + (l.quantity_change < 0 ? Math.abs(l.quantity_change) : 0) })
    }
    return [...map.values()].sort((a, b) => b.events - a.events)
  }, [nonReverts, emailMap])

  const criticalForecasts = useMemo(() =>
    forecast.filter((f) => f.days_until_zero !== null && f.days_until_zero <= 3)
      .sort((a, b) => (a.days_until_zero ?? 99) - (b.days_until_zero ?? 99)),
    [forecast],
  )

  const pendingRestocks = useMemo(() => restocks.filter((r) => r.status === 'pending'), [restocks])

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={() => { setShiftOpen((v) => !v) }}
        className="flex w-full items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <Flame className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-sm font-semibold text-muted-foreground">
          Shift Activity · last {windowHours}h
        </span>
        {isLoading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          : <span className="text-xs text-muted-foreground tabular-nums">{nonReverts.length} events</span>}
        {shiftOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {shiftOpen && (
        <div className="p-4 space-y-4 bg-muted/5">
          <div className="flex items-center gap-1">
            {([8, 12, 24, 48] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => { setWindowHours(h) }}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded border transition-colors',
                  windowHours === h ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {h}h
              </button>
            ))}
          </div>

          <SummaryStrip logs={logs} currency={currency} costMap={costMap} />

          <div className="space-y-3">
            {staffBreakdown.length > 0 && (
              <Section icon={Users} title="Staff activity" count={staffBreakdown.length} defaultOpen>
                {staffBreakdown.map((s) => (
                  <Row key={s.email}>
                    <span className="flex-1 text-xs font-medium truncate">{s.email}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{s.events} events</span>
                    <span className="text-xs text-green-600 dark:text-green-400 tabular-nums">+{s.added}</span>
                    <span className="text-xs text-red-600 dark:text-red-400 tabular-nums">−{s.removed}</span>
                  </Row>
                ))}
              </Section>
            )}

            {additions.length > 0 && (
              <Section icon={ArrowUp} title="Stock added" count={additions.length} accent="text-green-500" defaultOpen={false}>
                {additions.map((l) => {
                  const name = l.variant_name !== 'Standard' ? `${l.product_name} — ${l.variant_name}` : l.product_name
                  const costImpact = costMap.get(l.variant_id)
                  return (
                    <Row key={l.id}>
                      <button
                        type="button"
                        onClick={() => { void navigate(`/flow?panel=timeline&variant=${l.variant_id}`) }}
                        className="flex-1 text-xs truncate text-left hover:text-primary transition-colors"
                      >
                        {name}
                      </button>
                      {costImpact != null && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {formatCurrency(costImpact * l.quantity_change, currency)}
                        </span>
                      )}
                      <span className="text-xs text-green-600 dark:text-green-400 tabular-nums font-semibold">
                        +{l.quantity_change}
                      </span>
                    </Row>
                  )
                })}
              </Section>
            )}

            {writeOffs.length > 0 && (
              <Section icon={AlertTriangle} title="Write-offs" count={writeOffs.length} accent="text-orange-500" defaultOpen>
                {writeOffs.map((l) => {
                  const name = l.variant_name !== 'Standard' ? `${l.product_name} — ${l.variant_name}` : l.product_name
                  const costImpact = costMap.get(l.variant_id)
                  return (
                  <Row key={l.id}>
                    <button
                      type="button"
                      onClick={() => { void navigate(`/flow?panel=timeline&variant=${l.variant_id}`) }}
                      className="flex-1 text-xs truncate text-left hover:text-primary transition-colors"
                    >
                      {name}
                    </button>
                    <Badge variant="outline" className="text-[10px] h-4">{l.removal_category}</Badge>
                    {costImpact != null && (
                      <span className="text-[11px] text-red-600 dark:text-red-400 tabular-nums">
                        -{formatCurrency(costImpact * Math.abs(l.quantity_change), currency)}
                      </span>
                    )}
                    <span className="text-xs text-orange-600 dark:text-orange-400 tabular-nums font-semibold">
                      −{Math.abs(l.quantity_change)}
                    </span>
                  </Row>
                  )
                })}
              </Section>
            )}

            {corrections.length > 0 && (
              <Section icon={RotateCcw} title="Corrections / reverts" count={corrections.length} accent="text-amber-500" defaultOpen={false}>
                {corrections.map((l) => {
                  const name = l.variant_name !== 'Standard' ? `${l.product_name} — ${l.variant_name}` : l.product_name
                  return (
                  <Row key={l.id}>
                    <button
                      type="button"
                      onClick={() => { void navigate(`/flow?panel=timeline&variant=${l.variant_id}`) }}
                      className="flex-1 text-xs truncate text-left hover:text-primary transition-colors"
                    >
                      {name}
                    </button>
                    <span className={cn('text-xs tabular-nums font-semibold', l.quantity_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                      {l.quantity_change > 0 ? '+' : ''}{l.quantity_change}
                    </span>
                  </Row>
                  )
                })}
              </Section>
            )}

            {criticalForecasts.length > 0 && (
              <Section icon={AlertTriangle} title="Running out soon" count={criticalForecasts.length} accent="text-red-500" defaultOpen>
                {criticalForecasts.map((f) => {
                  const name = f.variant_name !== 'Standard' ? `${f.product_name} — ${f.variant_name}` : f.product_name
                  return (
                  <Row key={f.variant_id}>
                    <button
                      type="button"
                      onClick={() => { void navigate(`/flow?panel=approvals`) }}
                      className="flex-1 text-xs truncate text-left hover:text-primary transition-colors"
                    >
                      {name}
                    </button>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{f.current_stock} on hand</span>
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
                      ~{f.days_until_zero}d
                    </span>
                  </Row>
                  )
                })}
              </Section>
            )}

            {pendingRestocks.length > 0 && (
              <Section icon={Package} title="Pending restocks" count={pendingRestocks.length} defaultOpen={false}>
                {pendingRestocks.map((r) => {
                  const productName = r.product_variants?.products?.name ?? 'Unknown'
                  const variantName = r.product_variants?.name
                  const name = variantName && variantName !== 'Standard' ? `${productName} — ${variantName}` : productName
                  return (
                  <Row key={r.id}>
                    <button
                      type="button"
                      onClick={() => { void navigate('/flow?panel=approvals') }}
                      className="flex-1 text-xs truncate text-left hover:text-primary transition-colors"
                    >
                      {name}
                    </button>
                    <span className="text-xs text-muted-foreground tabular-nums">{r.quantity_needed} needed</span>
                    {r.supplier && <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">{r.supplier}</span>}
                  </Row>
                  )
                })}
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
