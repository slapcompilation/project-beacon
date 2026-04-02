import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { AppLayout } from '@/components/layout/AppLayout'

// Routes restricted to owner or admin only (not team_member or limited_access)
const ADMIN_ONLY_PREFIXES = ['/settings', '/team', '/chain', '/leverage', '/purchase-orders', '/optimize-pars']

// For limited_access role, the only allowed route is /scan
const LIMITED_ACCESS_ALLOWED = '/scan'

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)
  const { pathname } = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
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
