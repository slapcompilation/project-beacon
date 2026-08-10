// Full-screen blocking gate rendered by AuthGuard before the app shows: a session
// that has a verified factor (the user opted into 2FA) but is still aal1 — an
// OAuth or restored session that skipped the login-page challenge — must verify
// before entry. verifyTotp lifts the session to aal2; onDone refetches the gate.
// onCancel signs out (the only escape — you can't bypass the challenge while signed in).

import { useState } from 'react'
import { Button, InputGroup, Intent } from '@blueprintjs/core'
import { toast } from 'sonner'
import { services } from '@/lib/services'
import { AuthScreen } from './AuthScreen'

export function MfaChallengeGate({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      const totp = (await services.auth.listMfaFactors()).find((f) => f.status === 'verified')
      if (!totp) throw new Error('No authenticator enrolled')
      await services.auth.verifyTotp(totp.id, code.trim())
      onDone()
    } catch {
      toast.error('That code didn’t match — try again')
      setSubmitting(false)
    }
  }

  return (
    <AuthScreen heading="Two-factor authentication" instruction="Enter the 6-digit code from your authenticator app.">
      <InputGroup className="auth-input-outline" leftIcon="lock" value={code} onValueChange={setCode}
        placeholder="123456" aria-label="Authentication code" autoFocus
        autoComplete="one-time-code" inputMode="numeric" maxLength={6} />
      <Button fill className="mt-3" intent={Intent.PRIMARY} loading={submitting} disabled={code.trim().length < 6}
        onClick={() => { void submit() }}>Verify</Button>
      <Button fill className="mt-2" variant="minimal" disabled={submitting} onClick={onCancel}>Sign out</Button>
    </AuthScreen>
  )
}
