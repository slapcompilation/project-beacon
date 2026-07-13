// Layer: Eye — Notification centre
// Sprint B UX: layer-grouped tab bar (Eye / Flow / Floor) and layer-grouped
// list sections in "All" view. Notifications are decision triggers, not passive receipts.
// Palantir principle: progressive disclosure with layer-awareness.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Button,
  Card,
  Icon,
  Intent,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useDateFormat } from '@/features/user/hooks'
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
  icon: IconName
  rowBg: string
  iconColor: string
  tagIntent: Intent
  actionPath: string
  actionLabel: string
}> = {
  low_stock: {
    label: 'Low Stock',
    layer: 'Eye',
    icon: 'box',
    rowBg: 'bg-orange-50/60 dark:bg-orange-950/20',
    iconColor: 'text-orange-500',
    tagIntent: Intent.WARNING,
    actionPath: '/inventory',
    actionLabel: 'View inventory →',
  },
  expiry: {
    label: 'Expiry',
    layer: 'Eye',
    icon: 'calendar',
    rowBg: 'bg-red-50/60 dark:bg-red-950/20',
    iconColor: 'text-red-500',
    tagIntent: Intent.DANGER,
    actionPath: '/expiry',
    actionLabel: 'View expiry →',
  },
  predicted_outage: {
    label: 'Predicted Outage',
    layer: 'Eye',
    icon: 'flash',
    rowBg: 'bg-purple-50/60 dark:bg-purple-950/20',
    iconColor: 'text-purple-500',
    tagIntent: Intent.PRIMARY,
    actionPath: '/dashboard',
    actionLabel: 'View forecast →',
  },
  waste_alert: {
    label: 'Waste Alert',
    layer: 'Eye',
    icon: 'warning-sign',
    rowBg: 'bg-yellow-50/50 dark:bg-yellow-950/15',
    iconColor: 'text-yellow-500',
    tagIntent: Intent.WARNING,
    actionPath: '/reports',
    actionLabel: 'View waste report →',
  },
  consumption_spike: {
    label: 'Consumption Spike',
    layer: 'Eye',
    icon: 'flash',
    rowBg: 'bg-yellow-50/60 dark:bg-yellow-950/20',
    iconColor: 'text-yellow-600',
    tagIntent: Intent.WARNING,
    actionPath: '/reports',
    actionLabel: 'View consumption →',
  },
  price_drift: {
    label: 'Price Drift',
    layer: 'Eye',
    icon: 'warning-sign',
    rowBg: 'bg-blue-50/60 dark:bg-blue-950/20',
    iconColor: 'text-blue-500',
    tagIntent: Intent.PRIMARY,
    actionPath: '/negotiation-prep',
    actionLabel: 'View negotiation prep →',
  },
  pos_variance: {
    label: 'POS Variance',
    layer: 'Eye',
    icon: 'shield',
    rowBg: 'bg-red-50/60 dark:bg-red-950/20',
    iconColor: 'text-red-500',
    tagIntent: Intent.DANGER,
    actionPath: '/eye',
    actionLabel: 'View F&B intelligence →',
  },
  po_discrepancy: {
    label: 'Invoice Discrepancy',
    layer: 'Mind',
    icon: 'comparison',
    rowBg: 'bg-orange-50/60 dark:bg-orange-950/20',
    iconColor: 'text-orange-500',
    tagIntent: Intent.WARNING,
    actionPath: '/procurement?tab=match',
    actionLabel: 'Review in 3-Way Match →',
  },
  contract_expiry: {
    label: 'Contract Expiring',
    layer: 'Mind',
    icon: 'comparison',
    rowBg: 'bg-indigo-50/60 dark:bg-indigo-950/20',
    iconColor: 'text-indigo-500',
    tagIntent: Intent.PRIMARY,
    actionPath: '/mind?panel=contracts',
    actionLabel: 'View contracts →',
  },
  integration_health: {
    label: 'Data Feed',
    layer: 'Mind',
    icon: 'data-connection',
    rowBg: 'bg-red-50/60 dark:bg-red-950/20',
    iconColor: 'text-red-500',
    tagIntent: Intent.DANGER,
    actionPath: '/mind?aip=monitors',
    actionLabel: 'View monitors →',
  },
  approval: {
    label: 'Approval',
    layer: 'Flow',
    icon: 'clipboard',
    rowBg: 'bg-blue-50/60 dark:bg-blue-950/20',
    iconColor: 'text-blue-500',
    tagIntent: Intent.PRIMARY,
    actionPath: '/restocks',
    actionLabel: 'View restocks →',
  },
  system: {
    label: 'System',
    layer: 'Floor',
    icon: 'notifications',
    rowBg: '',
    iconColor: 'text-muted-foreground',
    tagIntent: Intent.NONE,
    actionPath: '/dashboard',
    actionLabel: 'Dashboard →',
  },
}

