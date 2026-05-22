// Notifications slide-over. Unread first, then last 30 read.

import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Button, Drawer, Icon, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/features/notifications/hooks'
import { useAppStore } from '@/stores/app.store'
import type { Notification } from '@beacon/types'

type NotifType = Notification['type']

const TYPE_META: Record<NotifType, {
  icon: IconName
  color: string
  bg: string
  label: string
  badge: string
  fallbackPath: string
}> = {
  predicted_outage: {
    icon: 'flash',
    color: 'text-purple-500',
    bg: 'bg-purple-50/60 dark:bg-purple-950/20',
    label: 'Predicted Outage',
    badge: 'border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
    fallbackPath: '/eye?panel=occupancy',
  },
  expiry: {
    icon: 'calendar',
    color: 'text-red-500',
    bg: 'bg-red-50/60 dark:bg-red-950/20',
    label: 'Expiry',
    badge: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
    fallbackPath: '/floor?panel=expiry',
  },
  low_stock: {
    icon: 'box',
    color: 'text-orange-500',
    bg: 'bg-orange-50/60 dark:bg-orange-950/20',
    label: 'Low Stock',
    badge: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
    fallbackPath: '/floor?panel=stock',
  },
  waste_alert: {
    icon: 'warning-sign',
    color: 'text-yellow-500',
    bg: 'bg-yellow-50/50 dark:bg-yellow-950/15',
    label: 'Waste Alert',
    badge: 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
    fallbackPath: '/eye?panel=waste',
  },
  consumption_spike: {
    icon: 'flash',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50/60 dark:bg-yellow-950/20',
    label: 'Consumption Spike',
    badge: 'border-yellow-400 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300',
    fallbackPath: '/eye?panel=restock',
  },
  price_drift: {
    icon: 'warning-sign',
    color: 'text-blue-500',
    bg: 'bg-blue-50/60 dark:bg-blue-950/20',
    label: 'Price Drift',
    badge: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    fallbackPath: '/mind?panel=procurement',
  },
  pos_variance: {
    icon: 'shield',
    color: 'text-red-500',
    bg: 'bg-red-50/60 dark:bg-red-950/20',
    label: 'POS Variance',
    badge: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
    fallbackPath: '/eye?panel=signals',
  },
  po_discrepancy: {
    icon: 'comparison',
    color: 'text-orange-500',
    bg: 'bg-orange-50/60 dark:bg-orange-950/20',
    label: 'Invoice Discrepancy',
    badge: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
    fallbackPath: '/mind?panel=intelligence',
  },
  contract_expiry: {
    icon: 'document',
    color: 'text-indigo-500',
    bg: 'bg-indigo-50/60 dark:bg-indigo-950/20',
    label: 'Contract Expiring',
    badge: 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400',
    fallbackPath: '/mind?panel=contracts',
  },
  approval: {
    icon: 'clipboard',
    color: 'text-blue-500',
    bg: 'bg-blue-50/60 dark:bg-blue-950/20',
    label: 'Approval Required',
    badge: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    fallbackPath: '/flow?panel=approvals',
  },
  system: {
    icon: 'notifications',
    color: 'text-muted-foreground',
    bg: '',
    label: 'System',
    badge: 'border-border text-muted-foreground',
    fallbackPath: '/briefing',
  },
}

function getNavPath(notif: Notification): string {
  if (notif.variant_id) return `/variant/${notif.variant_id}`
  return TYPE_META[notif.type].fallbackPath
}

const TYPE_PRIORITY: Record<NotifType, number> = {
  predicted_outage: 0,
  expiry: 1,
  low_stock: 2,
  waste_alert: 3,
  consumption_spike: 4,
  price_drift:  5,
  pos_variance:    6,
  po_discrepancy:  7,
  contract_expiry: 8,
  approval:        9,
  system:         10,
}

// Alert types get a dismiss reason picker so we capture feedback.
const ALERT_TYPES: Notification['type'][] = ['low_stock', 'waste_alert', 'predicted_outage', 'expiry', 'consumption_spike', 'price_drift', 'pos_variance', 'po_discrepancy', 'contract_expiry']

const DISMISS_REASONS: { value: string; label: string }[] = [
  { value: 'resolved',        label: 'Resolved' },
  { value: 'already_knew',    label: 'Already knew' },
  { value: 'incorrect_data',  label: 'Incorrect data' },
  { value: 'will_handle_later', label: 'Will handle later' },
]

