// Layer: Eye — notifications slide-over panel
// Palantir: notifications are decision triggers, not a destination page.
// Panel surfaces unread items + one-click actions. Full audit at /notifications.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, CheckCheck, Loader2, ExternalLink,
  PackageX, CalendarX, Zap, AlertTriangle, ClipboardList, ChevronDown, ShieldAlert, Scale,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/features/notifications/hooks'
import { useAppStore } from '@/stores/app.store'
import type { Notification } from '@beacon/types'

type NotifType = Notification['type']

const TYPE_META: Record<NotifType, {
  icon: React.ElementType
  color: string
  bg: string
  label: string
  badge: string
  path: string
}> = {
  predicted_outage: {
    icon: Zap,
    color: 'text-purple-500',
    bg: 'bg-purple-50/60 dark:bg-purple-950/20',
    label: 'Predicted Outage',
    badge: 'border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
    path: '/dashboard',
  },
  expiry: {
    icon: CalendarX,
    color: 'text-red-500',
    bg: 'bg-red-50/60 dark:bg-red-950/20',
    label: 'Expiry',
    badge: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
    path: '/expiry',
  },
  low_stock: {
    icon: PackageX,
    color: 'text-orange-500',
    bg: 'bg-orange-50/60 dark:bg-orange-950/20',
    label: 'Low Stock',
    badge: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
    path: '/inventory',
  },
  waste_alert: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50/50 dark:bg-yellow-950/15',
    label: 'Waste Alert',
    badge: 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
    path: '/reports',
  },
  consumption_spike: {
    icon: Zap,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50/60 dark:bg-yellow-950/20',
    label: 'Consumption Spike',
    badge: 'border-yellow-400 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300',
    path: '/reports',
  },
  price_drift: {
    icon: AlertTriangle,
    color: 'text-blue-500',
    bg: 'bg-blue-50/60 dark:bg-blue-950/20',
    label: 'Price Drift',
    badge: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    path: '/negotiation-prep',
  },
  pos_variance: {
    icon: ShieldAlert,
    color: 'text-red-500',
    bg: 'bg-red-50/60 dark:bg-red-950/20',
    label: 'POS Variance',
    badge: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
    path: '/fb-intelligence',
  },
  po_discrepancy: {
    icon: Scale,
    color: 'text-orange-500',
    bg: 'bg-orange-50/60 dark:bg-orange-950/20',
    label: 'Invoice Discrepancy',
    badge: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
    path: '/procurement?tab=match',
  },
  approval: {
    icon: ClipboardList,
    color: 'text-blue-500',
    bg: 'bg-blue-50/60 dark:bg-blue-950/20',
    label: 'Approval',
    badge: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    path: '/restocks',
  },
  system: {
    icon: Bell,
    color: 'text-muted-foreground',
    bg: '',
    label: 'System',
    badge: 'border-border text-muted-foreground',
    path: '/dashboard',
  },
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
  approval:        8,
  system:          9,
}

// Alert types that warrant a dismiss reason (intelligence feedback loop)
const ALERT_TYPES: Notification['type'][] = ['low_stock', 'waste_alert', 'predicted_outage', 'expiry', 'consumption_spike', 'price_drift', 'pos_variance', 'po_discrepancy']

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
  const Icon = meta.icon
  const isAlert = ALERT_TYPES.includes(notif.type)
  const [showReasons, setShowReasons] = useState(false)

  const handleClick = () => {
    if (!notif.read) void markRead.mutateAsync({ id: notif.id })
    close(false)
    void navigate(meta.path)
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
        {/* Unread dot */}
        <div className="mt-1.5 w-1.5 flex-shrink-0">
          {!notif.read && <span className="block h-1.5 w-1.5 rounded-full bg-primary" />}
        </div>

        <div className={cn('mt-0.5 flex-shrink-0', meta.color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <Badge variant="outline" className={cn('text-[9px] h-3.5 px-1', meta.badge)}>
              {meta.label}
            </Badge>
          </div>
          <p className={cn('text-xs leading-snug', notif.read ? 'text-muted-foreground' : 'font-medium')}>
            {notif.message}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
            {notif.dismissed_reason && (
              <span className="ml-1.5 text-muted-foreground/60">· {notif.dismissed_reason.replace(/_/g, ' ')}</span>
            )}
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
                <CheckCheck className="h-3 w-3" />
                <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', showReasons && 'rotate-180')} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void markRead.mutateAsync({ id: notif.id }) }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Mark read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dismiss reason picker — only for unread alert-type notifications */}
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

  // Show unread first, then last 20 read
  const displayed = useMemo(() => {
    const unread = sorted.filter((n) => !n.read)
    const read = sorted.filter((n) => n.read).slice(0, Math.max(0, 30 - unread.length))
    return [...unread, ...read]
  }, [sorted])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full max-w-sm p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() => { void markAllRead.mutateAsync() }}
            >
              {markAllRead.isPending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <CheckCheck className="h-3 w-3 mr-1" />}
              All read
            </Button>
          </div>
        </SheetHeader>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">All clear</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px] leading-snug">
                No unread notifications · alerts fire on low stock, expiry within 7d, and waste spikes
              </p>
            </div>
          ) : (
            displayed.map((n) => <PanelRow key={n.id} notif={n} />)
          )}
        </div>

        {/* Footer — full history link */}
        {notifications.length > 0 && (
          <div className="flex-shrink-0 border-t px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs text-muted-foreground"
              onClick={() => { setOpen(false); void navigate('/notifications') }}
            >
              <ExternalLink className="h-3 w-3 mr-1.5" />
              Full notification history
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
