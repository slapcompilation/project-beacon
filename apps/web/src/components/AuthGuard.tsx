import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import { AppLayout } from '@/components/layout/AppLayout'
import { useMfaStatus } from '@/features/auth/useMfaStatus'
import { MfaChallengeGate } from '@/features/auth/MfaGate'
import { services } from '@/lib/services'

// Routes restricted to owner or admin only (not team_member or limited_access)
const ADMIN_ONLY_PREFIXES = ['/settings']

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)
  const { pathname } = useLocation()
  const mfa = useMfaStatus(isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Resolve MFA posture before the app renders, so the gates below can't be
  // skipped by a flash of content. (Fails open on a transient error — the
  // login-page challenge is the primary enforcement; this is the safety-net.)
  if (mfa.isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>
  }

  const signOut = () => { void services.auth.signOut() }

  // MFA is opt-in (enroll under Settings → Security). For users who DID enroll,
  // this enforces the challenge even on sessions that bypass the login-page one
  // (OAuth callback, restored session): a verified factor on an aal1 session must
  // complete the TOTP challenge before anything renders.
  if (mfa.data?.challengeOwed) {
    return <MfaChallengeGate onDone={() => { void mfa.refetch() }} onCancel={signOut} />
  }

  // admin-only routes: team_member and limited_access are not allowed
  if (
    role !== 'owner' &&
    role !== 'admin' &&
    ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return <Navigate to="/" replace />
  }

  return <AppLayout />
}