function PanelRow({ notif }: { notif: Notification }) {
  const navigate = useNavigate()
  const close = useAppStore((s) => s.setNotifPanelOpen)
  const markRead = useMarkNotificationRead()
  const meta = TYPE_META[notif.type]
  const isAlert = ALERT_TYPES.includes(notif.type)
  const [showReasons, setShowReasons] = useState(false)

  const handleClick = () => {
    if (!notif.read) void markRead.mutateAsync({ id: notif.id })
    close(false)
    void navigate(getNavPath(notif))
  }

  const handleDismissWithReason = (reason: string) => {
    void markRead.mutateAsync({ id: notif.id, reason })
    setShowReasons(false)
  }

  return (
    <div
      className={cn(
        'group flex flex-col px-4 py-3 transition-colors border-b last:border-b-0',
        !notif.read && meta.bg,
      )}
    >
      <div className="flex items-start gap-3 cursor-pointer" onClick={handleClick}>
        <div className="mt-1.5 w-1.5 flex-shrink-0">
          {!notif.read && <span className="block h-1.5 w-1.5 rounded-full bg-primary" />}
        </div>

        <Icon icon={meta.icon} size={14} className={cn('mt-0.5 flex-shrink-0', meta.color)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <Tag minimal className={cn('!text-[9px] !h-3.5 !px-1', meta.badge)}>
              {meta.label}
            </Tag>
          </div>
          <p className={cn('text-xs leading-snug', notif.read ? 'text-muted-foreground' : 'font-medium')}>
            {notif.message}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-2">
            <span>{formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}</span>
            {notif.dismissed_reason && (
              <span className="text-muted-foreground/60">· {notif.dismissed_reason.replace(/_/g, ' ')}</span>
            )}
            <Link
              to={`/alert/${notif.id}`}
              onClick={(e) => { e.stopPropagation(); close(false) }}
              className="text-primary hover:underline ml-auto"
            >
              View →
            </Link>
          </p>
        </div>

        {!notif.read && (
          <div className="flex-shrink-0 mt-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAlert ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowReasons((v) => !v) }}
                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Dismiss with reason"
              >
                <Icon icon="double-chevron-up" size={12} />
                <Icon icon="chevron-down" size={10} className={cn('transition-transform', showReasons && 'rotate-180')} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void markRead.mutateAsync({ id: notif.id }) }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Mark read"
              >
                <Icon icon="double-chevron-up" size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {!notif.read && isAlert && showReasons && (
        <div className="mt-2 ml-[1.375rem] flex flex-wrap gap-1.5">
          {DISMISS_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => { handleDismissWithReason(r.value) }}
              className="rounded-full border border-muted-foreground/20 bg-background px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { void markRead.mutateAsync({ id: notif.id }) }}
            className="rounded-full border border-muted-foreground/20 bg-background px-2.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            No reason
          </button>
        </div>
      )}
    </div>
  )
}

export function NotificationsPanel() {
  const open = useAppStore((s) => s.notifPanelOpen)
  const setOpen = useAppStore((s) => s.setNotifPanelOpen)
  const navigate = useNavigate()

  const { data: notifications = [], isLoading } = useNotifications()
  const markAllRead = useMarkAllNotificationsRead()

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const sorted = useMemo(() =>
    [...notifications].sort((a, b) => {
      if (!a.read && b.read) return -1
      if (a.read && !b.read) return 1
      const pa = TYPE_PRIORITY[a.type], pb = TYPE_PRIORITY[b.type]
      if (pa !== pb) return pa - pb
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    }),
    [notifications],
  )

  const displayed = useMemo(() => {
    const unread = sorted.filter((n) => !n.read)
    const read = sorted.filter((n) => n.read).slice(0, Math.max(0, 30 - unread.length))
    return [...unread, ...read]
  }, [sorted])

  return (
    <Drawer
      isOpen={open}
      onClose={() => { setOpen(false) }}
      position="right"
      size="24rem"
      title={
        <div className="flex items-center justify-between w-full">
          <span className="flex items-center gap-2">
            <Icon icon="notifications" size={14} />
            Notifications
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
          <Button
            variant="minimal"
            size="small"
            icon="double-chevron-up"
            loading={markAllRead.isPending}
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => { void markAllRead.mutateAsync() }}
          >
            All read
          </Button>
        </div>
      }
      className="!p-0"
    >
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={SpinnerSize.SMALL} />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Icon icon="notifications" size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">All clear</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px] leading-snug">
              No unread notifications · configure alert thresholds in Eye · Alerts
            </p>
          </div>
        ) : (
          displayed.map((n) => <PanelRow key={n.id} notif={n} />)
        )}
      </div>

      {notifications.length > 0 && (
        <div className="flex-shrink-0 border-t px-4 py-3">
          <Button
            variant="minimal"
            size="small"
            icon="share"
            fill
            onClick={() => { setOpen(false); void navigate('/notifications') }}
          >
            Full notification history
          </Button>
        </div>
      )}
    </Drawer>
  )
}
