import { useState } from 'react'
import { Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'

export function Section({
  icon, title, count, accent, children, defaultOpen = true,
}: {
  icon: IconName; title: string; count?: number; accent?: string
  children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v) }}
        className="flex w-full items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <Icon icon={icon} size={14} className={cn('flex-shrink-0', accent ?? 'text-muted-foreground')} />
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {count != null && count > 0 && (
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">{count}</span>
        )}
        <Icon icon={open ? 'chevron-down' : 'chevron-right'} size={14} className="text-muted-foreground" />
      </button>
      {open && <div className="divide-y">{children}</div>}
    </div>
  )
}

export function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-3 px-4 py-2.5 text-sm', className)}>{children}</div>
}
