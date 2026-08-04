// @surface-orphan-ok — reached only by AIBriefPanel, which is itself unwired. Lives or dies with it.
// Layer: Eye — AI-generated daily brief via Supabase Edge Function
// Imperative / on-demand hook (no TanStack Query — brief is user-triggered, not a background fetch).

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'

interface AIBriefResult {
  brief: string
  generated_at: string
}

export function useAIBrief() {
  const hotelId = useActiveHotelId()
  const [data, setData] = useState<AIBriefResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    if (!hotelId) return
    setIsLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await supabase.functions.invoke('ai-brief', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }) as {
        data: { brief: string; generated_at: string; error?: string } | null
        error: { message: string } | null
      }
      if (res.error) throw new Error(res.data?.error ?? res.error.message)
      if (!res.data) throw new Error('No response from function')
      setData({ brief: res.data.brief, generated_at: res.data.generated_at })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate brief')
    } finally {
      setIsLoading(false)
    }
  }, [hotelId])

  return { data, isLoading, error, generate }
}
