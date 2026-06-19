// Full-screen blocking gates rendered by AuthGuard before the app shows. Two cases:
//  - MfaChallengeGate: the session has a verified factor but is still aal1 (an
//    OAuth or restored session that skipped the login-page challenge) — verify before entry.
//  - MfaEnrollGate: an owner/admin without 2FA — mandatory enrollment before entry.
// Both end in verifyTotp, which lifts the session to aal2; onDone refetches the gate.
// onCancel signs out (the only escape — you can't bypass the gate while signed in).

import { useEffect, useState } from 'react'
import { Button, Callout, Card, InputGroup, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import { toast } from 'sonner'
import type { MfaEnrollment } from '@beacon/services'
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

export function MfaEnrollGate({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(true)
  const [failed, setFailed] = useState(false)

  const start = async () => {
    setBusy(true); setFailed(false)
    try {
      // Clear half-finished factors so a fresh enroll can't collide.
      for (const f of (await services.auth.listMfaFactors()).filter((f) => f.status === 'unverified')) {
        await services.auth.unenrollMfa(f.id)
      }
      setEnrollment(await services.auth.enrollTotp())
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void start() }, [])

  const confirm = async () => {
    if (!enrollment) return
    setBusy(true)
    try {
      await services.auth.verifyTotp(enrollment.factorId, code.trim())
      toast.success('Two-factor authentication enabled')
      onDone()
    } catch {
      toast.error('That code didn’t match — check your authenticator and try again')
      setBusy(false)
    }
  }

  return (
    <Shell title="Set up two-factor authentication" subtitle="Your role requires 2FA. Scan the code, then confirm to continue.">
      {failed ? (
        <div className="space-y-3">
          <Callout intent={Intent.DANGER} compact>Couldn’t start enrollment. Check your connection and retry.</Callout>
          <Button fill intent={Intent.PRIMARY} onClick={() => { void start() }}>Retry</Button>
          <Button fill variant="minimal" onClick={onCancel}>Sign out</Button>
        </div>
      ) : !enrollment ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} /> Preparing…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-4 flex-wrap">
            <img src={enrollment.qrCode} alt="TOTP QR code" width={150} height={150} className="rounded border bg-white p-2" />
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">Can’t scan? Enter this key manually:</p>
              <code className="font-mono text-[11px] break-all bg-muted px-1.5 py-1 rounded">{enrollment.secret}</code>
            </div>
          </div>
          <InputGroup value={code} onValueChange={setCode} placeholder="123456"
            autoComplete="one-time-code" inputMode="numeric" maxLength={6} />
          <Button fill intent={Intent.PRIMARY} loading={busy} disabled={code.trim().length < 6}
            onClick={() => { void confirm() }}>Confirm &amp; continue</Button>
          <Button fill variant="minimal" disabled={busy} onClick={onCancel}>Sign out</Button>
        </div>
      )}
    </Shell>
  )
}
