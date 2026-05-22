import type { IconName } from '@blueprintjs/icons'
import type { BriefingActionType, SituationIncident } from '@beacon/types'

export const DOMAIN_ICON: Record<SituationIncident['domain'], IconName> = {
  stock:     'box',
  waste:     'trash',
  suppliers: 'truck',
  demand:    'trending-up',
}

export const SITUATION_CFG = {
  critical: {
    border:    'border-red-300 dark:border-red-800',
    bg:        'bg-red-50/60 dark:bg-red-950/20',
    headerBg:  'bg-red-100/80 dark:bg-red-950/40',
    iconCls:   'text-red-600 dark:text-red-400',
    levelCls:  'text-red-700 dark:text-red-400 font-bold',
    badge:     'bg-red-600 text-white',
  },
  elevated: {
    border:    'border-amber-300 dark:border-amber-800',
    bg:        'bg-amber-50/40 dark:bg-amber-950/10',
    headerBg:  'bg-amber-100/60 dark:bg-amber-950/30',
    iconCls:   'text-amber-600 dark:text-amber-400',
    levelCls:  'text-amber-700 dark:text-amber-400 font-bold',
    badge:     'bg-amber-500 text-white',
  },
} as const

export const ACTION_CFG: Record<BriefingActionType, {
  icon: IconName
  iconCls: string
  groupHint?: string
}> = {
  restock_proposal:           { icon: 'confirm',       iconCls: 'text-green-600',  groupHint: 'Auto-Propose' },
  supplier_risk:              { icon: 'warning-sign',  iconCls: 'text-red-500',    groupHint: 'Supplier' },
  low_stock_no_po:            { icon: 'remove',        iconCls: 'text-red-500',    groupHint: 'Stock' },
  invoice_discrepancy:        { icon: 'comparison',    iconCls: 'text-orange-500', groupHint: 'Finance' },
  waste_spike_low_occupancy:  { icon: 'warning-sign',  iconCls: 'text-red-500',    groupHint: 'Waste' },
  expiry_soon:                { icon: 'calendar',      iconCls: 'text-red-500',    groupHint: 'Expiry' },
  low_stock_po_in_flight:     { icon: 'box',           iconCls: 'text-amber-500',  groupHint: 'Stock' },
  waste_spike_high_occupancy: { icon: 'warning-sign',  iconCls: 'text-amber-400',  groupHint: 'Waste' },
  gl_unmapped:                { icon: 'help',          iconCls: 'text-orange-500', groupHint: 'GL' },
  gl_period_ending:           { icon: 'document-share',iconCls: 'text-blue-500',   groupHint: 'GL' },
}

export const BAND = (p: number) => p <= 1 ? 'act' as const : p <= 3 ? 'monitor' as const : 'info' as const

export const BAND_CFG = {
  act:     { label: 'Act now',       labelCls: 'text-red-700 dark:text-red-400',     dividerCls: 'border-red-200   dark:border-red-900/40' },
  monitor: { label: 'Monitor',       labelCls: 'text-amber-700 dark:text-amber-400', dividerCls: 'border-amber-200 dark:border-amber-900/40' },
  info:    { label: 'Informational', labelCls: 'text-muted-foreground',              dividerCls: 'border-border' },
}

export const TIER_CFG = {
  critical: { label: 'Critical',  cls: 'text-red-600 dark:text-red-400',     barCls: 'bg-red-500',    borderCls: 'border-red-100 dark:border-red-900/30'   },
  warning:  { label: 'Warning',   cls: 'text-amber-600 dark:text-amber-400', barCls: 'bg-amber-500',  borderCls: 'border-amber-100 dark:border-amber-900/30' },
  watch:    { label: 'Watch',     cls: 'text-yellow-600 dark:text-yellow-500',barCls: 'bg-yellow-400', borderCls: 'border-border'                             },
}

export const LEVEL_COLOR = {
  critical: '#ef4444',
  elevated: '#f59e0b',
  nominal:  '#22c55e',
} as const

export const LAYER_COLOR: Record<string, string> = {
  floor: 'bg-emerald-500',
  flow:  'bg-blue-500',
  eye:   'bg-amber-500',
  mind:  'bg-purple-500',
}
