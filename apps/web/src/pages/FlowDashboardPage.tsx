// Layer: Flow — Approval Operations Dashboard
// Palantir principle: decision support, not data display.
// This page answers: what needs my sign-off, how fast is the queue moving,
// and is spend trending up or down? All three questions resolved in one view.

import { useMemo } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  ShieldCheck, ShieldAlert, Clock, TrendingUp, AlertTriangle,
  Loader2, CheckCircle2, XCircle, ArrowUpRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useAuthStore } from '@/stores/auth.store'
import { hasPermission } from '@beacon/types'
import {
  useRestockRequests,
  useApproveRestock,
  useRejectRestock,
  useApprovalVelocity,
  useSpendTrend,
} from '@/features/restock/hooks'
import type { RestockRequestRow } from '@/features/restock/api'

// ─── Tier config ───────────────────────────────────────────────────────────────

const TIER_CFG = {
  none:     { label: 'Auto',     icon: CheckCircle2, cls: 'border-border text-muted-foreground' },
  manager:  { label: 'Manager',  icon: ShieldCheck,  cls: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' },
  director: { label: 'Director', icon: ShieldAlert,  cls: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
} as const

// ─── Pending queue row ─────────────────────────────────────────────────────────

function PendingRow({
  req,
  currency,
  canApprove,
}: {
  req: RestockRequestRow
  currency: string
  canApprove: boolean
}) {
  const approve = useApproveRestock()
  const reject  = useRejectRestock()

  const pv  = req.product_variants
  const tier = req.required_approval_tier
  const cfg  = TIER_CFG[tier]
  const Icon = cfg.icon

  const createdAt  = new Date(req.date)
  const ageLabel   = formatDistanceToNow(createdAt, { addSuffix: true })
  const ageHours   = (Date.now() - createdAt.getTime()) / 3_600_000
  const isStale    = ageHours > 12
  const escalated  = req.escalation_count > 0

  const productName = pv?.products?.name ?? '—'
  const variantName = pv?.name && pv.name !== 'Standard'
    ? `${productName} — ${pv.name}`
    : productName

  return (
    <TableRow className={cn(escalated && 'bg-orange-50/40 dark:bg-orange-950/10')}>
      <TableCell>
        <p className="text-sm font-medium">{variantName}</p>
        <p className="text-[11px] text-muted-foreground font-mono">{pv?.sku ?? '—'}</p>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 font-semibold gap-1', cfg.cls)}>
          <Icon className="h-2.5 w-2.5" />
          {cfg.label}
        </Badge>
        {escalated && (
          <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5 font-medium">
            Escalated ×{String(req.escalation_count)}
          </p>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{req.quantity_needed}</TableCell>
      <TableCell className={cn('text-right tabular-nums font-semibold text-sm', req.estimated_cost ? '' : 'text-muted-foreground')}>
        {req.estimated_cost != null ? formatCurrency(req.estimated_cost, currency) : '—'}
      </TableCell>
      <TableCell className={cn('text-right text-xs tabular-nums', isStale && 'text-orange-600 dark:text-orange-400 font-medium')}>
        {isStale && <AlertTriangle className="inline h-3 w-3 mr-1" />}
        {ageLabel}
      </TableCell>
      <TableCell className="text-right">
        {canApprove ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2 text-green-700 border-green-300 hover:bg-green-50"
              disabled={approve.isPending}
              onClick={() => { approve.mutate({ id: req.id }) }}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={reject.isPending}
              onClick={() => { reject.mutate({ id: req.id }) }}
            >
              <XCircle className="h-3 w-3 mr-1" />Reject
            </Button>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">No permission</span>
        )}
      </TableCell>
    </TableRow>
  )
}

// Recharts constants (stable references prevent unnecessary chart re-renders)
const BAR_MARGIN = { top: 4, right: 4, bottom: 0, left: 0 }
const SMALL_TICK = { fontSize: 10 }
const TOOLTIP_STYLE = { fontSize: 11, border: '1px solid hsl(var(--border))' }
const LEGEND_STYLE = { fontSize: 10 }

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FlowDashboardPage() {
  const currency = useCurrency()
  const role     = useAuthStore((s) => s.role ?? 'limited_access')

  const { data: requests = [], isLoading: reqLoading }    = useRestockRequests()
  const { data: velocity = [], isLoading: velLoading }    = useApprovalVelocity(30)
  const { data: spendTrend = [], isLoading: trendLoading } = useSpendTrend(6)

  const canApproveManager  = hasPermission(role, 'can_approve_restocks')
  const canApproveDirector = role === 'owner'

  // Pending queue: manager + director tier only, oldest first
  const pending = useMemo(
    () =>
      (requests)
        .filter((r) => r.status === 'pending_manager' || r.status === 'pending_director')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [requests],
  )

  const pendingManager  = pending.filter((r) => r.status === 'pending_manager')
  const pendingDirector = pending.filter((r) => r.status === 'pending_director')
  const escalated       = pending.filter((r) => r.escalation_count > 0)

  const totalPendingValue = pending.reduce((s, r) => s + (r.estimated_cost ?? 0), 0)

  // Velocity stats for quick summary
  const managerVel  = velocity.find((v) => v.required_approval_tier === 'manager')
  const directorVel = velocity.find((v) => v.required_approval_tier === 'director')

  // Spend chart data — "Estimated" is qty_needed × cost at creation time;
  // "Actual received" is sum of quantity_received × unit_cost from restock_receives.
  const chartData = spendTrend.map((row) => ({
    month: format(new Date(row.month), 'MMM yy'),
    'Estimated': row.total_estimated ?? 0,
    'Actual received': row.actual_fulfilled ?? 0,
  }))

  const isLoading = reqLoading || velLoading || trendLoading

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Flow · Approval Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : pending.length === 0
                ? 'No requests awaiting approval'
                : `${String(pending.length)} request${pending.length !== 1 ? 's' : ''} pending · ${formatCurrency(totalPendingValue, currency)} at stake`}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { window.location.href = '/restocks' }}
          className="gap-1.5"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          Open Kanban
        </Button>
      </div>

      {/* Stats strip */}
      <div className="flex items-stretch gap-0 border-b flex-shrink-0">
        {[
          {
            label: 'Awaiting manager',
            value: String(pendingManager.length),
            sub: formatCurrency(pendingManager.reduce((s, r) => s + (r.estimated_cost ?? 0), 0), currency),
            accent: pendingManager.length > 0 ? 'text-blue-700 dark:text-blue-300' : '',
          },
          {
            label: 'Awaiting director',
            value: String(pendingDirector.length),
            sub: formatCurrency(pendingDirector.reduce((s, r) => s + (r.estimated_cost ?? 0), 0), currency),
            accent: pendingDirector.length > 0 ? 'text-red-700 dark:text-red-400' : '',
          },
          {
            label: 'Escalated',
            value: String(escalated.length),
            sub: 'past timeout',
            accent: escalated.length > 0 ? 'text-orange-700 dark:text-orange-400' : '',
          },
          {
            label: 'Avg approval (mgr)',
            value: managerVel?.avg_hours_to_approve != null
              ? `${String(managerVel.avg_hours_to_approve)}h`
              : '—',
            sub: `${String(managerVel?.approved_count ?? 0)} approved · 30d`,
            accent: '',
          },
          {
            label: 'Avg approval (dir)',
            value: directorVel?.avg_hours_to_approve != null
              ? `${String(directorVel.avg_hours_to_approve)}h`
              : '—',
            sub: `${String(directorVel?.approved_count ?? 0)} approved · 30d`,
            accent: '',
          },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 border-r last:border-r-0 px-6 py-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={cn('text-2xl font-bold tabular-nums mt-1', stat.accent)}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Pending queue */}
        <div className="flex-[3] border-r overflow-y-auto">
          <div className="px-6 py-4 border-b flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Pending Queue</span>
            <span className="ml-auto text-xs text-muted-foreground">Oldest first · inline approve/reject</span>
          </div>

          {reqLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500/60" />
              <p className="text-sm font-medium">Queue is clear</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                No requests are currently awaiting manager or director approval.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Est. cost</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((req) => {
                  const tier = req.required_approval_tier
                  const canApprove =
                    tier === 'director' ? canApproveDirector : canApproveManager
                  return (
                    <PendingRow
                      key={req.id}
                      req={req}
                      currency={currency}
                      canApprove={canApprove}
                    />
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Right: Analytics */}
        <div className="flex-[2] flex flex-col overflow-y-auto">
          {/* Spend trend chart */}
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Spend Trend</span>
              <span className="ml-auto text-[10px] text-muted-foreground">6-month · estimated at creation vs actual received cost</span>
            </div>
            {trendLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <p className="text-sm text-muted-foreground">No spend data yet</p>
                <p className="text-xs text-muted-foreground">Spend trend populates as restock requests are fulfilled</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barGap={2} margin={BAR_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={SMALL_TICK} />
                  <YAxis tick={SMALL_TICK} tickFormatter={(v: number) => formatCurrency(v, currency)} width={56} />
                  <RechartsTooltip
                    formatter={(value) => [formatCurrency(Number(value), currency)]}
                    labelFormatter={(label) => String(label)}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Legend wrapperStyle={LEGEND_STYLE} />
                  <Bar dataKey="Estimated" fill="hsl(217, 91%, 60%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Actual received" fill="hsl(142, 71%, 45%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Approval velocity table */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Approval Velocity</span>
              <span className="ml-auto text-[10px] text-muted-foreground">30-day window</span>
            </div>
            {velLoading ? (
              <div className="flex items-center justify-center h-20 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : velocity.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No approval activity in the last 30 days</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead className="text-right">Avg time</TableHead>
                    <TableHead className="text-right">Escalated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {velocity.map((row) => {
                    const tier = row.required_approval_tier
                    const cfg  = TIER_CFG[tier]
                    const approvalRate = row.total_requests > 0
                      ? Math.round((row.approved_count / row.total_requests) * 100)
                      : 0
                    return (
                      <TableRow key={row.required_approval_tier}>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 font-semibold', cfg.cls)}>
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{row.total_requests}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {row.approved_count}
                          <span className="text-[10px] text-muted-foreground ml-1">({String(approvalRate)}%)</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {row.avg_hours_to_approve != null ? `${String(row.avg_hours_to_approve)}h` : '—'}
                        </TableCell>
                        <TableCell className={cn('text-right tabular-nums text-sm', row.escalated_count > 0 && 'text-orange-600 dark:text-orange-400 font-medium')}>
                          {row.escalated_count}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
