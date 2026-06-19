import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import { AppLayout } from '@/components/layout/AppLayout'
import { useMfaStatus } from '@/features/auth/useMfaStatus'
import { MfaChallengeGate, MfaEnrollGate } from '@/features/auth/MfaGate'
import { services } from '@/lib/services'

// Routes restricted to owner or admin only (not team_member or limited_access)
const ADMIN_ONLY_PREFIXES = ['/settings', '/team', '/chain', '/leverage', '/purchase-orders', '/optimize-pars']

// For limited_access role, the only allowed route is /scan
const LIMITED_ACCESS_ALLOWED = '/scan'

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

  // Safety-net: a verified factor but an aal1 session must complete the challenge
  // before anything renders (covers OAuth / restored sessions that bypassed the
  // login-page challenge).
  if (mfa.data?.challengeOwed) {
    return <MfaChallengeGate onDone={() => { void mfa.refetch() }} onCancel={signOut} />
  }

  // Mandatory 2FA for privileged roles: a system that auto-executes POs and
  // write-offs can't let an owner/admin in on a password alone.
  if ((role === 'owner' || role === 'admin') && mfa.data && !mfa.data.hasVerifiedFactor) {
    return <MfaEnrollGate onDone={() => { void mfa.refetch() }} onCancel={signOut} />
  }

  // limited_access: redirect everything except /scan back to /scan
  if (role === 'limited_access' && !pathname.startsWith(LIMITED_ACCESS_ALLOWED)) {
    return <Navigate to="/scan" replace />
  }

  // admin-only routes: team_member and limited_access are not allowed
  if (
    role !== 'owner' &&
    role !== 'admin' &&
    ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return <Navigate to="/dashboard" replace />
  }

  return <AppLayout />
}
