import { formatDistanceToNow } from 'date-fns'
import { Tag } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import type { ObjectPanelEntity } from '@/stores/app.store'

export function FieldRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-border/50 last:border-0">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex-shrink-0">{label}</span>
      <span className={cn('text-xs font-medium text-right truncate', accent ?? 'text-foreground')}>{value}</span>
    </div>
  )
}

// Narrowing helpers — entity payloads come back from Supabase as Record<string, unknown>.
// Returning `T | undefined` lets `?? fallback` mean something to both eslint and the reader.
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}
function obj(v: unknown): Record<string, unknown> | undefined {
  return v != null && typeof v === 'object' ? v as Record<string, unknown> : undefined
}

export function EntitySummary({ entityType, data }: { entityType: ObjectPanelEntity; data: Record<string, unknown> }) {
  switch (entityType) {
    case 'variant': {
      const products = obj(data.products)
      const stock    = num(data.current_stock) ?? 0
      const par      = num(data.par_level) ?? 0
      const urgency  =
        par > 0 && stock <= par * 0.5 ? 'text-red-400' :
        par > 0 && stock <= par       ? 'text-amber-400' :
        'text-emerald-400'
      return (
        <>
          <FieldRow label="Product"   value={str(products?.name)            ?? '—'} />
          <FieldRow label="Variant"   value={str(data.name)                 ?? '—'} />
          <FieldRow label="Stock"     value={stock} accent={urgency} />
          <FieldRow label="PAR Level" value={par > 0 ? par : '—'} />
          <FieldRow label="Unit"      value={str(data.unit)                 ?? '—'} />
          <FieldRow label="Location"  value={str(obj(data.locations)?.name) ?? '—'} />
        </>
      )
    }
    case 'supplier': {
      const lead = num(data.lead_time_days)
      return (
        <>
          <FieldRow label="Name"      value={str(data.name)         ?? '—'} />
          <FieldRow label="Contact"   value={str(data.contact_name) ?? '—'} />
          <FieldRow label="Email"     value={str(data.email)        ?? '—'} />
          <FieldRow label="Phone"     value={str(data.phone)        ?? '—'} />
          <FieldRow label="Lead Time" value={lead != null ? `${lead}d` : '—'} />
        </>
      )
    }
    case 'restock_request': {
      const pv   = obj(data.product_variants)
      const date = str(data.date)
      return (
        <>
          <FieldRow label="Variant"   value={str(pv?.name)      ?? '—'} />
          <FieldRow label="Quantity"  value={num(data.quantity) ?? 0} />
          <FieldRow label="Status"    value={
            <Tag minimal className="!text-[10px] !px-1.5 !py-0">{str(data.status) ?? '—'}</Tag>
          } />
          <FieldRow label="Urgency"   value={str(data.urgency)  ?? '—'} />
          <FieldRow label="Requested" value={date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : '—'} />
        </>
      )
    }
    case 'stock_log': {
      const delta     = num(data.delta) ?? 0
      const timestamp = str(data.timestamp)
      return (
        <>
          <FieldRow label="Variant"      value={str(obj(data.product_variants)?.name) ?? '—'} />
          <FieldRow label="Delta"        value={delta > 0 ? `+${delta}` : delta} accent={delta > 0 ? 'text-emerald-400' : 'text-red-400'} />
          <FieldRow label="Reason"       value={str(data.reason)        ?? '—'} />
          <FieldRow label="Triggered By" value={str(data.triggered_by)  ?? '—'} />
          <FieldRow label="When"         value={timestamp ? formatDistanceToNow(new Date(timestamp), { addSuffix: true }) : '—'} />
        </>
      )
    }
    default: {
      const entries = Object.entries(data).filter(([k]) =>
        !['id', 'hotel_id', 'created_at', 'updated_at'].includes(k) && typeof data[k] !== 'object'
      ).slice(0, 8)
      return (
        <>
          {entries.map(([k, v]) => (
            <FieldRow key={k} label={k.replace(/_/g, ' ')} value={str(v) ?? num(v)?.toString() ?? '—'} />
          ))}
        </>
      )
    }
  }
}
