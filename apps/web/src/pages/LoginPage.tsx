// Layer: Floor — Authentication entry point.
//
// Values are read straight from the DOM via FormData on submit (not react-hook-
// form), so browser/password-manager autofill — which sets the input value
// without firing a React onChange — is captured reliably. Validated with zod.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button, Card, FormGroup, InputGroup, Intent } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import type { OAuthProvider } from '@beacon/services'
import { services } from '@/lib/services'
import { formString, zodFieldErrors } from '@/lib/forms'

// Only render OAuth buttons for providers the operator has configured (and
// enabled in Supabase). Unset → none, so we never show a button that errors.
const OAUTH_PROVIDERS = (import.meta.env.VITE_OAUTH_PROVIDERS ?? '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

const PROVIDER_META: Record<OAuthProvider, { label: string; icon: IconName }> = {
  google: { label: 'Continue with Google', icon: 'globe' },
  azure:  { label: 'Continue with Microsoft', icon: 'cloud' },
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const resetSchema = z.object({
  email: z.email('Enter a valid email address'),
})

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm({ onForgotPassword, onMfaRequired }: { onForgotPassword: () => void; onMfaRequired: () => void }) {
  const navigate = useNavigate()
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const parsed = loginSchema.safeParse({
      email: formString(fd.get('email')).trim(),
      password: formString(fd.get('password')),
    })
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      await services.auth.signIn(parsed.data.email, parsed.data.password)
      // If the account has a verified factor, password alone is aal1 — require
      // the TOTP challenge before entering the app.
      const aal = await services.auth.getAal()
      if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        onMfaRequired()
        return
      }
      void navigate('/floor', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      if (message.toLowerCase().includes('invalid login')) {
        toast.error('Incorrect email or password')
      } else if (message.toLowerCase().includes('email not confirmed')) {
        toast.error('Please confirm your email before signing in')
      } else {
        toast.error(message)
      }
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => { void onSubmit(e) }} noValidate>
      <FormGroup
        label="Email"
        labelFor="email"
        intent={errors.email ? Intent.DANGER : Intent.NONE}
        helperText={errors.email}
      >
        <InputGroup id="email" name="email" type="email" autoComplete="username" autoFocus placeholder="you@hotel.com"
          intent={errors.email ? Intent.DANGER : Intent.NONE} />
      </FormGroup>

      <FormGroup
        label="Password"
        labelFor="password"
        intent={errors.password ? Intent.DANGER : Intent.NONE}
        helperText={errors.password}
        labelInfo={
          <Button variant="minimal" size="small" intent={Intent.PRIMARY} onClick={onForgotPassword}>
            Forgot password?
          </Button>
        }
      >
        <InputGroup id="password" name="password" type="password" autoComplete="current-password"
          intent={errors.password ? Intent.DANGER : Intent.NONE} />
      </FormGroup>

      <Button type="submit" fill intent={Intent.PRIMARY} loading={submitting}>Sign in</Button>
    </form>
  )
}

// ─── Password reset form ──────────────────────────────────────────────────────

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const parsed = resetSchema.safeParse({ email: formString(fd.get('email')).trim() })
    if (!parsed.success) {
      setError(zodFieldErrors(parsed.error).email ?? 'Enter a valid email address')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await services.auth.resetPassword(parsed.data.email)
    } catch (err) {
      // Don't reveal whether an email exists — always report the same outcome.
      console.error('[resetPassword]', err)
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, a reset link is on its way.
        </p>
        <Button fill onClick={onBack}>Back to sign in</Button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { void onSubmit(e) }} noValidate className="space-y-2">
      <FormGroup
        label="Email"
        labelFor="reset-email"
        intent={error ? Intent.DANGER : Intent.NONE}
        helperText={error}
      >
        <InputGroup id="reset-email" name="email" type="email" autoComplete="email" autoFocus placeholder="you@hotel.com"
          intent={error ? Intent.DANGER : Intent.NONE} />
      </FormGroup>

      <Button type="submit" fill intent={Intent.PRIMARY} loading={submitting}>Send reset link</Button>
      <Button type="button" variant="minimal" fill onClick={onBack} disabled={submitting}>Back to sign in</Button>
    </form>
  )
}

// ─── OAuth ──────────────────────────────────────────────────────────────────────

function OAuthButtons() {
  const providers = OAUTH_PROVIDERS.filter((p): p is OAuthProvider => p in PROVIDER_META)
  if (providers.length === 0) return null

  const onClick = async (provider: OAuthProvider) => {
    try {
      await services.auth.signInWithOAuth(provider)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That sign-in option is unavailable')
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 my-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-2">
        {providers.map((p) => (
          <Button key={p} fill icon={PROVIDER_META[p].icon} onClick={() => { void onClick(p) }}>
            {PROVIDER_META[p].label}
          </Button>
        ))}
      </div>
    </div>
  )
}

// ─── MFA challenge ──────────────────────────────────────────────────────────────

function MfaChallengeForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      const totp = (await services.auth.listMfaFactors()).find((f) => f.status === 'verified')
      if (!totp) throw new Error('No authenticator enrolled')
      await services.auth.verifyTotp(totp.id, code.trim())
      void navigate('/floor', { replace: true })
    } catch {
      toast.error('That code didn’t match — try again')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <InputGroup
        value={code}
        onValueChange={setCode}
        placeholder="123456"
        autoFocus
        autoComplete="one-time-code"
        inputMode="numeric"
        maxLength={6}
      />
      <Button fill intent={Intent.PRIMARY} loading={submitting} disabled={code.trim().length < 6} onClick={() => { void submit() }}>
        Verify
      </Button>
      <Button fill variant="minimal" disabled={submitting} onClick={onCancel}>Cancel</Button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [view, setView] = useState<'login' | 'forgot' | 'mfa'>('login')

  const title = view === 'login' ? 'Sign in' : view === 'forgot' ? 'Reset password' : 'Two-factor authentication'
  const subtitle =
    view === 'login' ? 'Enter your work email and password to continue.'
    : view === 'forgot' ? "Enter your email and we'll send a reset link."
    : 'Enter the 6-digit code from your authenticator app.'

  const cancelMfa = async () => {
    try { await services.auth.signOut() } catch { /* ignore */ }
    setView('login')
  }

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
          {view === 'login' && (
            <>
              <LoginForm onForgotPassword={() => { setView('forgot') }} onMfaRequired={() => { setView('mfa') }} />
              <OAuthButtons />
            </>
          )}
          {view === 'forgot' && <ForgotPasswordForm onBack={() => { setView('login') }} />}
          {view === 'mfa' && <MfaChallengeForm onCancel={() => { void cancelMfa() }} />}
        </Card>
      </div>
    </div>
  )
}
