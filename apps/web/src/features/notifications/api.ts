// The notifications centre's read path.
//
// Foundry names it in prose — object-monitors/overview lists the delivery
// mechanisms and the first is the in-platform pop-up in the Foundry
// notifications center — and `data-health/images/notifications.png` is the only
// capture of it.
//
// The engine is 793–803: one payload shaped as the published Notification type,
// one delivery row per recipient, and `my_notifications` filtering on the
// caller. Nothing here re-implements any of that; the read is one function call.
// Rendering lives in `format.ts`, which reaches nothing.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { markNotificationRead, myNotifications } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import type { Notification, NotificationLink } from './format'

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
