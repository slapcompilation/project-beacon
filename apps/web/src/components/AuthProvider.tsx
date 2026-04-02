import { useEffect } from 'react'
import { services } from '@/lib/services'
import { useAuthStore } from '@/stores/auth.store'

/**
 * Initialises the auth session on first load and listens for
 * sign-in / sign-out events from Supabase (e.g. OAuth redirects,
 * token expiry, another tab signing out).
 *
 * Must be rendered once near the root — inside <App />.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession)
  const setLoading = useAuthStore((s) => s.setLoading)

  useEffect(() => {
    // 1. Hydrate session on first mount
    services.auth
      .getSession()
      .then(setSession)
      .catch(() => { setSession(null); })

    // 2. Keep store in sync with Supabase auth events
    const unsubscribe = services.auth.onAuthStateChange(setSession)
    return unsubscribe
  }, [setSession, setLoading])

  return <>{children}</>
}
