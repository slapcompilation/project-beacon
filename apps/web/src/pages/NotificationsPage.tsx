// Layer: Eye — Notification centre
// Sprint B UX: layer-grouped tab bar (Eye / Flow / Floor) and layer-grouped
// list sections in "All" view. Notifications are decision triggers, not passive receipts.
// Palantir principle: progressive disclosure with layer-awareness.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, BellOff, CheckCheck, Loader2, AlertTriangle,
  PackageX, CalendarX, ClipboardList, Zap, Trash2, Download,
  Filter, ShieldAlert, Scale,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { useDateFormat } from '@/features/user/hooks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { exportToCsv } from '@/lib/csv'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/features/notifications/hooks'
import type { Notification } from '@beacon/types'

// ─── Type config ───────────────────────────────────────────────────────────────

type NotifType = Notification['type']

type NotifLayer = 'Eye' | 'Flow' | 'Floor' | 'Mind'

const TYPE_CFG: Record<NotifType, {
  label: string
  layer: NotifLayer
  icon: React.ElementType
  rowBg: string
  iconColor: string
  badgeCls: string
  actionPath: string
  actionLabel: string
}> = {
  low_stock: {
    label: 'Low Stock',
    layer: 'Eye',
    icon: PackageX,
    rowBg: 'bg-orange-50/60 dark:bg-orange-950/20',
    iconColor: 'text-orange-500',
    badgeCls: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
    actionPath: '/inventory',
    actionLabel: 'View inventory →',
  },
  expiry: {
    label: 'Expiry',
    layer: 'Eye',
    icon: CalendarX,
    rowBg: 'bg-red-50/60 dark:bg-red-950/20',
    iconColor: 'text-red-500',
    badgeCls: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
    actionPath: '/expiry',
    actionLabel: 'View expiry →',
  },
  predicted_outage: {
    label: 'Predicted Outage',
    layer: 'Eye',
    icon: Zap,
    rowBg: 'bg-purple-50/60 dark:bg-purple-950/20',
    iconColor: 'text-purple-500',
    badgeCls: 'border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
    actionPath: '/dashboard',
    actionLabel: 'View forecast →',
  },
  waste_alert: {
    label: 'Waste Alert',
    layer: 'Eye',
    icon: AlertTriangle,
    rowBg: 'bg-yellow-50/50 dark:bg-yellow-950/15',
    iconColor: 'text-yellow-500',
    badgeCls: 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
    actionPath: '/reports',
    actionLabel: 'View waste report →',
  },
  consumption_spike: {
    label: 'Consumption Spike',
    layer: 'Eye',
    icon: Zap,
    rowBg: 'bg-yellow-50/60 dark:bg-yellow-950/20',
    iconColor: 'text-yellow-600',
    badgeCls: 'border-yellow-400 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300',
    actionPath: '/reports',
    actionLabel: 'View consumption →',
  },
  price_drift: {
    label: 'Price Drift',
    layer: 'Eye',
    icon: AlertTriangle,
    rowBg: 'bg-blue-50/60 dark:bg-blue-950/20',
    iconColor: 'text-blue-500',
    badgeCls: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    actionPath: '/negotiation-prep',
    actionLabel: 'View negotiation prep →',
  },
  pos_variance: {
    label: 'POS Variance',
    layer: 'Eye',
    icon: ShieldAlert,
    rowBg: 'bg-red-50/60 dark:bg-red-950/20',
    iconColor: 'text-red-500',
    badgeCls: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
    actionPath: '/fb-intelligence',
    actionLabel: 'View F&B intelligence →',
  },
  po_discrepancy: {
    label: 'Invoice Discrepancy',
    layer: 'Mind',
    icon: Scale,
    rowBg: 'bg-orange-50/60 dark:bg-orange-950/20',
    iconColor: 'text-orange-500',
    badgeCls: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
    actionPath: '/procurement?tab=match',
    actionLabel: 'Review in 3-Way Match →',
  },
  contract_expiry: {
    label: 'Contract Expiring',
    layer: 'Mind',
    icon: Scale,
    rowBg: 'bg-indigo-50/60 dark:bg-indigo-950/20',
    iconColor: 'text-indigo-500',
    badgeCls: 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400',
    actionPath: '/mind?panel=contracts',
    actionLabel: 'View contracts →',
  },
  approval: {
    label: 'Approval',
    layer: 'Flow',
    icon: ClipboardList,
    rowBg: 'bg-blue-50/60 dark:bg-blue-950/20',
    iconColor: 'text-blue-500',
    badgeCls: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    actionPath: '/restocks',
    actionLabel: 'View restocks →',
  },
  system: {
    label: 'System',
    layer: 'Floor',
    icon: Bell,
    rowBg: '',
    iconColor: 'text-muted-foreground',
    badgeCls: 'border-border text-muted-foreground',
    actionPath: '/dashboard',
    actionLabel: 'Dashboard →',
  },
}

