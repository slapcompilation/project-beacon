import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { fetchUserPrefs, updateUserPrefs, type FullUserPrefs } from '../api'
import { formatDate, DEFAULT_DATE_FORMAT } from '@/lib/date'

export type { FullUserPrefs }

export const userPrefsKeys = {
  prefs: (userId: string) => ['user-prefs', userId] as const,
}

export function useUserPrefs() {
  const userId = useAuthStore((s) => s.session?.user.id ?? '')
  return useQuery({
    queryKey: userPrefsKeys.prefs(userId),
    queryFn: () => fetchUserPrefs(userId),
    enabled: !!userId,
    staleTime: Infinity, // preferences only change when the user explicitly saves
  })
}

/**
 * Returns a stable formatter function that uses the user's preferred date format.
 * Usage: const fmt = useDateFormat(); fmt('2026-03-23') → '23/03/2026'
 */
export function useDateFormat() {
  const { data: prefs } = useUserPrefs()
  const fmt = prefs?.date_format ?? DEFAULT_DATE_FORMAT
  return useCallback(
    (date: string | Date | null | undefined) => formatDate(date, fmt),
    [fmt],
  )
}

export function useUpdateUserPrefs() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.session?.user.id ?? '')

  return useMutation({
    mutationFn: (patch: Partial<FullUserPrefs>) => updateUserPrefs(userId, patch),
    // Optimistic update — apply immediately, roll back on error
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: userPrefsKeys.prefs(userId) })
      const previous = queryClient.getQueryData<FullUserPrefs>(userPrefsKeys.prefs(userId))
      queryClient.setQueryData<FullUserPrefs>(userPrefsKeys.prefs(userId), (old) =>
        old ? { ...old, ...patch } : old
      )
      return { previous }
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(userPrefsKeys.prefs(userId), ctx.previous)
      }
      toast.error('Failed to save preference')
    },
    onSuccess: () => {
      toast.success('Saved', { duration: 1500 })
    },
  })
}
