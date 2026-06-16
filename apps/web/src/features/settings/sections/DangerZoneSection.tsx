// GDPR: right to erasure — anonymise PII for a user across stock logs.

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Button, Callout, FormGroup, InputGroup, Intent,
} from '@blueprintjs/core'
import { supabase } from '@/lib/supabase/client'
import { SectionHeader } from './_shared'
import { bpRegister } from '@/lib/forms'

const gdprSchema = z.object({ email: z.email('Enter a valid email') })
type GdprFields = z.infer<typeof gdprSchema>

export function DangerZoneSection() {
  const [result, setResult] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GdprFields>({
    resolver: zodResolver(gdprSchema),
  })

  const onSubmit = async (data: GdprFields) => {
    setResult(null)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', data.email)
      .maybeSingle<{ id: string }>()

    if (profileError || !profileData) { toast.error('No user found with that email address'); return }

    const { error } = await supabase.rpc('anonymize_user_pii', {
      p_user_id: profileData.id,
      p_user_email: data.email,
    })

    if (error) { toast.error(error.message) } else {
      setResult(`PII for ${data.email} has been anonymised.`)
      reset()
    }
  }

  return (
    <div>
      <SectionHeader
        title="GDPR · Right to Erasure"
        description="Anonymise a user's personally identifiable data from all stock logs within this hotel. This action is irreversible."
      />
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-3 max-w-sm">
        <FormGroup
          label="User email"
          labelFor="gdpr-email"
          intent={errors.email ? Intent.DANGER : Intent.NONE}
          helperText={errors.email?.message}
        >
          <InputGroup
            id="gdpr-email"
            type="email"
            placeholder="user@example.com"
            intent={errors.email ? Intent.DANGER : Intent.NONE}
            {...bpRegister(register('email'))}
          />
        </FormGroup>
        {result && (
          <Callout intent={Intent.SUCCESS} icon="tick" compact>{result}</Callout>
        )}
        <Button type="submit" intent={Intent.DANGER} loading={isSubmitting}>
          Anonymise User Data
        </Button>
      </form>
    </div>
  )
}
