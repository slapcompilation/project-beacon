// Settings → Security: enroll / disable TOTP two-factor auth for the current user.
// Self-contained (local state + services.auth) — no react-hook-form, so the code
// input is a plain controlled field.

import { useEffect, useState } from 'react'
import { Button, Callout, Card, InputGroup, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { toast } from 'sonner'
import type { MfaEnrollment, MfaFactor } from '@beacon/services'
import { services } from '@/lib/services'
import { SectionHeader } from './_shared'

type Phase = 'loading' | 'idle' | 'enrolling' | 'busy'

export function SecuritySection() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [factors, setFactors] = useState<MfaFactor[]>([])
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null)
  const [code, setCode] = useState('')

  const verified = factors.find((f) => f.status === 'verified')

  const load = async () => {
    try {
      setFactors(await services.auth.listMfaFactors())
      setPhase('idle')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load security settings')
      setPhase('idle')
    }
  }

  useEffect(() => { void load() }, [])

  const beginEnroll = async () => {
    setPhase('busy')
    try {
      // Clear any half-finished (unverified) factors so enroll can't collide.
      for (const f of factors.filter((f) => f.status === 'unverified')) {
        await services.auth.unenrollMfa(f.id)
      }
      setEnrollment(await services.auth.enrollTotp())
      setCode('')
      setPhase('enrolling')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start enrollment')
      setPhase('idle')
    }
  }

  const confirmEnroll = async () => {
    if (!enrollment) return
    setPhase('busy')
    try {
      await services.auth.verifyTotp(enrollment.factorId, code.trim())
      toast.success('Two-factor authentication enabled')
      setEnrollment(null); setCode('')
      await load()
    } catch {
      toast.error('That code didn’t match — check your authenticator and try again')
      setPhase('enrolling')
    }
  }

  const cancelEnroll = async () => {
    const pending = enrollment
    setEnrollment(null); setCode(''); setPhase('busy')
    if (pending) { try { await services.auth.unenrollMfa(pending.factorId) } catch { /* best-effort */ } }
    await load()
  }

  const disable = async () => {
    if (!verified) return
    setPhase('busy')
    try {
      await services.auth.unenrollMfa(verified.id)
      toast.success('Two-factor authentication disabled')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not disable')
      setPhase('idle')
    }
  }

  return (
    <div className="max-w-2xl">
      <SectionHeader
        title="Security"
        description="Add a second factor (an authenticator app) so a password alone can't sign in."
      />

      {phase === 'loading' ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} /> Loading…
        </div>
      ) : enrollment ? (
        <Card className="flex flex-col gap-4">
          <p className="text-sm">
            Scan this with your authenticator app (Google Authenticator, 1Password, Authy…), then enter the 6-digit code to confirm.
          </p>
          <div className="flex items-start gap-5 flex-wrap">
            <img src={enrollment.qrCode} alt="TOTP QR code" width={160} height={160} className="rounded border bg-white p-2" />
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">Can’t scan? Enter this key manually:</p>
              <code className="font-mono text-[11px] break-all bg-muted px-1.5 py-1 rounded">{enrollment.secret}</code>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor="totp" className="text-xs font-medium block mb-1">6-digit code</label>
              <InputGroup
                id="totp"
                value={code}
                onValueChange={setCode}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                style={{ width: 120 }}
              />
            </div>
            <Button intent={Intent.PRIMARY} loading={phase === 'busy'} disabled={code.trim().length < 6} onClick={() => { void confirmEnroll() }}>
              Confirm
            </Button>
            <Button variant="minimal" disabled={phase === 'busy'} onClick={() => { void cancelEnroll() }}>Cancel</Button>
          </div>
        </Card>
      ) : verified ? (
        <Card className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Tag intent={Intent.SUCCESS} icon="tick-circle" minimal>On</Tag>
            <span className="text-sm">Two-factor authentication is enabled for your account.</span>
          </div>
          <Button intent={Intent.DANGER} variant="minimal" loading={phase === 'busy'} onClick={() => { void disable() }}>
            Disable
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <Callout intent={Intent.WARNING} icon="shield" compact>
            Two-factor authentication is off. Strongly recommended for owner and admin accounts.
          </Callout>
          <div>
            <Button intent={Intent.PRIMARY} icon="lock" loading={phase === 'busy'} onClick={() => { void beginEnroll() }}>
              Enable two-factor auth
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
