// Shared dense entity card for Studio index/registry pages (AIP parity).
// One idiom across Agents, Modeling Objectives, Logic Tools: identity row
// (icon · title · version · stage) → one-line purpose → one inline meta line →
// optional inline stats → tiny footer. No centered number grids, no dead space —
// cards size to content (never h-full in a stretching grid).

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, Icon, type Intent } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'

export function EntityCard({
  to, icon, iconIntent, title, mono, titleTag, stageTag, purpose, meta, stats, footer,
}: {
  to: string
  icon: IconName
  iconIntent?: Intent
  title: string
  mono?: boolean
  /** Inline right after the title — usually a version pill. */
  titleTag?: ReactNode
  /** Pushed to the right edge of the identity row — usually a stage/status tag. */
  stageTag?: ReactNode
  purpose?: string
  /** One inline meta line (compose from <Bit/> + <Dot/>). */
  meta?: ReactNode
  /** Optional stats row, gets a top divider. */
  stats?: ReactNode
  /** Tiny muted footer line. */
  footer?: ReactNode
}) {
  return (
    <Link to={to} className="block">
      <Card interactive className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <Icon icon={icon} intent={iconIntent} size={13} className="shrink-0" />
          <span className={cn('truncate text-[13px] font-semibold', mono && 'font-mono')}>{title}</span>
          {titleTag}
          <span className="flex-1" />
          {stageTag}
        </div>

        {purpose && <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{purpose}</p>}

        {meta && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
            {meta}
          </div>
        )}

        {stats && (
          <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-1.5 text-[11px]">
            {stats}
          </div>
        )}

        {footer && <div className="truncate text-[10px] text-muted-foreground/70">{footer}</div>}
      </Card>
    </Link>
  )
}

export function Bit({ n, unit }: { n: number | string; unit: string }) {
  return <span className="tabular-nums"><b className="font-semibold text-foreground">{n}</b> {unit}</span>
}

export function Dot() {
  return <span className="opacity-40">·</span>
}
