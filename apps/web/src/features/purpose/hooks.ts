import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Sensitivity } from '@/features/documents/api'

export interface AccessPurpose {
  id:              string
  label:           string
  description:     string
  max_sensitivity: Sensitivity
  sort_order:      number
}

export function useAccessPurposes() {
  return useQuery({
    queryKey: ['access-purposes'],
    queryFn: async (): Promise<AccessPurpose[]> => {
      const { data, error } = await supabase
        .from('access_purposes')
        .select('*')
        .order('sort_order')
        .overrideTypes<AccessPurpose[], { merge: false }>()
      if (error) throw new Error(error.message)
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}
