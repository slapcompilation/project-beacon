// MFA posture for the route gate: does this session owe a TOTP challenge, and
// does the user have a verified factor at all. Cached briefly so it doesn't
// refetch on every navigation; AuthGuard refetches explicitly after a gate clears.

import { useQuery } from '@tanstack/react-query'
import { services } from '@/lib/services'

export interface MfaStatus {
  /** Verified factor exists but the session is still aal1 — challenge owed now. */
  challengeOwed: boolean
  hasVerifiedFactor: boolean
}

export function useMfaStatus(enabled: boolean) {
  return useQuery<MfaStatus>({
    queryKey: ['mfa-status'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [aal, factors] = await Promise.all([
        services.auth.getAal(),
        services.auth.listMfaFactors(),
      ])
      return {
        challengeOwed: aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2',
        hasVerifiedFactor: factors.some((f) => f.status === 'verified'),
      }
    },
  })
}
