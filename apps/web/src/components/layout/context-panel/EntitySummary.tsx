import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
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

export function EntitySummary({ entityType, data }: { entityType: ObjectPanelEntity; data: Record<string, unknown> }) {
  switch (entityType) {
    case 'variant': {
      const d = data
      const products = d.products as Record<string, unknown> | null
      const stock = (d.current_stock as number) ?? 0
      const par = (d.par_level as number) ?? 0
      const urgency = par > 0 && stock <= par * 0.5 ? 'text-red-400' : par > 0 && stock <= par ? 'text-amber-400' : 'text-emerald-400'
      return (
        <>
          <FieldRow label="Product" value={products?.name as string ?? '—'} />
          <FieldRow label="Variant" value={d.name as string ?? '—'} />
          <FieldRow label="Stock" value={stock} accent={urgency} />
          <FieldRow label="PAR Level" value={par || '—'} />
          <FieldRow label="Unit" value={d.unit as string ?? '—'} />
          <FieldRow label="Location" value={(d.locations as Record<string, unknown> | null)?.name as string ?? '—'} />
        </>
      )
    }
    case 'supplier': {
      const d = data
      return (
        <>
          <FieldRow label="Name" value={d.name as string ?? '—'} />
          <FieldRow label="Contact" value={d.contact_name as string ?? '—'} />
          <FieldRow label="Email" value={d.email as string ?? '—'} />
          <FieldRow label="Phone" value={d.phone as string ?? '—'} />
          <FieldRow label="Lead Time" value={d.lead_time_days ? `${String(d.lead_time_days)}d` : '—'} />
        </>
      )
    }
    case 'restock_request': {
      const d = data
      const pv = d.product_variants as Record<string, unknown> | null
      return (
        <>
          <FieldRow label="Variant" value={pv?.name as string ?? '—'} />
          <FieldRow label="Quantity" value={d.quantity as number ?? 0} />
          <FieldRow label="Status" value={
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{d.status as string}</Badge>
          } />
          <FieldRow label="Urgency" value={d.urgency as string ?? '—'} />
          <FieldRow label="Requested" value={d.date ? formatDistanceToNow(new Date(d.date as string), { addSuffix: true }) : '—'} />
        </>
      )
    }
    case 'stock_log': {
      const d = data
      const delta = d.delta as number ?? 0
      return (
        <>
          <FieldRow label="Variant" value={(d.product_variants as Record<string, unknown> | null)?.name as string ?? '—'} />
          <FieldRow label="Delta" value={delta > 0 ? `+${String(delta)}` : delta} accent={delta > 0 ? 'text-emerald-400' : 'text-red-400'} />
          <FieldRow label="Reason" value={d.reason as string ?? '—'} />
          <FieldRow label="Triggered By" value={d.triggered_by as string ?? '—'} />
          <FieldRow label="When" value={d.timestamp ? formatDistanceToNow(new Date(d.timestamp as string), { addSuffix: true }) : '—'} />
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
            <FieldRow key={k} label={k.replace(/_/g, ' ')} value={String(v ?? '—')} />
          ))}
        </>
      )
    }
  }
}
