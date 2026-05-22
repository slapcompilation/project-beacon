// Layer: Mind — Event Demand Planner
// Breakthrough feature: enter an upcoming event (conference, wedding, gala) and the
// system calculates exactly how much stock will be consumed, surfaces the gaps,
// and generates a targeted purchase order — before the event happens.
// No other inventory system for hotels does this automatically.
// Palantir principle: cross-domain synthesis — calendar + stock + forecast = action.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo, useState } from 'react'
import { parseISO, differenceInDays, isPast } from 'date-fns'
import { toast } from 'sonner'
import {
  Button,
  Callout,
  Card,
  FormGroup,
  HTMLSelect,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
  Tooltip,
} from '@blueprintjs/core'
import { useDateFormat } from '@/features/user/hooks'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from '@/features/events/hooks'
import { useOccupancyAdjustedForecast } from '@/features/eye/hooks'
import { useProducts } from '@/features/inventory/hooks'
import { useCreateRestockRequest } from '@/features/restock/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import type { HotelEvent, EventInput } from '@/features/events/api'

// ─── Event types with demand factor presets ───────────────────────────────────

const EVENT_TYPES: { value: string; label: string; factor: number; description: string }[] = [
  { value: 'conference',   label: 'Conference',    factor: 1.2, description: 'Meetings, workshops, corporate events' },
  { value: 'wedding',      label: 'Wedding',       factor: 2.5, description: 'Full catering, bar, extended service' },
  { value: 'gala',         label: 'Gala / Banquet', factor: 2.2, description: 'Formal dinner, premium consumption' },
  { value: 'sports',       label: 'Sports Event',  factor: 1.8, description: 'High beverage and snack turnover' },
  { value: 'concert',      label: 'Concert',       factor: 2.0, description: 'High bar volume, quick service' },
  { value: 'general',      label: 'General',       factor: 1.5, description: 'Custom multiplier' },
]

// ─── Gap row ──────────────────────────────────────────────────────────────────

interface DemandGap {
  variantId: string
  productName: string
  variantName: string
  sku: string
  currentStock: number
  avgDaily: number
  normalDailyConsumption: number
  eventExtraConsumption: number
  totalRequired: number
  gap: number
  unitCost: number
  gapCost: number
  severity: 'critical' | 'warning' | 'ok'
}

// ─── Event form ───────────────────────────────────────────────────────────────

interface EventFormProps {
  initial?: Partial<EventInput>
  onSave: (input: EventInput) => void
  onCancel: () => void
  saving: boolean
}

function EventForm({ initial, onSave, onCancel, saving }: EventFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [date, setDate] = useState(initial?.event_date ?? '')
  const [guests, setGuests] = useState(String(initial?.guest_count ?? ''))
  const [type, setType] = useState(initial?.event_type ?? 'general')
  const [factor, setFactor] = useState(String(initial?.demand_factor ?? '1.5'))
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const handleTypeChange = (v: string) => {
    setType(v)
    const preset = EVENT_TYPES.find((t) => t.value === v)
    if (preset) setFactor(String(preset.factor))
  }

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Event name is required'); return }
    if (!date) { toast.error('Event date is required'); return }
    const g = parseInt(guests, 10)
    if (isNaN(g) || g < 1) { toast.error('Guest count must be at least 1'); return }
    const f = parseFloat(factor)
    if (isNaN(f) || f <= 0) { toast.error('Demand factor must be > 0'); return }
    onSave({ name: name.trim(), event_date: date, guest_count: g, event_type: type, demand_factor: f, notes: notes.trim() || null })
  }

  return (
    <Card compact>
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="Event Name" className="col-span-2 !mb-0">
          <InputGroup
            placeholder="e.g. Annual Gala Dinner, Tech Conference…"
            value={name}
            onChange={(e) => { setName(e.target.value) }}
            autoFocus
          />
        </FormGroup>
        <FormGroup label="Event Date" className="!mb-0">
          <InputGroup
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value) }}
          />
        </FormGroup>
        <FormGroup label="Expected Guests" className="!mb-0">
          <InputGroup
            type="number"
            min={1}
            placeholder="e.g. 200"
            value={guests}
            onChange={(e) => { setGuests(e.target.value) }}
          />
        </FormGroup>
        <FormGroup label="Event Type" className="!mb-0">
          <HTMLSelect
            fill
            value={type}
            onChange={(e) => { handleTypeChange(e.target.value) }}
            options={EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </FormGroup>
        <FormGroup
          label={
            <span className="flex items-center gap-1">
              Demand Multiplier
              <Tooltip content="How many times more than normal daily consumption this event generates">
                <Icon icon="info-sign" size={12} className="text-muted-foreground" />
              </Tooltip>
            </span>
          }
          helperText={parseFloat(factor) > 0 ? `${String(parseFloat(factor))}× normal daily consumption` : ''}
          className="!mb-0"
        >
          <InputGroup
            type="number"
            step={0.1}
            min={0.1}
            placeholder="e.g. 2.5"
            value={factor}
            onChange={(e) => { setFactor(e.target.value) }}
          />
        </FormGroup>
        <FormGroup label="Notes (optional)" className="col-span-2 !mb-0">
          <InputGroup
            placeholder="Any special requirements or notes…"
            value={notes}
            onChange={(e) => { setNotes(e.target.value) }}
          />
        </FormGroup>
      </div>
      <div className="flex items-center justify-end gap-2 pt-3 mt-2">
        <Button variant="minimal" onClick={onCancel}>Cancel</Button>
        <Button icon="tick" intent={Intent.PRIMARY} onClick={handleSubmit} loading={saving}>
          Save Event
        </Button>
      </div>
    </Card>
  )
}

