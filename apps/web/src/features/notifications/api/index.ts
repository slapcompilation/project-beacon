import { supabase } from '@/lib/supabase/client'
import type { Notification } from '@beacon/types'

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return data as Notification[]
}

export async function markNotificationRead(id: string, dismissedReason?: string | null): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, ...(dismissedReason != null ? { dismissed_reason: dismissedReason } : {}) })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false)

  if (error) throw new Error(error.message)
}

export async function fetchNotificationFeedback(): Promise<Array<{ type: string; dismissed_reason: string | null }>> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('notifications')
    .select('type, dismissed_reason')
    .eq('read', true)
    .gte('timestamp', since)
    .limit(500)
  if (error) throw new Error(error.message)
  return data as Array<{ type: string; dismissed_reason: string | null }>
}

// Calling with no args → SQL resolves thresholds from alert_preferences table,
// falling back to global defaults (7 days / 10 units).
// Explicit values bypass preference lookup (used by admin override controls).
