import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { services } from '@/lib/services'

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

function LoginForm({ onForgotPassword }: { onForgotPassword: () => void }) {
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFields) => {
    try {
      await services.auth.signIn(data.email, data.password)
      // AuthProvider's onAuthStateChange fires, updates store, AuthGuard lets through
      void navigate('/floor', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      // Surface Supabase's error messages clearly
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
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@hotel.com"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          'Sign in'
        )}
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
        <Button variant="outline" className="w-full" onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@hotel.com"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          'Send reset link'
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onBack}
        disabled={isSubmitting}
      >
        Back to sign in
      </Button>
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
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">
              {view === 'login' ? 'Sign in' : 'Reset password'}
            </CardTitle>
            <CardDescription>
              {view === 'login'
                ? 'Enter your work email and password to continue.'
                : "Enter your email and we'll send a reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {view === 'login' ? (
              <LoginForm onForgotPassword={() => { setView('forgot'); }} />
            ) : (
              <ForgotPasswordForm onBack={() => { setView('login'); }} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