// Layer grouping for tab bar
const LAYER_GROUPS: { layer: NotifLayer; types: NotifType[] }[] = [
  { layer: 'Eye',   types: ['predicted_outage', 'expiry', 'low_stock', 'waste_alert', 'consumption_spike', 'price_drift', 'pos_variance'] },
  { layer: 'Mind',  types: ['po_discrepancy', 'contract_expiry', 'integration_health'] },
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
  integration_health: 9,
  system:           10,
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotifRow({ notif }: { notif: Notification }) {
  const navigate = useNavigate()
  const fmtDate = useDateFormat()
  const markRead = useMarkNotificationRead()
  const cfg = TYPE_CFG[notif.type]

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
        <Icon icon={cfg.icon} size={14} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag intent={cfg.tagIntent} minimal>{cfg.label}</Tag>
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
        <Button
          icon="updated"
          variant="minimal"
          size="small"
          onClick={handleMarkRead}
          aria-label="Mark as read"
          className="!opacity-0 group-hover:!opacity-100 transition-opacity"
        />
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
            icon="download"
            size="small"
            onClick={handleExport}
            disabled={notifications.length === 0}
          >
            CSV
          </Button>
          <Button
            icon="updated"
            size="small"
            onClick={() => { void markAllRead.mutateAsync() }}
            disabled={unreadCount === 0}
            loading={markAllRead.isPending}
          >
            Mark all read
          </Button>
        </div>
      </div>

      {/* Tab bar — layer-grouped */}
      <div className="flex items-center gap-1 border-b px-8 py-2 flex-shrink-0 overflow-x-auto bg-muted/10">
        <Icon icon="filter" size={14} className="text-muted-foreground mr-1 flex-shrink-0" />
        {/* Base filters */}
        {[
          { id: 'all' as TabFilter,    label: 'All',    badge: undefined },
          { id: 'unread' as TabFilter, label: 'Unread', badge: unreadCount || undefined },
        ].map((t) => (
          <Button
            key={t.id}
            size="small"
            active={tab === t.id}
            intent={tab === t.id ? Intent.PRIMARY : Intent.NONE}
            variant={tab === t.id ? 'solid' : 'minimal'}
            onClick={() => { setTab(t.id) }}
            className="flex-shrink-0"
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <Tag
                minimal={tab === t.id}
                intent={tab === t.id ? Intent.NONE : Intent.DANGER}
                round
                className="ml-1.5"
              >
                {t.badge > 99 ? '99+' : String(t.badge)}
              </Tag>
            )}
          </Button>
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
                  <Button
                    key={t}
                    size="small"
                    active={tab === t}
                    intent={tab === t ? Intent.PRIMARY : Intent.NONE}
                    variant={tab === t ? 'solid' : 'minimal'}
                    onClick={() => { setTab(t) }}
                    className="flex-shrink-0"
                  >
                    {cfg.label}
                    {badge != null && badge > 0 && (
                      <Tag
                        minimal={tab === t}
                        intent={tab === t ? Intent.NONE : Intent.DANGER}
                        round
                        className="ml-1.5"
                      >
                        {badge > 99 ? '99+' : String(badge)}
                      </Tag>
                    )}
                  </Button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </div>
        ) : notifications.length === 0 ? (
          <NonIdealState
            icon="notifications-snooze"
            title="No notifications yet"
            description="Notifications fire automatically when stock falls below par, items approach expiry within 7 days, waste events spike, or restocks need approval. Run a scan from the Alerts page to generate the first batch."
          />
        ) : filtered.length === 0 ? (
          <NonIdealState
            icon="trash"
            title={tab === 'unread' ? 'All caught up' : 'No notifications'}
            description={tab === 'unread' ? 'No unread notifications.' : `No ${TYPE_CFG[tab as NotifType].label} notifications.`}
            action={
              <Button
                variant="minimal"
                intent={Intent.PRIMARY}
                onClick={() => { setTab('all') }}
              >
                Show all
              </Button>
            }
          />
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
                  <Card compact className="!p-0 overflow-hidden">
                    {items.map((n) => <NotifRow key={n.id} notif={n} />)}
                  </Card>
                </div>
              )
            })}
          </div>
        ) : (
          <div>
            <div className="px-6 py-2 bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {tab === 'unread'
                ? `${String(filtered.length)} unread`
                : `${String(filtered.length)} ${TYPE_CFG[tab].label}`}
            </div>
            <Card compact className="!p-0 overflow-hidden mx-6 my-4">
              {filtered.map((n) => (
                <NotifRow key={n.id} notif={n} />
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
