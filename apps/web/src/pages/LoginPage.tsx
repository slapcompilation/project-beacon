// Layer: Floor — Authentication entry point.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Button,
  Card,
  FormGroup,
  InputGroup,
  Intent,
} from '@blueprintjs/core'
import { services } from '@/lib/services'
import { bpRegister } from '@/lib/forms'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const resetSchema = z.object({
  email: z.email('Enter a valid email address'),
})

type LoginFields = z.infer<typeof loginSchema>
type ResetFields = z.infer<typeof resetSchema>

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm({ onForgotPassword, onMfaRequired }: { onForgotPassword: () => void; onMfaRequired: () => void }) {
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFields) => {
    try {
      await services.auth.signIn(data.email, data.password)
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
    }
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} noValidate>
      <FormGroup
        label="Email"
        labelFor="email"
        intent={errors.email ? Intent.DANGER : Intent.NONE}
        helperText={errors.email?.message}
      >
        <InputGroup
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@hotel.com"
          intent={errors.email ? Intent.DANGER : Intent.NONE}
          {...bpRegister(register('email'))}
        />
      </FormGroup>

      <FormGroup
        label="Password"
        labelFor="password"
        intent={errors.password ? Intent.DANGER : Intent.NONE}
        helperText={errors.password?.message}
        labelInfo={
          <Button variant="minimal" size="small" intent={Intent.PRIMARY} onClick={onForgotPassword}>
            Forgot password?
          </Button>
        }
      >
        <InputGroup
          id="password"
          type="password"
          autoComplete="current-password"
          intent={errors.password ? Intent.DANGER : Intent.NONE}
          {...bpRegister(register('password'))}
        />
      </FormGroup>

      <Button type="submit" fill intent={Intent.PRIMARY} loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  )
}

// ─── Password reset form ──────────────────────────────────────────────────────

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ResetFields>({ resolver: zodResolver(resetSchema) })

  const onSubmit = async (data: ResetFields) => {
    try {
      await services.auth.resetPassword(data.email)
    } catch (err) {
      // Don't reveal whether an email exists — silently succeed
      console.error('[resetPassword]', err)
    }
    // Always show the same message to avoid email enumeration
  }

  if (isSubmitSuccessful) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, a reset link is on its way.
        </p>
        <Button fill onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} noValidate className="space-y-2">
      <FormGroup
        label="Email"
        labelFor="reset-email"
        intent={errors.email ? Intent.DANGER : Intent.NONE}
        helperText={errors.email?.message}
      >
        <InputGroup
          id="reset-email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@hotel.com"
          intent={errors.email ? Intent.DANGER : Intent.NONE}
          {...bpRegister(register('email'))}
        />
      </FormGroup>

      <Button type="submit" fill intent={Intent.PRIMARY} loading={isSubmitting}>
        Send reset link
      </Button>

      <Button
        type="button"
        variant="minimal"
        fill
        onClick={onBack}
        disabled={isSubmitting}
      >
        Back to sign in
      </Button>
    </form>
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
            <LoginForm onForgotPassword={() => { setView('forgot') }} onMfaRequired={() => { setView('mfa') }} />
          )}
          {view === 'forgot' && <ForgotPasswordForm onBack={() => { setView('login') }} />}
          {view === 'mfa' && <MfaChallengeForm onCancel={() => { void cancelMfa() }} />}
        </Card>
      </div>
    </div>
  )
}
