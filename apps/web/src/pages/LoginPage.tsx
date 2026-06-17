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
import { services } from '@/lib/services'
import { formString, zodFieldErrors } from '@/lib/forms'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const resetSchema = z.object({
  email: z.email('Enter a valid email address'),
})

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm({ onForgotPassword }: { onForgotPassword: () => void }) {
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [view, setView] = useState<'login' | 'forgot'>('login')

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Beacon</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hotel Inventory Management</p>
        </div>

        <Card>
          <h2 className="text-xl font-semibold">{view === 'login' ? 'Sign in' : 'Reset password'}</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {view === 'login'
              ? 'Enter your work email and password to continue.'
              : "Enter your email and we'll send a reset link."}
          </p>
          {view === 'login'
            ? <LoginForm onForgotPassword={() => { setView('forgot') }} />
            : <ForgotPasswordForm onBack={() => { setView('login') }} />}
        </Card>
      </div>
    </div>
  )
}
