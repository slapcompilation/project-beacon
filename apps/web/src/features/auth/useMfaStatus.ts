// MFA posture for the route gate: does this session owe a TOTP challenge — i.e.
// the user has a verified factor (opted in) but the session is still aal1.
// Cached briefly so it doesn't refetch on every navigation; AuthGuard refetches
// explicitly after the challenge clears.

import { useQuery } from '@tanstack/react-query'
import { services } from '@/lib/services'

export function useMfaStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['mfa-status'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const aal = await services.auth.getAal()
      return { challengeOwed: aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2' }
    },
  })
}
