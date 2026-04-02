import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 seconds — avoids redundant refetches
      // while real-time subscriptions handle live updates.
      staleTime: 30 * 1000,
      // Keep inactive query data for 5 minutes.
      gcTime: 5 * 60 * 1000,
      // Realtime subscriptions handle live updates — window focus refetches
      // are pure waste and hammer Supabase on every tab switch.
      refetchOnWindowFocus: false,
      // Reconnect after going offline → fetch fresh data immediately.
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        // Don't retry on auth/permission errors
        if (error instanceof Error) {
          const msg = error.message
          if (msg.includes('401') || msg.includes('403') || msg.includes('404')) return false
        }
        return failureCount < 2
      },
    },
    mutations: {
      // Optimistic updates are handled per-mutation — no global default needed
    },
  },
})
