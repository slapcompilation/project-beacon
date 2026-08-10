// Password-reset completion, on the login screen's own chrome (§8.1).
//
// The "forgot password" email links here. Supabase parses the recovery token
// from the URL and establishes a temporary session; we wait for that session,
// then let the user set a new password via updateUser. Values are read from the
// DOM via FormData on submit (same as the sign-in form) so password-manager
// autofill/generation is captured reliably.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button, FormGroup, InputGroup, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import { services } from '@/lib/services'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { formString, zodFieldErrors } from '@/lib/forms'

const schema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters'),
    confirm:  z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

type Status = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  // The recovery link drops a temporary session in via Supabase's URL parsing.
  // It may land before or after mount, so check now AND subscribe; if neither
  // produces a session shortly, the link was missing/expired/used.
  useEffect(() => {
    let settled = false
    const ready = () => { if (!settled) { settled = true; setStatus('ready') } }

    services.auth.getSession().then((s) => { if (s) ready() }).catch(() => { /* fall through to timeout */ })
    const unsubscribe = services.auth.onAuthStateChange((s) => { if (s) ready() })
    const timer = setTimeout(() => { if (!settled) setStatus('invalid') }, 4000)

    return () => { unsubscribe(); clearTimeout(timer) }
  }, [])

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const parsed = schema.safeParse({
      password: formString(fd.get('password')),
      confirm: formString(fd.get('confirm')),
    })
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      await services.auth.updatePassword(parsed.data.password)
      toast.success('Password updated')
      void navigate('/', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update password')
      setSubmitting(false)
    }
  }

  const instruction =
    status === 'checking' ? 'Verifying your reset link…'
    : status === 'invalid' ? 'This reset link is invalid or has expired. Request a fresh one from the sign-in page.'
    : 'Choose a new password for your account.'

  return (
    <AuthScreen heading="Set a new password" instruction={instruction}>
      {status === 'checking' && <Spinner size={SpinnerSize.SMALL} />}

      {status === 'invalid' && (
        <Button fill onClick={() => { void navigate('/login', { replace: true }) }}>Back to sign in</Button>
      )}

      {status === 'ready' && (
        <form onSubmit={(e) => { void onSubmit(e) }} noValidate>
          <FormGroup intent={errors.password ? Intent.DANGER : Intent.NONE} helperText={errors.password}>
            <InputGroup id="password" name="password" type="password" autoComplete="new-password" autoFocus
              leftIcon="lock" placeholder="New password" aria-label="New password"
              intent={errors.password ? Intent.DANGER : Intent.NONE} />
          </FormGroup>

          <FormGroup intent={errors.confirm ? Intent.DANGER : Intent.NONE} helperText={errors.confirm}>
            <InputGroup id="confirm" name="confirm" type="password" autoComplete="new-password"
              className="auth-input-outline" leftIcon="lock" placeholder="Confirm password" aria-label="Confirm password"
              intent={errors.confirm ? Intent.DANGER : Intent.NONE} />
          </FormGroup>

          <Button type="submit" fill intent={Intent.PRIMARY} loading={submitting}>Update password</Button>
        </form>
      )}
    </AuthScreen>
  )
}