// Layer grouping for tab bar
const LAYER_GROUPS: { layer: NotifLayer; types: NotifType[] }[] = [
  { layer: 'Eye',   types: ['predicted_outage', 'expiry', 'low_stock', 'waste_alert', 'consumption_spike', 'price_drift', 'pos_variance'] },
  { layer: 'Mind',  types: ['po_discrepancy'] },
  { layer: 'Flow',  types: ['approval'] },
  { layer: 'Floor', types: ['system'] },
]

const LAYER_COLOR: Record<NotifLayer, string> = {
  Eye:   'text-purple-600 dark:text-purple-400',
  Mind:  'text-indigo-600 dark:text-indigo-400',
  Flow:  'text-blue-600 dark:text-blue-400',
  Floor: 'text-slate-500 dark:text-slate-400',
}

// Urgency order — most critical first
const TYPE_PRIORITY: Record<NotifType, number> = {
  predicted_outage: 0,
  expiry:           1,
  low_stock:        2,
  waste_alert:       3,
  consumption_spike: 4,
  price_drift:       5,
  pos_variance:      6,
  po_discrepancy:    7,
  contract_expiry:   8,
  approval:          9,
  system:           10,
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotifRow({ notif }: { notif: Notification }) {
  const navigate = useNavigate()
  const fmtDate = useDateFormat()
  const markRead = useMarkNotificationRead()
  const cfg = TYPE_CFG[notif.type]
  const Icon = cfg.icon

  const handleClick = () => {
    if (!notif.read) {
      void markRead.mutateAsync({ id: notif.id })
    }
    void navigate(cfg.actionPath)
  }

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!notif.read) void markRead.mutateAsync({ id: notif.id })
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group flex items-start gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-muted/40 border-b last:border-b-0',
        !notif.read && cfg.rowBg,
      )}
    >
      {/* Unread dot */}
      <div className="mt-1 flex-shrink-0 w-2 flex items-center justify-center">
        {!notif.read && (
          <span className="h-2 w-2 rounded-full bg-primary block" />
        )}
      </div>

      {/* Icon */}
      <div className={cn('mt-0.5 flex-shrink-0', cfg.iconColor)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5', cfg.badgeCls)}>
            {cfg.label}
          </Badge>
          <span className={cn('text-sm', notif.read ? 'text-muted-foreground' : 'font-medium')}>
            {notif.message}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span title={`${fmtDate(new Date(notif.timestamp))}, ${format(new Date(notif.timestamp), 'HH:mm')}`}>
            {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
          </span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary">
            {cfg.actionLabel}
          </span>
        </div>
      </div>

      {/* Mark read button */}
      {!notif.read && (
        <button
          type="button"
          onClick={handleMarkRead}
          className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          title="Mark as read"
        >
          <CheckCheck className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabFilter = 'all' | 'unread' | NotifType

export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useNotifications()
  const markAllRead = useMarkAllNotificationsRead()

  const [tab, setTab] = useState<TabFilter>('all')

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  // Build type counts for tab badges
  const typeCounts = useMemo(() => {
    const map: Partial<Record<NotifType, number>> = {}
    for (const n of notifications) {
      if (!n.read) map[n.type] = (map[n.type] ?? 0) + 1
    }
    return map
  }, [notifications])

  // Filtered + sorted by urgency, then by recency
  const filtered = useMemo(() => {
    let list = notifications
    if (tab === 'unread') list = list.filter((n) => !n.read)
    else if (tab !== 'all') list = list.filter((n) => n.type === tab)
    return [...list].sort((a, b) => {
      // Unread before read
      if (!a.read && b.read) return -1
      if (a.read && !b.read) return 1
      // Then by urgency type
      const pa = TYPE_PRIORITY[a.type], pb = TYPE_PRIORITY[b.type]
      if (pa !== pb) return pa - pb
      // Then by recency
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
  }, [notifications, tab])

  const handleExport = () => {
    exportToCsv(`notifications-${format(new Date(), 'yyyy-MM-dd')}`, notifications.map((n) => ({
      type:      n.type,
      message:   n.message,
      timestamp: n.timestamp,
      read:      n.read ? 'yes' : 'no',
    })))
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Eye · Notifications</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : unreadCount > 0
                ? `${String(unreadCount)} unread · ${String(notifications.length)} total`
                : `${String(notifications.length)} notification${notifications.length !== 1 ? 's' : ''} · all read`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={notifications.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void markAllRead.mutateAsync() }}
            disabled={unreadCount === 0 || markAllRead.isPending}
          >
            {markAllRead.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <CheckCheck className="mr-2 h-4 w-4" />}
            Mark all read
          </Button>
        </div>
      </div>

      {/* Tab bar — layer-grouped */}
      <div className="flex items-center gap-1 border-b px-8 py-2 flex-shrink-0 overflow-x-auto bg-muted/10">
        <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1 flex-shrink-0" />
        {/* Base filters */}
        {[
          { id: 'all' as TabFilter,    label: 'All',    badge: undefined },
          { id: 'unread' as TabFilter, label: 'Unread', badge: unreadCount || undefined },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id) }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
              tab === t.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className={cn(
                'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none',
                tab === t.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-red-500 text-white',
              )}>
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        ))}

        {/* Layer-grouped type tabs */}
        {LAYER_GROUPS.map((group) => {
          const visibleTypes = group.types.filter((t) => notifications.some((n) => n.type === t))
          if (visibleTypes.length === 0) return null
          return (
            <div key={group.layer} className="flex items-center gap-1 ml-1">
              <span className={cn('text-[9px] font-semibold uppercase tracking-widest px-1 flex-shrink-0', LAYER_COLOR[group.layer])}>
                {group.layer}
              </span>
              {visibleTypes.map((t) => {
                const cfg   = TYPE_CFG[t]
                const badge = typeCounts[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTab(t) }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
                      tab === t
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {cfg.label}
                    {badge != null && badge > 0 && (
                      <span className={cn(
                        'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none',
                        tab === t ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-red-500 text-white',
                      )}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <BellOff className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Notifications fire automatically when stock falls below par, items approach expiry within 7 days,
              waste events spike, or restocks need approval.
              Run a scan from the Alerts page to generate the first batch.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Trash2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {tab === 'unread' ? 'All caught up — no unread notifications.' : `No ${TYPE_CFG[tab as NotifType]?.label ?? ''} notifications.`}
            </p>
            <button
              type="button"
              onClick={() => { setTab('all') }}
              className="text-xs text-primary hover:underline"
            >
              Show all
            </button>
          </div>
        ) : tab === 'all' ? (
          // Layer-grouped view for "all"
          <div className="px-6 py-4 space-y-6">
            {LAYER_GROUPS.map((group) => {
              const items = filtered.filter((n) => TYPE_CFG[n.type].layer === group.layer)
              if (items.length === 0) return null
              return (
                <div key={group.layer} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[9px] font-semibold uppercase tracking-widest', LAYER_COLOR[group.layer])}>
                      {group.layer}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {items.filter((n) => !n.read).length > 0
                        ? `${String(items.filter((n) => !n.read).length)} unread`
                        : String(items.length)}
                    </span>
                  </div>
                  <div className="rounded-lg overflow-hidden border">
                    {items.map((n) => <NotifRow key={n.id} notif={n} />)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="divide-y">
            <div className="px-6 py-2 bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {tab === 'unread'
                ? `${String(filtered.length)} unread`
                : `${String(filtered.length)} ${TYPE_CFG[tab]?.label ?? tab}`}
            </div>
            <div className="rounded-lg overflow-hidden border mx-6 my-4">
              {filtered.map((n) => (
                <NotifRow key={n.id} notif={n} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
