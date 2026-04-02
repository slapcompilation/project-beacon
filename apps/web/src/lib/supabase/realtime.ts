import type { IRealtimeService, RealtimeEvent, RealtimePayload } from '@beacon/services'
import { supabase } from './client'

export class SupabaseRealtimeService implements IRealtimeService {
  private channels = new Map<string, ReturnType<typeof supabase.channel>>()

  subscribe<T>(
    table: string,
    event: RealtimeEvent,
    callback: (payload: RealtimePayload<T>) => void,
    filter?: string
  ): () => void {
    const channelKey = `${table}:${event}:${filter ?? '*'}`

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes' as 'system',
        {
          event,
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: RealtimePayload<T>) => {
          callback(payload)
        }
      )
      .subscribe()

    this.channels.set(channelKey, channel)

    return () => {
      void supabase.removeChannel(channel)
      this.channels.delete(channelKey)
    }
  }

  disconnect(): void {
    for (const channel of this.channels.values()) {
      void supabase.removeChannel(channel)
    }
    this.channels.clear()
  }
}
