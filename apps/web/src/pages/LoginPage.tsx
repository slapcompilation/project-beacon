// The platform's login screen (readings/home-and-navigation.md §8.1).
//
// The SCREEN is Foundry's — dark page, mark, welcome title, bordered card,
// icon-prefixed inputs, full-width blue action. The FLOW is not: theirs is
// email → Next → passkey, ours is email+password in one step, so nothing here
// splits into two.
//
// Values are read straight from the DOM via FormData on submit (not react-hook-
// form), so browser/password-manager autofill — which sets the input value
// without firing a React onChange — is captured reliably. Validated with zod.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button, FormGroup, InputGroup, Intent } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import type { OAuthProvider } from '@beacon/services'
import { services } from '@/lib/services'
import { AuthScreen } from '@/features/auth/AuthScreen'
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

function LoginForm({ onMfaRequired }: { onMfaRequired: () => void }) {
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
      void navigate('/', { replace: true })
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
    // Labelless, icon-prefixed inputs: a person glyph on the filled email field,
    // a lock on the outlined password field (§8.1).
    <form onSubmit={(e) => { void onSubmit(e) }} noValidate>
      <FormGroup intent={errors.email ? Intent.DANGER : Intent.NONE} helperText={errors.email}>
        <InputGroup id="email" name="email" type="email" autoComplete="username" autoFocus
          leftIcon="person" placeholder="Email" aria-label="Email"
          intent={errors.email ? Intent.DANGER : Intent.NONE} />
      </FormGroup>

      <FormGroup intent={errors.password ? Intent.DANGER : Intent.NONE} helperText={errors.password}>
        <InputGroup id="password" name="password" type="password" autoComplete="current-password"
          className="auth-input-outline" leftIcon="lock" placeholder="Password" aria-label="Password"
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
      <>
        <p className="auth-instruction">If an account exists for that email, a reset link is on its way.</p>
        <Button fill onClick={onBack}>Back to sign in</Button>
      </>
    )
  }

  return (
    <form onSubmit={(e) => { void onSubmit(e) }} noValidate>
      <FormGroup intent={error ? Intent.DANGER : Intent.NONE} helperText={error}>
        <InputGroup id="reset-email" name="email" type="email" autoComplete="email" autoFocus
          leftIcon="person" placeholder="Email" aria-label="Email"
          intent={error ? Intent.DANGER : Intent.NONE} />
      </FormGroup>

      <Button type="submit" fill intent={Intent.PRIMARY} loading={submitting}>Send reset link</Button>
      <Button type="button" variant="minimal" fill className="mt-2" onClick={onBack} disabled={submitting}>Back to sign in</Button>
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
    <>
      <div className="auth-divider"><span />or<span /></div>
      {providers.map((p) => (
        <Button key={p} fill className="mt-2" icon={PROVIDER_META[p].icon} onClick={() => { void onClick(p) }}>
          {PROVIDER_META[p].label}
        </Button>
      ))}
    </>
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
      void navigate('/', { replace: true })
    } catch {
      toast.error('That code didn’t match — try again')
      setSubmitting(false)
    }
  }

  return (
    <>
      <InputGroup className="auth-input-outline" leftIcon="lock" value={code} onValueChange={setCode}
        placeholder="123456" aria-label="Authentication code" autoFocus
        autoComplete="one-time-code" inputMode="numeric" maxLength={6} />
      <Button fill className="mt-3" intent={Intent.PRIMARY} loading={submitting}
        disabled={code.trim().length < 6} onClick={() => { void submit() }}>
        Verify
      </Button>
      <Button fill className="mt-2" variant="minimal" disabled={submitting} onClick={onCancel}>Cancel</Button>
    </>
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

  // The screenshot's outside-the-card link is `Need help?`; ours is the reset
  // link, which the prose puts on this page anyway ("below the login form").
  // There is no support portal to point a second link at.
  const footer = view === 'login' && (
    <Button variant="minimal" size="small" intent={Intent.PRIMARY} onClick={() => { setView('forgot') }}>
      Forgot password?
    </Button>
  )

  return (
    <AuthScreen heading={title} instruction={subtitle} footer={footer}>
      {view === 'login' && (
        <>
          <LoginForm onMfaRequired={() => { setView('mfa') }} />
          <OAuthButtons />
        </>
      )}
      {view === 'forgot' && <ForgotPasswordForm onBack={() => { setView('login') }} />}
      {view === 'mfa' && <MfaChallengeForm onCancel={() => { void cancelMfa() }} />}
    </AuthScreen>
  )
}
