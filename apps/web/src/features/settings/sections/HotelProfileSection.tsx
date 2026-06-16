// Hotel: name, address, timezone, display currency.
// Currencies are grouped via native <optgroup> because Blueprint HTMLSelect's
// `options` prop doesn't support labelled groups.

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button, Callout, Card, FormGroup, HTMLSelect, InputGroup, Intent,
} from '@blueprintjs/core'
import { getCurrencySymbol } from '@/lib/currency'
import { useActiveHotel, useUpdateHotel } from '@/features/hotel/hooks'
import { useOrganizations } from '@/features/organizations/hooks'
import { SectionHeader } from './_shared'
import { bpRegister } from '@/lib/forms'

const CURRENCY_GROUPS = [
  {
    label: 'Major / G10',
    currencies: [
      { code: 'USD', name: 'US Dollar' },
      { code: 'EUR', name: 'Euro' },
      { code: 'GBP', name: 'British Pound' },
      { code: 'JPY', name: 'Japanese Yen' },
      { code: 'CHF', name: 'Swiss Franc' },
      { code: 'AUD', name: 'Australian Dollar' },
      { code: 'CAD', name: 'Canadian Dollar' },
      { code: 'NZD', name: 'New Zealand Dollar' },
      { code: 'SEK', name: 'Swedish Krona' },
      { code: 'NOK', name: 'Norwegian Krone' },
      { code: 'DKK', name: 'Danish Krone' },
    ],
  },
  {
    label: 'Asia-Pacific',
    currencies: [
      { code: 'CNY', name: 'Chinese Yuan' },
      { code: 'HKD', name: 'Hong Kong Dollar' },
      { code: 'SGD', name: 'Singapore Dollar' },
      { code: 'KRW', name: 'South Korean Won' },
      { code: 'TWD', name: 'Taiwan Dollar' },
      { code: 'THB', name: 'Thai Baht' },
      { code: 'MYR', name: 'Malaysian Ringgit' },
      { code: 'IDR', name: 'Indonesian Rupiah' },
      { code: 'PHP', name: 'Philippine Peso' },
      { code: 'VND', name: 'Vietnamese Dong' },
      { code: 'INR', name: 'Indian Rupee' },
      { code: 'PKR', name: 'Pakistani Rupee' },
      { code: 'BDT', name: 'Bangladeshi Taka' },
    ],
  },
  {
    label: 'Middle East',
    currencies: [
      { code: 'AED', name: 'UAE Dirham' },
      { code: 'SAR', name: 'Saudi Riyal' },
      { code: 'QAR', name: 'Qatari Riyal' },
      { code: 'KWD', name: 'Kuwaiti Dinar' },
      { code: 'BHD', name: 'Bahraini Dinar' },
      { code: 'OMR', name: 'Omani Rial' },
      { code: 'JOD', name: 'Jordanian Dinar' },
      { code: 'ILS', name: 'Israeli Shekel' },
    ],
  },
  {
    label: 'Europe (non-EUR)',
    currencies: [
      { code: 'PLN', name: 'Polish Zloty' },
      { code: 'CZK', name: 'Czech Koruna' },
      { code: 'HUF', name: 'Hungarian Forint' },
      { code: 'RON', name: 'Romanian Leu' },
      { code: 'TRY', name: 'Turkish Lira' },
      { code: 'RUB', name: 'Russian Ruble' },
      { code: 'UAH', name: 'Ukrainian Hryvnia' },
    ],
  },
  {
    label: 'Americas',
    currencies: [
      { code: 'MXN', name: 'Mexican Peso' },
      { code: 'BRL', name: 'Brazilian Real' },
      { code: 'COP', name: 'Colombian Peso' },
      { code: 'PEN', name: 'Peruvian Sol' },
      { code: 'CLP', name: 'Chilean Peso' },
      { code: 'ARS', name: 'Argentine Peso' },
    ],
  },
  {
    label: 'Africa',
    currencies: [
      { code: 'ZAR', name: 'South African Rand' },
      { code: 'EGP', name: 'Egyptian Pound' },
      { code: 'NGN', name: 'Nigerian Naira' },
      { code: 'KES', name: 'Kenyan Shilling' },
      { code: 'GHS', name: 'Ghanaian Cedi' },
      { code: 'MAD', name: 'Moroccan Dirham' },
    ],
  },
] as const

function CurrencyOptions() {
  return (
    <>
      {CURRENCY_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {getCurrencySymbol(c.code)}  {c.code}  {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}

const hotelSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  currency: z.string().length(3, 'Select a currency'),
})
type HotelFields = z.infer<typeof hotelSchema>

export function HotelProfileSection() {
  const hotel = useActiveHotel()
  const updateHotel = useUpdateHotel()
  const { data: orgs = [] } = useOrganizations()
  const org = orgs.find((o) => o.id === hotel?.organization_id) ?? null

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<HotelFields>({
    resolver: zodResolver(hotelSchema),
    values: hotel
      ? { name: hotel.name, address: hotel.address, timezone: hotel.timezone, currency: hotel.currency }
      : undefined,
  })

  const onSubmit = async (data: HotelFields) => {
    await updateHotel.mutateAsync(data)
    reset(data)
  }

  return (
    <div>
      <SectionHeader title="Hotel Profile" description="Name, address, timezone and display currency for this property." />

      {org && (
        <Callout icon="office" compact className="mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Part of organization
              </p>
              <p className="text-sm font-medium truncate">{org.name}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">Org-scope contracts and benchmarks attach here</span>
          </div>
        </Callout>
      )}

      <Card compact>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
          <FormGroup
            label="Hotel name"
            labelFor="hotel-name"
            intent={errors.name ? Intent.DANGER : Intent.NONE}
            helperText={errors.name?.message}
          >
            <InputGroup id="hotel-name" intent={errors.name ? Intent.DANGER : Intent.NONE} {...bpRegister(register('name'))} />
          </FormGroup>
          <FormGroup
            label="Address"
            labelFor="hotel-address"
            intent={errors.address ? Intent.DANGER : Intent.NONE}
            helperText={errors.address?.message}
          >
            <InputGroup id="hotel-address" intent={errors.address ? Intent.DANGER : Intent.NONE} {...bpRegister(register('address'))} />
          </FormGroup>
          <div className="grid grid-cols-2 gap-3">
            <FormGroup
              label="Timezone"
              labelFor="hotel-timezone"
              intent={errors.timezone ? Intent.DANGER : Intent.NONE}
              helperText={errors.timezone?.message}
            >
              <InputGroup id="hotel-timezone" placeholder="Europe/Athens" intent={errors.timezone ? Intent.DANGER : Intent.NONE} {...bpRegister(register('timezone'))} />
            </FormGroup>
            <FormGroup
              label="Display currency"
              labelFor="hotel-currency"
              intent={errors.currency ? Intent.DANGER : Intent.NONE}
              helperText={errors.currency?.message}
            >
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <HTMLSelect
                    id="hotel-currency"
                    fill
                    value={field.value}
                    onChange={(e) => { field.onChange(e.target.value) }}
                  >
                    <option value="" disabled>Select currency…</option>
                    <CurrencyOptions />
                  </HTMLSelect>
                )}
              />
            </FormGroup>
          </div>
          <Button type="submit" intent={Intent.PRIMARY} disabled={!isDirty} loading={isSubmitting}>
            Save Changes
          </Button>
        </form>
      </Card>
    </div>
  )
}
