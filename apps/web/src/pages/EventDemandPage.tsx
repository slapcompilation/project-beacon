// Layer: Mind — Event Demand Planner
// Breakthrough feature: enter an upcoming event (conference, wedding, gala) and the
// system calculates exactly how much stock will be consumed, surfaces the gaps,
// and generates a targeted purchase order — before the event happens.
// No other inventory system for hotels does this automatically.
// Palantir principle: cross-domain synthesis — calendar + stock + forecast = action.

import { useMemo, useState } from 'react'
import {
  CalendarDays, Plus, Trash2, ShoppingCart, AlertTriangle,
  TrendingUp, Package, ChevronDown, ChevronRight, Info, Edit2, Check,
} from 'lucide-react'
import { parseISO, differenceInDays, isPast } from 'date-fns'
import { useDateFormat } from '@/features/user/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  normalDailyConsumption: number    // what would normally be used before event
  eventExtraConsumption: number     // additional from event multiplier
  totalRequired: number             // normal + event extra
  gap: number                       // max(0, totalRequired - currentStock)
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
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Event Name</label>
          <Input
            placeholder="e.g. Annual Gala Dinner, Tech Conference…"
            value={name}
            onChange={(e) => { setName(e.target.value) }}
            className="h-9"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Event Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value) }}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Expected Guests</label>
          <Input
            type="number"
            min={1}
            placeholder="e.g. 200"
            value={guests}
            onChange={(e) => { setGuests(e.target.value) }}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Event Type</label>
          <Select value={type} onValueChange={handleTypeChange}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <div>
                    <p className="font-medium">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground">{t.description}</p>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            Demand Multiplier
            <span title="How many times more than normal daily consumption this event generates">
              <Info className="h-3 w-3 text-muted-foreground" />
            </span>
          </label>
          <Input
            type="number"
            step={0.1}
            min={0.1}
            placeholder="e.g. 2.5"
            value={factor}
            onChange={(e) => { setFactor(e.target.value) }}
            className="h-9"
          />
          <p className="text-[10px] text-muted-foreground">
            {parseFloat(factor) > 0 ? `${String(parseFloat(factor))}× normal daily consumption` : ''}
          </p>
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
          <Input
            placeholder="Any special requirements or notes…"
            value={notes}
            onChange={(e) => { setNotes(e.target.value) }}
            className="h-9"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={saving} className="gap-1.5">
          <Check className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save Event'}
        </Button>
      </div>
    </div>
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

