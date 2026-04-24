import { cn } from '@/lib/utils'

export function MetricCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md border border-border/60 px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', warn && 'text-red-500')}>{value}</p>
    </div>
  )
}
