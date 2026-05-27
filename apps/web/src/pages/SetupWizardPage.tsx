// Layer: Cross-layer — First-run onboarding wizard
//
// Hotel-structure-only setup. Steps: (1) Hotel profile → (2) Categories →
// (3) Locations → (4) Team → (5) Done. Every step is skippable.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button,
  Card,
  FormGroup,
  HTMLSelect,
  Icon,
  InputGroup,
  Intent,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useActiveHotel, useUpdateHotel } from '@/features/hotel/hooks'
import { useCategories, useCreateCategory } from '@/features/categories/hooks'
import { useLocations, useCreateLocation } from '@/features/locations/hooks'
import { useTeamMembers, useInviteTeamMember } from '@/features/team/hooks'

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS: { id: number; icon: IconName; label: string }[] = [
  { id: 1, icon: 'office',       label: 'Hotel profile' },
  { id: 2, icon: 'folder-open',  label: 'Categories'    },
  { id: 3, icon: 'map-marker',   label: 'Locations'     },
  { id: 4, icon: 'people',       label: 'Team'          },
  { id: 5, icon: 'tick-circle',  label: 'Ready'         },
]

// ─── Step 1 — Hotel profile ───────────────────────────────────────────────────

const hotelSchema = z.object({
  name:     z.string().min(1, 'Required'),
  timezone: z.string().min(1, 'Required'),
  currency: z.string().length(3, 'Must be a 3-letter code'),
  address:  z.string().optional(),
})
type HotelForm = z.infer<typeof hotelSchema>

