// The notifications centre.
//
// Built to `data-health/images/notifications.png`, which is the only capture of
// this page anywhere in the mirror and which I parsed rather than inferred. Its
// shape: a page title "All notifications", then a single bordered card whose
// rows are separated by hairlines. Each row is ONE sentence — a status glyph, a
// linked subject, the predicate, then an inline action link — with a relative
// timestamp on a second line beneath it in grey.
//
// TWO THINGS THE CAPTURE SHOWS THAT ARE DELIBERATELY NOT BUILT.
//
// The left category rail — All notifications, Access requests, Announcements,
// Builds, Comments, Issues, Recipes, Shared with you — names eight producers,
// and we have one. A rail whose seven other entries render an empty list
// forever reads as a built feature, which is the rule the datasets page states
// about tabs. When a second producer exists, the rail earns its place.
//
// Its Settings entry leads to the preference centre, whose only evidence is a
// capture that calls itself experimental. 793 refused to build the preference
// matrix for that reason and this refuses to link to it.

import { Card, Icon, NonIdealState, Spinner, SpinnerSize } from '@blueprintjs/core'
import { Link } from 'react-router-dom'
import {
  linkHref, relativeTime, useMarkRead, useMyNotifications,
  type Notification, type NotificationLink,
} from '@/features/notifications/api'

export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useMyNotifications()
  const markRead = useMarkRead()

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-xl font-semibold">All notifications</h1>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner size={SpinnerSize.SMALL} /></div>
      ) : notifications.length === 0 ? (
        <NonIdealState icon="notifications" title="No notifications"
          description="An automation's notification effect delivers here. Nothing has sent you one yet." />
      ) : (
        <Card compact className="!p-0">
          <ul className="divide-y divide-border/60">
            {notifications.map((n) => (
              <NotificationRow key={n.deliveryId} notification={n}
                onRead={() => { markRead.mutate(n.deliveryId) }} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function NotificationRow({ notification, onRead }: {
  notification: Notification
  onRead: () => void
}) {
  const unread = notification.readAt === null
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-2">
        {/* The capture's leading glyph. Ours carries the read state too, which
            the capture does not show — it has no read affordance at all. */}
        <Icon icon={unread ? 'dot' : 'tick-circle'} size={14}
          className={unread ? 'text-primary' : 'text-muted-foreground'} />
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-semibold">{notification.heading}</span>
            {notification.content && <span> {notification.content}</span>}
            {notification.links.map((l, i) => (
              <LinkChip key={`${l.label}-${String(i)}`} link={l} />
            ))}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {relativeTime(notification.createdAt)}
          </p>
        </div>
        {unread && (
          <button type="button" onClick={onRead}
            className="text-xs text-muted-foreground">
            Mark read
          </button>
        )}
      </div>
    </li>
  )
}

/** An inline action link, the way the capture renders "View dataset" — part of
 *  the sentence rather than a button beneath it. A rid target has no route
 *  here, so it reads as plain text instead of a link that goes nowhere. */
function LinkChip({ link }: { link: NotificationLink }) {
  const href = linkHref(link)
  if (href === null) return <span className="text-muted-foreground"> {link.label}</span>
  if (href.startsWith('/')) {
    return <> <Link to={href} className="text-primary hover:underline">{link.label}</Link></>
  }
  return (
    <> <a href={href} target="_blank" rel="noreferrer"
      className="text-primary hover:underline">{link.label}</a></>
  )
}
