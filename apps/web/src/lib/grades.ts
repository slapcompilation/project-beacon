// Layer: Mind — supplier / property grade helpers.
// Single source of truth for thresholds and styles used across
// supplier / procurement / chain surfaces.

import { Intent } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Grade = 'A' | 'B' | 'C' | 'D' | '—'

// ─── Thresholds ────────────────────────────────────────────────────────────────
// A: ≥ 85   B: ≥ 70   C: ≥ 50   D: < 50

export function scoreToGrade(score: number | null): Grade {
  if (score === null) return '—'
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}

// ─── Styles ────────────────────────────────────────────────────────────────────
// Tailwind classes preserved for inline pill chrome where Tag's tint isn't enough.

export const GRADE_STYLES: Record<Grade, string> = {
  A: 'border-green-400 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  B: 'border-lime-400 bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400',
  C: 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  D: 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  '—': 'border-border bg-muted text-muted-foreground',
}

// Blueprint icon name + intent per grade — consumers render <Icon icon={GRADE_ICONS[g]} />
// and pass GRADE_INTENTS[g] as the Tag intent.

export const GRADE_ICONS: Record<Grade, IconName> = {
  A: 'endorsed',
  B: 'shield',
  C: 'shield',
  D: 'issue',
  '—': 'dot',
}

export const GRADE_INTENTS: Record<Grade, Intent> = {
  A: Intent.SUCCESS,
  B: Intent.SUCCESS,
  C: Intent.WARNING,
  D: Intent.DANGER,
  '—': Intent.NONE,
}
