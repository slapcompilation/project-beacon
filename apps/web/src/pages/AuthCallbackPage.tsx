// Layer: Floor — OAuth redirect landing.
//
// Providers redirect here after sign-in. Supabase exchanges the code for a
// session (detectSessionInUrl); we wait for it, then drop the user into the app.
// If it never arrives, send them back to sign in.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import { services } from '@/lib/services'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let settled = false
    const enter = () => { if (!settled) { settled = true; void navigate('/floor', { replace: true }) } }

    services.auth.getSession().then((s) => { if (s) enter() }).catch(() => { /* wait for the event/timeout */ })
    const unsubscribe = services.auth.onAuthStateChange((s) => { if (s) enter() })
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        setFailed(true)
        toast.error('Sign-in didn’t complete. Please try again.')
        void navigate('/login', { replace: true })
      }
    }, 8000)

    return () => { unsubscribe(); clearTimeout(timer) }
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="flex items-center gap-3">
        {!failed && <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />}
        <span className="text-sm text-muted-foreground">{failed ? 'Redirecting…' : 'Signing you in…'}</span>
      </Card>
    </div>
  )
}
