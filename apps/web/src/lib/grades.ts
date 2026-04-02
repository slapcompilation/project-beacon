// Layer: Mind — supplier / property grade helpers.
// Single source of truth for thresholds and styles used by
// SuppliersPage, ProcurementLeveragePage, and ChainPage.

import { ShieldCheck, ShieldAlert, Shield, CircleDot } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Grade = 'A' | 'B' | 'C' | 'D' | '—'

// ─── Thresholds ────────────────────────────────────────────────────────────────
// A: ≥ 85   B: ≥ 70   C: ≥ 50   D: < 50
// (was inconsistent — ProcurementLeveragePage used 55 for C; now unified at 50)

export function scoreToGrade(score: number | null): Grade {
  if (score === null) return '—'
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}

// ─── Styles ────────────────────────────────────────────────────────────────────

export const GRADE_STYLES: Record<Grade, string> = {
  A: 'border-green-400 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  B: 'border-lime-400 bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400',
  C: 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  D: 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  '—': 'border-border bg-muted text-muted-foreground',
}

export const GRADE_ICONS: Record<Grade, React.ElementType> = {
  A: ShieldCheck,
  B: Shield,
  C: ShieldAlert,
  D: ShieldAlert,
  '—': CircleDot,
}
