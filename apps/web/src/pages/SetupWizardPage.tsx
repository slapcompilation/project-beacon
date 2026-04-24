// Layer: Cross-layer — First-run onboarding wizard
// Sprint 1 gap: self-serve setup for new hotels.
// Steps: (1) Hotel profile → (2) First product → (3) First supplier → (4) Done
// Every step is skippable. Wizard is accessible via /setup and prompted from Briefing
// when the hotel has zero products.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Building2, Package, Truck, CheckCircle2,
  ArrowRight, Loader2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useActiveHotel, useUpdateHotel } from '@/features/hotel/hooks'
import { useCreateProduct } from '@/features/inventory/hooks'
import { useCreateSupplier } from '@/features/suppliers/hooks'

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, icon: Building2, label: 'Hotel profile'    },
  { id: 2, icon: Package,   label: 'First product'    },
  { id: 3, icon: Truck,     label: 'First supplier'   },
  { id: 4, icon: CheckCircle2, label: 'Ready'         },
] as const

// ─── Schemas ──────────────────────────────────────────────────────────────────

const hotelSchema = z.object({
  name:     z.string().min(1, 'Required'),
  timezone: z.string().min(1, 'Required'),
  currency: z.string().length(3, 'Must be a 3-letter code'),
  address:  z.string().optional(),
})

const productSchema = z.object({
  name:          z.string().min(1, 'Required'),
  sku:           z.string().min(1, 'Required'),
  cost:          z.number().min(0, 'Must be ≥ 0').catch(0),
  initial_stock: z.number().int().min(0).catch(0),
})

const supplierSchema = z.object({
  name:         z.string().min(1, 'Required'),
  contact_name: z.string().optional(),
  email:        z.string().email('Invalid email').or(z.literal('')).optional(),
  phone:        z.string().optional(),
})

type HotelForm    = z.infer<typeof hotelSchema>
type ProductForm  = z.infer<typeof productSchema>
type SupplierForm = z.infer<typeof supplierSchema>

