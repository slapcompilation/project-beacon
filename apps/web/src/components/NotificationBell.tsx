import { Bell, CheckCheck } from 'lucide-react'
import { format } from 'date-fns'
import { useDateFormat } from '@/features/user/hooks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/features/notifications/hooks'
import type { Notification } from '@beacon/types'

const TYPE_STYLES: Record<Notification['type'], string> = {
  low_stock: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  expiry: 'border-red-200 bg-red-50 text-red-800',
  approval: 'border-blue-200 bg-blue-50 text-blue-800',
  system: 'border-slate-200 bg-slate-50 text-slate-800',
  predicted_outage: 'border-red-200 bg-red-50 text-red-800',
  waste_alert: 'border-orange-200 bg-orange-50 text-orange-800',
  consumption_spike: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  price_drift:       'border-blue-200 bg-blue-50 text-blue-800',
  pos_variance:      'border-red-200 bg-red-50 text-red-800',
  po_discrepancy:    'border-orange-200 bg-orange-50 text-orange-800',
  contract_expiry:   'border-indigo-200 bg-indigo-50 text-indigo-800',
}

export function NotificationBell() {
  const { data: notifications = [] } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const fmtDate = useDateFormat()

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="relative flex items-center justify-center rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-96 flex flex-col p-0">
        <SheetHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
          <SheetTitle className="text-base">Notifications</SheetTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => { markAll.mutate(); }}
              disabled={markAll.isPending}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'flex gap-3 px-5 py-4 transition-colors',
                    !n.read && 'bg-muted/40'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{n.message}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn('text-xs capitalize px-1.5 py-0', TYPE_STYLES[n.type])}
                      >
                        {n.type.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {`${fmtDate(new Date(n.timestamp))}, ${format(new Date(n.timestamp), 'HH:mm')}`}
                      </span>
                    </div>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => { markRead.mutate({ id: n.id }); }}
                      className="mt-0.5 flex-shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
                      title="Mark as read"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