function EventCard({ event, isSelected, onSelect, onDelete, gaps, currency }: EventCardProps) {
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
        'w-full text-left rounded-lg border p-4 transition-all',
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
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{event.guest_count} guests</span>
        <span>{eventTypeCfg.label}</span>
        <span>{event.demand_factor}× multiplier</span>
      </div>
      {gaps.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          {criticalGaps > 0 && (
            <Badge variant="outline" className="text-[10px] border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 h-4.5">
              {criticalGaps} critical gap{criticalGaps !== 1 ? 's' : ''}
            </Badge>
          )}
          {totalGapCost > 0 && (
            <Badge variant="outline" className="text-[10px] h-4.5">
              {formatCurrency(totalGapCost, currency)} to order
            </Badge>
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
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="rounded-full bg-muted/50 p-4">
          <Package className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium">No consumption data available</p>
        <p className="text-xs text-muted-foreground">
          Items need at least some usage history to project demand gaps.
        </p>
      </div>
    )
  }

  return (
    <div>
      {withGaps.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <Check className="h-4 w-4 flex-shrink-0" />
          <span>All stock levels are sufficient for this event. No gaps detected.</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
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
                      <div className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Critical</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Warning</span>
                      </div>
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
        </div>
      )}

      {/* Sufficient stock items */}
      {withoutGaps.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => { setShowOk((v) => !v) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showOk ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {withoutGaps.length} item{withoutGaps.length !== 1 ? 's' : ''} have sufficient stock
          </button>
          {showOk && (
            <div className="mt-2 rounded-lg border overflow-hidden">
              <table className="w-full text-left">
                <tbody>
                  {withoutGaps.map((g) => (
                    <tr key={g.variantId} className="border-b border-border/30 last:border-0">
                      <td className="py-2 pl-4 pr-2">
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="h-3 w-3" />
                          <span className="text-[10px] font-medium">OK</span>
                        </div>
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
            </div>
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

  // Cost map from products
  const costMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) {
      for (const v of p.product_variants) m.set(v.id, v.cost)
    }
    return m
  }, [products])

  // Set first event as selected if nothing selected yet
  const effectiveSelected = selectedId
    ? events.find((e) => e.id === selectedId) ?? null
    : events[0] ?? null

  // Calculate demand gaps for the selected event
  const demandGaps = useMemo<DemandGap[]>(() => {
    if (!effectiveSelected || forecast.length === 0) return []

    const eventDate = parseISO(effectiveSelected.event_date)
    const daysUntil = Math.max(0, differenceInDays(eventDate, new Date()))
    const { demand_factor: factor } = effectiveSelected

    return forecast
      .filter((r) => r.adjusted_avg_daily > 0)
      .map((r) => {
        const unitCost = costMap.get(r.variant_id) ?? 0
        // Normal consumption between now and event day (occupancy-adjusted baseline)
        const normalDailyConsumption = Math.ceil(r.adjusted_avg_daily * daysUntil)
        // Extra consumption ON the event day from the event multiplier (factor - 1 = extra above adjusted)
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
    // Navigate to PO page — in a real integration we'd pass event context via URL
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

  // Summary for selected event
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
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            Event Demand Planner
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${String(upcomingEvents)} upcoming event${upcomingEvents !== 1 ? 's' : ''} · pre-calculate consumption gaps before they become stockouts`}
          </p>
        </div>
        <Button size="sm" onClick={() => { setShowForm(true) }} className="gap-1.5 text-xs h-8">
          <Plus className="h-3.5 w-3.5" />
          Add Event
        </Button>
      </div>

      {/* Body — split pane */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — event list */}
        <div className="w-72 flex-shrink-0 border-r flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">

            {/* New event form */}
            {showForm && (
              <EventForm
                onSave={handleCreate}
                onCancel={() => { setShowForm(false) }}
                saving={createEvent.isPending}
              />
            )}

            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : events.length === 0 && !showForm ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
                <div className="rounded-full bg-muted/50 p-4">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium">No events yet</p>
                <p className="text-xs text-muted-foreground">
                  Add your first event to see predicted stock gaps.
                </p>
                <Button size="sm" variant="outline" onClick={() => { setShowForm(true) }} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add Event
                </Button>
              </div>
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
                    <EventCard
                      event={event}
                      isSelected={effectiveSelected?.id === event.id}
                      onSelect={() => { setSelectedId(event.id) }}
                      onDelete={() => { handleDelete(event.id) }}
                      gaps={effectiveSelected?.id === event.id ? demandGaps : []}
                      currency={currency}
                    />
                    <button
                      type="button"
                      onClick={() => { setEditingId(event.id) }}
                      className="absolute right-9 top-3 h-6 w-6 rounded flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted/50 transition-all"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              ))
            )}
          </div>
        </div>

        {/* Right — gap analysis */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!effectiveSelected ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="rounded-full bg-muted/50 p-5">
                <CalendarDays className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-base font-medium">No event selected</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  Create an event and select it to see projected stock gaps
                  and the estimated cost to fill them before the event.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Selected event KPI strip */}
              <div className="border-b px-6 py-4 flex items-center justify-between bg-muted/10 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold">{effectiveSelected.name}</h2>
                    {isPast(parseISO(effectiveSelected.event_date)) ? (
                      <Badge variant="outline" className="text-[10px]">Past</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                        {differenceInDays(parseISO(effectiveSelected.event_date), new Date())}d away
                      </Badge>
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
                        size="sm"
                        onClick={handleCreateRestocks}
                        disabled={createRestock.isPending}
                        className="gap-1.5 text-xs h-8"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Create Restocks ({totalGaps})
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleGoToPO} className="gap-1.5 text-xs h-8">
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Go to PO Engine
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Methodology note */}
              <div className="flex items-center gap-2 px-6 py-2 border-b bg-muted/10 text-[11px] text-muted-foreground flex-shrink-0">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  Gap = (occupancy-adjusted daily × days until event) + (adjusted_daily × {effectiveSelected.demand_factor - 1 > 0 ? `(${String(effectiveSelected.demand_factor)} − 1) event spike` : `0 extra`}) − current stock
                  · Based on 30-day consumption history adjusted for forecasted occupancy
                </span>
              </div>

              {/* Gap table */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {forecastLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
