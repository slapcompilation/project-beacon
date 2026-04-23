// Layer: meta — monitors Supabase WebSocket connection health.
// Used by Sidebar to show a live/offline indicator.
// Creates a lightweight heartbeat channel that does nothing except track state.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export type RealtimeStatus = 'connected' | 'connecting' | 'disconnected'

export function useRealtimeStatus(): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    const channel = supabase
      .channel('__beacon_health__')
      .subscribe((s) => {
        if (s === 'SUBSCRIBED')           setStatus('connected')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('disconnected')
        else                              setStatus('connecting')
      })

    return () => { void supabase.removeChannel(channel) }
  }, [])

  return status
}
