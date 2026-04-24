// Layer: Eye — AI-powered natural language import parser hook
// Imperative / on-demand hook (not TanStack Query — user-triggered, not a background fetch).

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface ParsedProduct {
  name: string
  sku: string
  description?: string
  cost: number
  category?: string | null
  category_id?: string | null
  initial_stock?: number
  tags?: string[]
}

export interface ParsedUpdate {
  sku: string
  action: 'set' | 'add' | 'subtract'
  quantity: number
  cost?: number | null
  description?: string | null
}

export interface SmartImportResult {
  products?: ParsedProduct[]
  updates?: ParsedUpdate[]
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
  warnings?: string[]
}

export function useSmartImport() {
  const [data, setData] = useState<SmartImportResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parse = useCallback(async (
    mode: 'create' | 'update',
    text: string,
    availableCategories: { id: string; name: string }[],
    existingSkus?: string[],
  ) => {
    setIsLoading(true)
    setError(null)
    setData(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await supabase.functions.invoke('smart-import', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          mode,
          text,
          available_categories: availableCategories,
          existing_skus: existingSkus,
        },
      }) as {
        data: (SmartImportResult & { error?: string }) | null
        error: { message: string } | null
      }

      if (res.error) throw new Error(res.error.message)
      if (!res.data) throw new Error('No response from function')
      if ('error' in res.data && res.data.error) throw new Error(res.data.error)

      setData(res.data as SmartImportResult)
      return res.data as SmartImportResult
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to parse input'
      setError(msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  return { data, isLoading, error, parse, reset }
}