// ─── Event card ───────────────────────────────────────────────────────────────

interface EventCardProps {
  event: HotelEvent
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  gaps: DemandGap[]
  currency: string
}

function EventCardRow({ event, isSelected, onSelect, onDelete, gaps, currency }: EventCardProps) {
  const fmtDate = useDateFormat()
  const daysAway = differenceInDays(parseISO(event.event_date), new Date())
  const past = isPast(parseISO(event.event_date))
  const criticalGaps = gaps.filter((g) => g.severity === 'critical').length
  const totalGapCost = gaps.filter((g) => g.gap > 0).reduce((s, g) => s + g.gapCost, 0)
  const eventTypeCfg = EVENT_TYPES.find((t) => t.value === event.event_type) ?? EVENT_TYPES[EVENT_TYPES.length - 1]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded border p-4 transition-all',
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'hover:border-border/80 hover:bg-muted/20',
        past ? 'opacity-60' : '',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{event.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(parseISO(event.event_date))}
            {!past && <span className="ml-1.5 font-medium text-foreground">· {daysAway}d away</span>}
            {past && <span className="ml-1.5 text-muted-foreground">(past)</span>}
          </p>
        </div>
        <Button
          icon="trash"
          variant="minimal"
          size="small"
          intent={Intent.DANGER}
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          aria-label="Delete event"
        />
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{event.guest_count} guests</span>
        <span>{eventTypeCfg.label}</span>
        <span>{event.demand_factor}× multiplier</span>
      </div>
      {gaps.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          {criticalGaps > 0 && (
            <Tag intent={Intent.DANGER} minimal>
              {criticalGaps} critical gap{criticalGaps !== 1 ? 's' : ''}
            </Tag>
          )}
          {totalGapCost > 0 && (
            <Tag minimal>{formatCurrency(totalGapCost, currency)} to order</Tag>
          )}
        </div>
      )}
    </button>
  )
}

// ─── Gap table ────────────────────────────────────────────────────────────────

