// Layer: Floor — password-reset completion.
//
// The "forgot password" email links here. Supabase parses the recovery token
// from the URL and establishes a temporary session; we wait for that session,
// then let the user set a new password via updateUser. Without this page the
// reset link dead-ends (the bug this fixes).
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button, Card, FormGroup, InputGroup, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import { services } from '@/lib/services'
import { bpRegister } from '@/lib/forms'

const schema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters'),
    confirm:  z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

type Fields = z.infer<typeof schema>

type Status = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')

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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Fields) => {
    try {
      await services.auth.updatePassword(data.password)
      toast.success('Password updated')
      void navigate('/floor', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update password')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Beacon</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hotel Inventory Management</p>
        </div>

        <Card>
          <h2 className="text-xl font-semibold">Set a new password</h2>

          {status === 'checking' && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Spinner size={SpinnerSize.SMALL} /> Verifying your reset link…
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or has expired. Request a fresh one from the sign-in page.
              </p>
              <Button fill onClick={() => { void navigate('/login', { replace: true }) }}>Back to sign in</Button>
            </div>
          )}

          {status === 'ready' && (
            <>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Choose a new password for your account.</p>
              <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} noValidate>
                <FormGroup
                  label="New password"
                  labelFor="password"
                  intent={errors.password ? Intent.DANGER : Intent.NONE}
                  helperText={errors.password?.message}
                >
                  <InputGroup
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    intent={errors.password ? Intent.DANGER : Intent.NONE}
                    {...bpRegister(register('password'))}
                  />
                </FormGroup>

                <FormGroup
                  label="Confirm password"
                  labelFor="confirm"
                  intent={errors.confirm ? Intent.DANGER : Intent.NONE}
                  helperText={errors.confirm?.message}
                >
                  <InputGroup
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    intent={errors.confirm ? Intent.DANGER : Intent.NONE}
                    {...bpRegister(register('confirm'))}
                  />
                </FormGroup>

                <Button type="submit" fill intent={Intent.PRIMARY} loading={isSubmitting}>
                  Update password
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
