// The notifications centre's read path.
//
// Foundry names it in prose — object-monitors/overview lists the delivery
// mechanisms and the first is the in-platform pop-up in the Foundry
// notifications center — and `data-health/images/notifications.png` is the only
// capture of it. Everything the page renders comes from that capture, which I
// parsed rather than inferred.
//
// The engine is 793–803: one payload shaped as the published Notification type,
// one delivery row per recipient, and `my_notifications` filtering on the
// caller. Nothing here re-implements any of that; the read is one function call.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { markNotificationRead, myNotifications } from '@beacon/platform'
import type { Json } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'

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

const keys = { all: ['notifications'] as const }

export function useMyNotifications(limit = 50) {
  return useQuery({
    queryKey: keys.all,
    queryFn: async (): Promise<Notification[]> => {
      const rows = await client(myNotifications).executeFunction({ p_limit: limit })
      return rows.map((r) => ({
        deliveryId: r.delivery_id,
        notificationId: r.notification_id,
        heading: r.heading,
        content: r.content,
        links: (r.links ?? []) as unknown as NotificationLink[],
        sourceRid: r.source_rid,
        createdAt: r.created_at,
        readAt: r.read_at,
      }))
    },
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (deliveryId: string) => {
      await client(markNotificationRead).applyAction({ p_delivery: deliveryId })
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
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

export type { Json }
