// Layer: meta — monitors Supabase WebSocket connection health.
// Used by Sidebar to show a live/offline indicator.
// Creates a lightweight heartbeat channel that does nothing except track state.

import { useEffect, useState } from 'react'
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export type RealtimeStatus = 'connected' | 'connecting' | 'disconnected'

export function useRealtimeStatus(): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    const channel = supabase
      .channel('__beacon_health__')
      .subscribe((s) => {
        if (s === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED)           setStatus('connected')
        else if (s === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR || s === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) setStatus('disconnected')
        else                              setStatus('connecting')
      })

    return () => { void supabase.removeChannel(channel) }
  }, [])

  return status
}