// ─── Step 1 — Hotel profile ───────────────────────────────────────────────────

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

  // Populate form once hotel data loads (avoids empty fields on first render)
  useEffect(() => {
    if (!hotel) return
    form.reset({
      name:     hotel.name     ?? '',
      timezone: hotel.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: hotel.currency ?? 'USD',
      address:  hotel.address  ?? '',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel?.id])

  const onSubmit = async (data: HotelForm) => {
    if (!hotel) return
    await updateProfile.mutateAsync({ ...data, address: data.address ?? '' })
    onNext()
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4">
      <div className="space-y-1">
        <Label>Hotel name *</Label>
        <Input {...register('name')} placeholder="Grand Beacon Hotel" />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Currency *</Label>
          <Input {...register('currency')} placeholder="USD" maxLength={3} className="uppercase" />
          {errors.currency && <p className="text-xs text-red-500">{errors.currency.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Timezone *</Label>
          <Input {...register('timezone')} placeholder="America/New_York" />
          {errors.timezone && <p className="text-xs text-red-500">{errors.timezone.message}</p>}
        </div>
      </div>
      <div className="space-y-1">
        <Label>Address <span className="text-muted-foreground">(optional)</span></Label>
        <Input {...register('address')} placeholder="123 Main St, City" />
      </div>
      <WizardActions isSubmitting={isSubmitting} onSkip={onSkip} submitLabel="Save & continue" />
    </form>
  )
}

// ─── Step 2 — First product ───────────────────────────────────────────────────

function StepProduct({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const createProduct = useCreateProduct()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { cost: 0, initial_stock: 0 },
  })

  const onSubmit = async (data: ProductForm) => {
    await createProduct.mutateAsync({
      name:          data.name,
      sku:           data.sku,
      cost:          data.cost,
      initial_stock: data.initial_stock,
    })
    onNext()
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4">
      <div className="space-y-1">
        <Label>Product name *</Label>
        <Input {...register('name')} placeholder="Bottled Water 500ml" />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>SKU *</Label>
          <Input {...register('sku')} placeholder="BW-500" />
          {errors.sku && <p className="text-xs text-red-500">{errors.sku.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Unit cost</Label>
          <Input {...register('cost', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="1.50" />
          {errors.cost && <p className="text-xs text-red-500">{errors.cost.message}</p>}
        </div>
      </div>
      <div className="space-y-1">
        <Label>Initial stock on hand</Label>
        <Input {...register('initial_stock', { valueAsNumber: true })} type="number" min="0" placeholder="0" />
        <p className="text-[10px] text-muted-foreground">Current count — creates the opening stock log entry</p>
      </div>
      <WizardActions isSubmitting={isSubmitting} onSkip={onSkip} submitLabel="Add product & continue" />
    </form>
  )
}

// ─── Step 3 — First supplier ──────────────────────────────────────────────────

function StepSupplier({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const createSupplier = useCreateSupplier()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
  })

  const onSubmit = async (data: SupplierForm) => {
    await createSupplier.mutateAsync({
      name:         data.name,
      contact_name: data.contact_name || null,
      email:        data.email        || null,
      phone:        data.phone        || null,
    })
    onNext()
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4">
      <div className="space-y-1">
        <Label>Supplier name *</Label>
        <Input {...register('name')} placeholder="Beverage Co." />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Contact name</Label>
          <Input {...register('contact_name')} placeholder="Jane Smith" />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input {...register('email')} type="email" placeholder="orders@bevco.com" />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>
      </div>
      <div className="space-y-1">
        <Label>Phone</Label>
        <Input {...register('phone')} placeholder="+1 555 0100" />
      </div>
      <WizardActions isSubmitting={isSubmitting} onSkip={onSkip} submitLabel="Add supplier & continue" />
    </form>
  )
}

// ─── Step 4 — Done ────────────────────────────────────────────────────────────

const WORKSPACE_LINKS = [
  { path: '/floor', label: 'Floor',    hint: 'Live stock · Alerts · Expiry · Stocktake' },
  { path: '/flow',  label: 'Flow',     hint: 'Receive goods · Approve restocks · Timeline' },
  { path: '/eye',   label: 'Eye',      hint: 'Waste radar · Predictive restocks · Forecasts' },
  { path: '/mind',  label: 'Mind',     hint: 'Suppliers · Procurement · GL export' },
] as const

function StepDone() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="text-base font-semibold">You're ready</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Your hotel is set up. Explore the four operation layers or go straight to the command centre.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {WORKSPACE_LINKS.map((l) => (
          <button
            key={l.path}
            type="button"
            onClick={() => { void navigate(l.path) }}
            className="rounded-lg border p-3 text-left hover:bg-muted/40 transition-colors"
          >
            <p className="text-xs font-semibold">{l.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{l.hint}</p>
          </button>
        ))}
      </div>
      <Button
        className="w-full"
        onClick={() => { void navigate('/briefing') }}
      >
        Go to Briefing →
      </Button>
    </div>
  )
}

// ─── Shared action row ────────────────────────────────────────────────────────

function WizardActions({
  isSubmitting, onSkip, submitLabel,
}: {
  isSubmitting: boolean
  onSkip: () => void
  submitLabel: string
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <button
        type="button"
        onClick={onSkip}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Skip this step
      </button>
      <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
        {isSubmitting
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <ArrowRight className="h-3.5 w-3.5" />}
        {submitLabel}
      </Button>
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
        const Icon    = s.icon
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
                  ? <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                  : <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground/40')} />}
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

  const next = () => { setStep((s) => Math.min(s + 1, 4)); }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Set up your hotel</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Step {step} of {STEPS.length}</p>
          </div>
          <button
            type="button"
            onClick={() => { void navigate('/briefing') }}
            className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Exit wizard"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Stepper current={step} />

        {/* Card */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {step === 1 && <StepHotel    onNext={next} onSkip={next} />}
          {step === 2 && <StepProduct  onNext={next} onSkip={next} />}
          {step === 3 && <StepSupplier onNext={next} onSkip={next} />}
          {step === 4 && <StepDone />}
        </div>
      </div>
    </div>
  )
}
