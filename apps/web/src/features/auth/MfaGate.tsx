// Full-screen blocking gate rendered by AuthGuard before the app shows: a session
// that has a verified factor (the user opted into 2FA) but is still aal1 — an
// OAuth or restored session that skipped the login-page challenge — must verify
// before entry. verifyTotp lifts the session to aal2; onDone refetches the gate.
// onCancel signs out (the only escape — you can't bypass the challenge while signed in).

import { useState } from 'react'
import { Button, Card, InputGroup, Intent } from '@blueprintjs/core'
import { toast } from 'sonner'
import { services } from '@/lib/services'

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Beacon</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hotel Inventory Management</p>
        </div>
        <Card>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">{subtitle}</p>
          {children}
        </Card>
      </div>
    </div>
  )
}

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
    <Shell title="Two-factor authentication" subtitle="Enter the 6-digit code from your authenticator app.">
      <div className="space-y-3">
        <InputGroup value={code} onValueChange={setCode} placeholder="123456" autoFocus
          autoComplete="one-time-code" inputMode="numeric" maxLength={6} />
        <Button fill intent={Intent.PRIMARY} loading={submitting} disabled={code.trim().length < 6}
          onClick={() => { void submit() }}>Verify</Button>
        <Button fill variant="minimal" disabled={submitting} onClick={onCancel}>Sign out</Button>
      </div>
    </Shell>
  )
}