function GapTable({ gaps, currency }: { gaps: DemandGap[]; currency: string }) {
  const withGaps  = gaps.filter((g) => g.gap > 0).sort((a, b) => b.gapCost - a.gapCost)
  const withoutGaps = gaps.filter((g) => g.gap === 0)
  const [showOk, setShowOk] = useState(false)

  if (gaps.length === 0) {
    return (
      <NonIdealState
        icon="box"
        title="No consumption data available"
        description="Items need at least some usage history to project demand gaps."
      />
    )
  }

  return (
    <div>
      {withGaps.length === 0 ? (
        <Callout intent={Intent.SUCCESS} icon="tick" compact>
          All stock levels are sufficient for this event. No gaps detected.
        </Callout>
      ) : (
        <Card compact className="!p-0 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pl-4 pr-2 w-24">Severity</th>
                <th className="py-2 px-2">Product</th>
                <th className="py-2 px-2 text-right w-20">Stock</th>
                <th className="py-2 px-2 text-right w-28">Event Need</th>
                <th className="py-2 px-2 text-right w-20 text-red-600">Gap</th>
                <th className="py-2 px-2 text-right w-24">Unit Cost</th>
                <th className="py-2 pl-2 pr-4 text-right w-24">Gap Cost</th>
              </tr>
            </thead>
            <tbody>
              {withGaps.map((g) => (
                <tr key={g.variantId} className={cn(
                  'border-b border-border/50',
                  g.severity === 'critical' ? 'bg-red-50/30 dark:bg-red-950/10' : 'bg-yellow-50/20 dark:bg-yellow-950/5',
                )}>
                  <td className="py-2.5 pl-4 pr-2">
                    {g.severity === 'critical' ? (
                      <Tag intent={Intent.DANGER} minimal icon="warning-sign">Critical</Tag>
                    ) : (
                      <Tag intent={Intent.WARNING} minimal icon="trending-up">Warning</Tag>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    <p className="text-sm font-medium leading-tight">
                      {g.variantName !== 'Standard' ? `${g.productName} — ${g.variantName}` : g.productName}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">{g.sku}</p>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="tabular-nums text-sm">{g.currentStock}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="tabular-nums text-sm font-medium">{g.totalRequired}</span>
                    <p className="text-[10px] text-muted-foreground">
                      {g.normalDailyConsumption > 0 ? `${String(g.normalDailyConsumption)} normal + ` : ''}{String(g.eventExtraConsumption)} event
                    </p>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="tabular-nums text-sm font-bold text-red-600">−{g.gap}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(g.unitCost, currency)}</span>
                  </td>
                  <td className="py-2.5 pl-2 pr-4 text-right">
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(g.gapCost, currency)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/20">
                <td colSpan={5} className="py-2 pl-4 text-xs text-muted-foreground">
                  {withGaps.length} item{withGaps.length !== 1 ? 's' : ''} need restocking
                </td>
                <td className="py-2 px-2 text-right text-xs text-muted-foreground">Total gap cost</td>
                <td className="py-2 pl-2 pr-4 text-right font-bold text-sm tabular-nums">
                  {formatCurrency(withGaps.reduce((s, g) => s + g.gapCost, 0), currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {/* Sufficient stock items */}
      {withoutGaps.length > 0 && (
        <div className="mt-3">
          <Button
            variant="minimal"
            size="small"
            icon={showOk ? 'chevron-down' : 'chevron-right'}
            onClick={() => { setShowOk((v) => !v) }}
          >
            {withoutGaps.length} item{withoutGaps.length !== 1 ? 's' : ''} have sufficient stock
          </Button>
          {showOk && (
            <Card compact className="mt-2 !p-0 overflow-hidden">
              <table className="w-full text-left">
                <tbody>
                  {withoutGaps.map((g) => (
                    <tr key={g.variantId} className="border-b border-border/30 last:border-0">
                      <td className="py-2 pl-4 pr-2">
                        <Tag intent={Intent.SUCCESS} minimal icon="tick">OK</Tag>
                      </td>
                      <td className="py-2 px-2">
                        <p className="text-xs font-medium">
                          {g.variantName !== 'Standard' ? `${g.productName} — ${g.variantName}` : g.productName}
                        </p>
                      </td>
                      <td className="py-2 px-2 text-right text-xs text-muted-foreground tabular-nums">
                        {g.currentStock} stock · {g.totalRequired} needed
                      </td>
                      <td className="py-2 pl-2 pr-4 text-right">
                        <span className="text-[10px] text-green-600 font-medium">+{g.currentStock - g.totalRequired} surplus</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventDemandPage() {
  const currency    = useCurrency()
  const fmtDate = useDateFormat()

  const { data: events = [], isLoading: eventsLoading } = useEvents()
  const { data: forecast = [], isLoading: forecastLoading } = useOccupancyAdjustedForecast(14, 30)
  const { data: products = [] } = useProducts()
  const createEvent  = useCreateEvent()
  const updateEvent  = useUpdateEvent()
  const deleteEvent  = useDeleteEvent()
  const createRestock = useCreateRestockRequest()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const costMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) {
      for (const v of p.product_variants) m.set(v.id, v.cost)
    }
    return m
  }, [products])

  const effectiveSelected = selectedId
    ? events.find((e) => e.id === selectedId) ?? null
    : events[0] ?? null

  const demandGaps = useMemo<DemandGap[]>(() => {
    if (!effectiveSelected || forecast.length === 0) return []

    const eventDate = parseISO(effectiveSelected.event_date)
    const daysUntil = Math.max(0, differenceInDays(eventDate, new Date()))
    const { demand_factor: factor } = effectiveSelected

    return forecast
      .filter((r) => r.adjusted_avg_daily > 0)
      .map((r) => {
        const unitCost = costMap.get(r.variant_id) ?? 0
        const normalDailyConsumption = Math.ceil(r.adjusted_avg_daily * daysUntil)
        const eventExtraConsumption = Math.ceil(r.adjusted_avg_daily * (factor - 1))
        const totalRequired = normalDailyConsumption + eventExtraConsumption
        const gap = Math.max(0, totalRequired - r.current_stock)
        const gapCost = gap * unitCost
        const severity: DemandGap['severity'] =
          gap === 0 ? 'ok'
          : r.current_stock === 0 ? 'critical'
          : gap > r.current_stock * 0.5 ? 'critical'
          : 'warning'

        return {
          variantId: r.variant_id,
          productName: r.product_name,
          variantName: r.variant_name,
          sku: r.sku,
          currentStock: r.current_stock,
          avgDaily: r.adjusted_avg_daily,
          normalDailyConsumption,
          eventExtraConsumption,
          totalRequired,
          gap,
          unitCost,
          gapCost,
          severity,
        }
      })
      .sort((a, b) => {
        if (a.severity !== b.severity) {
          const o: Record<DemandGap['severity'], number> = { critical: 0, warning: 1, ok: 2 }
          return o[a.severity] - o[b.severity]
        }
        return b.gapCost - a.gapCost
      })
  }, [effectiveSelected, forecast, costMap])

  const handleCreate = (input: EventInput) => {
    createEvent.mutate(input, {
      onSuccess: () => { setShowForm(false) },
    })
  }

  const handleUpdate = (input: EventInput) => {
    if (!editingId) return
    updateEvent.mutate({ id: editingId, input }, {
      onSuccess: () => { setEditingId(null) },
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this event?')) return
    deleteEvent.mutate(id)
    if (selectedId === id) setSelectedId(null)
  }

  const handleGoToPO = () => {
    if (!effectiveSelected) return
    window.location.href = '/purchase-orders'
  }

  const handleCreateRestocks = () => {
    if (!effectiveSelected) return
    const gapsToRestock = demandGaps.filter((g) => g.gap > 0)
    if (gapsToRestock.length === 0) return
    for (const gap of gapsToRestock) {
      createRestock.mutate({
        variantId: gap.variantId,
        quantityNeeded: gap.gap,
        notes: `Event prep: ${effectiveSelected.name} (${effectiveSelected.event_date}) · ${gap.gap} units needed`,
      })
    }
    toast.success(`${String(gapsToRestock.length)} restock request${gapsToRestock.length !== 1 ? 's' : ''} created`)
  }

  const isLoading = eventsLoading || forecastLoading

  const totalGaps   = demandGaps.filter((g) => g.gap > 0).length
  const criticalCount = demandGaps.filter((g) => g.severity === 'critical').length
  const totalGapCost  = demandGaps.filter((g) => g.gap > 0).reduce((s, g) => s + g.gapCost, 0)
  const upcomingEvents = events.filter((e) => !isPast(parseISO(e.event_date))).length

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-start justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Icon icon="calendar" size={20} className="text-muted-foreground" />
            Event Demand Planner
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${String(upcomingEvents)} upcoming event${upcomingEvents !== 1 ? 's' : ''} · pre-calculate consumption gaps before they become stockouts`}
          </p>
        </div>
        <Button icon="plus" intent={Intent.PRIMARY} size="small" onClick={() => { setShowForm(true) }}>
          Add Event
        </Button>
      </div>

      {/* Body — split pane */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — event list */}
        <div className="w-72 flex-shrink-0 border-r flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">

            {showForm && (
              <EventForm
                onSave={handleCreate}
                onCancel={() => { setShowForm(false) }}
                saving={createEvent.isPending}
              />
            )}

            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Spinner size={SpinnerSize.STANDARD} />
              </div>
            ) : events.length === 0 && !showForm ? (
              <NonIdealState
                icon="calendar"
                title="No events yet"
                description="Add your first event to see predicted stock gaps."
                action={
                  <Button icon="plus" intent={Intent.PRIMARY} size="small" onClick={() => { setShowForm(true) }}>
                    Add Event
                  </Button>
                }
              />
            ) : (
              events.map((event) => (
                editingId === event.id ? (
                  <EventForm
                    key={event.id}
                    initial={{
                      name: event.name,
                      event_date: event.event_date,
                      guest_count: event.guest_count,
                      event_type: event.event_type,
                      demand_factor: event.demand_factor,
                      notes: event.notes,
                    }}
                    onSave={handleUpdate}
                    onCancel={() => { setEditingId(null) }}
                    saving={updateEvent.isPending}
                  />
                ) : (
                  <div key={event.id} className="group relative">
                    <EventCardRow
                      event={event}
                      isSelected={effectiveSelected?.id === event.id}
                      onSelect={() => { setSelectedId(event.id) }}
                      onDelete={() => { handleDelete(event.id) }}
                      gaps={effectiveSelected?.id === event.id ? demandGaps : []}
                      currency={currency}
                    />
                    <Button
                      icon="edit"
                      variant="minimal"
                      size="small"
                      onClick={() => { setEditingId(event.id) }}
                      aria-label="Edit event"
                      className="!absolute right-9 top-3 !opacity-0 group-hover:!opacity-100"
                    />
                  </div>
                )
              ))
            )}
          </div>
        </div>

        {/* Right — gap analysis */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!effectiveSelected ? (
            <NonIdealState
              icon="calendar"
              title="No event selected"
              description="Create an event and select it to see projected stock gaps and the estimated cost to fill them before the event."
            />
          ) : (
            <>
              {/* Selected event KPI strip */}
              <div className="border-b px-6 py-4 flex items-center justify-between bg-muted/10 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold">{effectiveSelected.name}</h2>
                    {isPast(parseISO(effectiveSelected.event_date)) ? (
                      <Tag minimal>Past</Tag>
                    ) : (
                      <Tag intent={Intent.PRIMARY} minimal>
                        {differenceInDays(parseISO(effectiveSelected.event_date), new Date())}d away
                      </Tag>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(parseISO(effectiveSelected.event_date))} · {effectiveSelected.guest_count} guests · {effectiveSelected.demand_factor}× demand factor
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <p className={cn('text-lg font-bold tabular-nums leading-none', criticalCount > 0 ? 'text-red-600' : '')}>
                      {totalGaps}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">stock gaps</p>
                  </div>
                  <div className="text-center">
                    <p className={cn('text-lg font-bold tabular-nums leading-none', totalGapCost > 0 ? '' : 'text-muted-foreground')}>
                      {totalGapCost > 0 ? formatCurrency(totalGapCost, currency) : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">to order</p>
                  </div>
                  {totalGaps > 0 && (
                    <>
                      <Button
                        icon="shopping-cart"
                        intent={Intent.PRIMARY}
                        size="small"
                        onClick={handleCreateRestocks}
                        loading={createRestock.isPending}
                      >
                        Create Restocks ({totalGaps})
                      </Button>
                      <Button icon="shopping-cart" size="small" onClick={handleGoToPO}>
                        Go to PO Engine
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <Callout icon="info-sign" compact className="!border-x-0 !rounded-none">
                Gap = (occupancy-adjusted daily × days until event) + (adjusted_daily × {effectiveSelected.demand_factor - 1 > 0 ? `(${String(effectiveSelected.demand_factor)} − 1) event spike` : `0 extra`}) − current stock
                · Based on 30-day consumption history adjusted for forecasted occupancy
              </Callout>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {forecastLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Spinner size={SpinnerSize.STANDARD} />
                  </div>
                ) : (
                  <GapTable gaps={demandGaps} currency={currency} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