function StepHotel({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const hotel         = useActiveHotel()
  const updateProfile = useUpdateHotel()

  const form = useForm<HotelForm>({
    resolver: zodResolver(hotelSchema),
    defaultValues: {
      name:     '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: 'USD',
      address:  '',
    },
  })
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form

  useEffect(() => {
    if (!hotel) return
    form.reset({
      name:     hotel.name,
      timezone: hotel.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: hotel.currency || 'USD',
      address:  hotel.address,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel?.id])

  const onSubmit = async (data: HotelForm) => {
    if (!hotel) return
    await updateProfile.mutateAsync({ ...data, address: data.address ?? '' })
    onNext()
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
      <FormGroup
        label="Hotel name *"
        intent={errors.name ? Intent.DANGER : Intent.NONE}
        helperText={errors.name?.message}
      >
        <InputGroup
          {...register('name')}
          placeholder="Grand Beacon Hotel"
          intent={errors.name ? Intent.DANGER : Intent.NONE}
        />
      </FormGroup>
      <div className="grid grid-cols-2 gap-3">
        <FormGroup
          label="Currency *"
          intent={errors.currency ? Intent.DANGER : Intent.NONE}
          helperText={errors.currency?.message}
        >
          <InputGroup
            {...register('currency')}
            placeholder="USD"
            maxLength={3}
            className="uppercase"
            intent={errors.currency ? Intent.DANGER : Intent.NONE}
          />
        </FormGroup>
        <FormGroup
          label="Timezone *"
          intent={errors.timezone ? Intent.DANGER : Intent.NONE}
          helperText={errors.timezone?.message}
        >
          <InputGroup
            {...register('timezone')}
            placeholder="America/New_York"
            intent={errors.timezone ? Intent.DANGER : Intent.NONE}
          />
        </FormGroup>
      </div>
      <FormGroup label="Address" labelInfo="(optional)">
        <InputGroup {...register('address')} placeholder="123 Main St, City" />
      </FormGroup>
      <WizardActions isSubmitting={isSubmitting} onSkip={onSkip} submitLabel="Save & continue" />
    </form>
  )
}

// ─── Inline-list step shell ──────────────────────────────────────────────────

function ItemRow({ icon, label, sub }: { icon: IconName; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded border bg-muted/20">
      <Icon icon={icon} size={14} className="text-muted-foreground flex-shrink-0" />
      <span className="text-sm flex-1 truncate">{label}</span>
      {sub && <span className="text-[10px] text-muted-foreground shrink-0">{sub}</span>}
    </div>
  )
}

// ─── Step 2 — Categories ─────────────────────────────────────────────────────

function StepCategories({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { data: categories = [] } = useCategories()
  const createCategory = useCreateCategory()
  const [name, setName] = useState('')
  const topLevel = categories.filter((c) => !c.parent_id)

  const handleAdd = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    await createCategory.mutateAsync({ name: trimmed, parentId: null })
    setName('')
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Organise products by category — beverages, linens, F&amp;B, amenities… You can nest sub-categories later.
      </p>

      {topLevel.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {topLevel.map((c) => (
            <ItemRow key={c.id} icon="folder-open" label={c.name} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <InputGroup
          value={name}
          onChange={(e) => { setName(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAdd() } }}
          placeholder="e.g. Beverages"
          className="flex-1"
        />
        <Button
          icon="plus"
          intent={Intent.PRIMARY}
          onClick={() => void handleAdd()}
          disabled={!name.trim()}
          loading={createCategory.isPending}
        >
          Add
        </Button>
      </div>

      <WizardActions
        isSubmitting={false}
        onSkip={onSkip}
        submitLabel={topLevel.length > 0 ? 'Continue' : 'Skip & continue'}
        onSubmit={onNext}
      />
    </div>
  )
}

// ─── Step 3 — Locations ──────────────────────────────────────────────────────

function StepLocations({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { data: locations = [] } = useLocations()
  const createLocation = useCreateLocation()
  const [name, setName] = useState('')
  const topLevel = locations.filter((l) => !l.parent_id)

  const handleAdd = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    await createLocation.mutateAsync({ name: trimmed, parent_id: null })
    setName('')
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Where stock is physically held — main bar, kitchen, housekeeping cart, room blocks. Sub-locations can be nested later.
      </p>

      {topLevel.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {topLevel.map((l) => (
            <ItemRow key={l.id} icon="map-marker" label={l.name} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <InputGroup
          value={name}
          onChange={(e) => { setName(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAdd() } }}
          placeholder="e.g. Main bar"
          className="flex-1"
        />
        <Button
          icon="plus"
          intent={Intent.PRIMARY}
          onClick={() => void handleAdd()}
          disabled={!name.trim()}
          loading={createLocation.isPending}
        >
          Add
        </Button>
      </div>

      <WizardActions
        isSubmitting={false}
        onSkip={onSkip}
        submitLabel={topLevel.length > 0 ? 'Continue' : 'Skip & continue'}
        onSubmit={onNext}
      />
    </div>
  )
}

// ─── Step 4 — Team ────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.email('Invalid email').optional().or(z.literal('')),
  role:  z.enum(['admin', 'team_member', 'limited_access']),
})
type InviteForm = z.infer<typeof inviteSchema>

function StepTeam({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { data: members = [] } = useTeamMembers()
  const invite = useInviteTeamMember()

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<InviteForm>({
      resolver: zodResolver(inviteSchema),
      defaultValues: { email: '', role: 'team_member' },
    })
  const role = watch('role')

  const onAdd = async (data: InviteForm) => {
    if (!data.email) return
    await invite.mutateAsync({ email: data.email, role: data.role })
    reset({ email: '', role: data.role })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Invite teammates by email. They&apos;ll get an invite link to sign in. You can manage roles later from Settings → Team.
      </p>

      {members.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {members.map((m) => (
            <ItemRow
              key={m.id}
              icon={m.role === 'owner' ? 'crown' : 'user'}
              label={m.email}
              sub={m.role}
            />
          ))}
        </div>
      )}

      <form onSubmit={(e) => { void handleSubmit(onAdd)(e) }} className="space-y-2">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <InputGroup
            type="email"
            {...register('email')}
            placeholder="colleague@hotel.com"
            intent={errors.email ? Intent.DANGER : Intent.NONE}
          />
          <HTMLSelect
            value={role}
            onChange={(e) => { reset({ email: watch('email'), role: e.target.value as InviteForm['role'] }) }}
            options={[
              { value: 'admin',          label: 'Admin' },
              { value: 'team_member',    label: 'Team Member' },
              { value: 'limited_access', label: 'Limited Access' },
            ]}
          />
        </div>
        {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        <div className="flex justify-end">
          <Button type="submit" icon="plus" intent={Intent.PRIMARY} loading={isSubmitting}>
            Send invite
          </Button>
        </div>
      </form>

      <WizardActions
        isSubmitting={false}
        onSkip={onSkip}
        submitLabel={members.length > 1 ? 'Continue' : 'Skip & finish'}
        onSubmit={onNext}
      />
    </div>
  )
}

// ─── Step 5 — Done ────────────────────────────────────────────────────────────

const WORKSPACE_LINKS = [
  { path: '/floor', label: 'Floor', hint: 'Live stock · Alerts · Stocktake' },
  { path: '/flow',  label: 'Flow',  hint: 'Receive · Approvals · Movement' },
  { path: '/eye',   label: 'Eye',   hint: 'Waste radar · Forecasts · Anomalies' },
  { path: '/mind',  label: 'Mind',  hint: 'Suppliers · Finance · Strategy' },
] as const

function StepDone() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Icon icon="tick-circle" size={40} intent={Intent.SUCCESS} />
        <p className="text-base font-semibold">You&apos;re ready</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Your hotel structure is set up. Add products, suppliers, and stock from the operations layers.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {WORKSPACE_LINKS.map((l) => (
          <Card key={l.path} interactive onClick={() => { void navigate(l.path) }} compact>
            <p className="text-xs font-semibold">{l.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{l.hint}</p>
          </Card>
        ))}
      </div>
      <Button fill intent={Intent.PRIMARY} endIcon="arrow-right" onClick={() => { void navigate('/briefing') }}>
        Go to Briefing
      </Button>
    </div>
  )
}

// ─── Shared action row ────────────────────────────────────────────────────────

function WizardActions({
  isSubmitting, onSkip, submitLabel, onSubmit,
}: {
  isSubmitting: boolean
  onSkip:       () => void
  submitLabel:  string
  /** When provided, the action row renders a button instead of a form-submit. */
  onSubmit?:    () => void
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <Button variant="minimal" size="small" onClick={onSkip}>
        Skip this step
      </Button>
      {onSubmit ? (
        <Button type="button" icon="arrow-right" intent={Intent.PRIMARY} onClick={onSubmit} disabled={isSubmitting}>
          {submitLabel}
        </Button>
      ) : (
        <Button type="submit" icon="arrow-right" intent={Intent.PRIMARY} loading={isSubmitting}>
          {submitLabel}
        </Button>
      )}
    </div>
  )
}

// ─── Progress stepper ─────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done    = s.id < current
        const active  = s.id === current
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors',
                done   ? 'border-primary bg-primary'            :
                active ? 'border-primary bg-background'         :
                         'border-muted-foreground/30 bg-muted/20',
              )}>
                {done
                  ? <Icon icon="tick-circle" size={14} className="text-primary-foreground" />
                  : <Icon icon={s.icon} size={14} className={active ? 'text-primary' : 'text-muted-foreground/40'} />}
              </div>
              <span className={cn('text-[9px] font-medium uppercase tracking-wide whitespace-nowrap',
                active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground/40',
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-px mx-2 mb-5 transition-colors',
                done ? 'bg-primary' : 'bg-muted-foreground/20',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SetupWizardPage() {
  const navigate     = useNavigate()
  const [step, setStep] = useState(1)

  const next = () => { setStep((s) => Math.min(s + 1, STEPS.length)); }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Set up your hotel</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Step {step} of {STEPS.length}</p>
          </div>
          <Button
            icon="cross"
            variant="minimal"
            aria-label="Exit wizard"
            onClick={() => { void navigate('/briefing') }}
          />
        </div>

        <Stepper current={step} />

        <Card>
          {step === 1 && <StepHotel       onNext={next} onSkip={next} />}
          {step === 2 && <StepCategories  onNext={next} onSkip={next} />}
          {step === 3 && <StepLocations   onNext={next} onSkip={next} />}
          {step === 4 && <StepTeam        onNext={next} onSkip={next} />}
          {step === 5 && <StepDone />}
        </Card>
      </div>
    </div>
  )
}
