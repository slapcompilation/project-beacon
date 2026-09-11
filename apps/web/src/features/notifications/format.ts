// Rendering a notification, with nothing behind it.
//
// Separate from `api.ts` on purpose: that module reaches the database, so
// importing it pulls in the Supabase client, which throws at module load when
// no credentials are configured. These two functions need none, and a test of
// them should not need one either — CI caught exactly that, where a local
// .env.local had been hiding it.

/** A Link, as `functions/types-reference` publishes it: a user-facing label and
 *  a target that is a URL, an ontology object, or any resource's rid. */
export interface NotificationLink {
  label: string
  linkTarget:
    | { type: 'url'; url: string }
    | { type: 'object'; objectType: string; primaryKey: string }
    | { type: 'rid'; rid: string }
}

export interface Notification {
  deliveryId: string
  notificationId: string
  heading: string
  content: string
  links: NotificationLink[]
  sourceRid: string | null
  createdAt: string
  readAt: string | null
}

/** "1 minute ago", "15 minutes ago", "1 hour ago" — the capture's own forms,
 *  which are what the rows show beneath each notification. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  const scale: [number, string][] = [
    [60, 'second'], [3600, 'minute'], [86400, 'hour'], [2592000, 'day'],
  ]
  if (seconds < 60) return seconds <= 1 ? 'just now' : `${String(seconds)} seconds ago`
  for (let i = 1; i < scale.length; i += 1) {
    const [bound, unit] = scale[i]
    if (seconds < bound) {
      const n = Math.floor(seconds / scale[i - 1][0])
      return `${String(n)} ${unit}${n === 1 ? '' : 's'} ago`
    }
  }
  const months = Math.floor(seconds / 2592000)
  return `${String(months)} month${months === 1 ? '' : 's'} ago`
}

/** Where a Link points, for the three published target kinds. A rid has no
 *  route of its own here, so it renders as text rather than a dead link. */
export function linkHref(link: NotificationLink): string | null {
  const t = link.linkTarget
  if (t.type === 'url') return t.url
  if (t.type === 'object') return `/objects/${t.objectType}/${encodeURIComponent(t.primaryKey)}`
  return null
}
