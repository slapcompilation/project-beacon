// Heuristic categorizer: turns an operator's NL constraint into bucket +
// typed_rule. This is a stop-gap until Phase 5 plugs a real LLM behind the
// same signature — handles the common shapes operators write today.

import type { ConstraintTypedRule } from '@beacon/reality-graph'

export interface CategorizedConstraint {
  bucket: ConstraintTypedRule['bucket']
  typedRule: ConstraintTypedRule
  /** Action types the rule should gate. Empty = applies to all. */
  appliesToActionTypes: string[]
  /** True when the categorizer is confident; UI can flag low-confidence rules. */
  confident: boolean
}

const ACTION_HINTS: Record<string, string[]> = {
  REQUEST_RESTOCK:  ['restock', 'reorder', 'order'],
  TRANSFER_STOCK:   ['transfer', 'move stock'],
  ADJUST_STOCK:     ['adjust', 'count', 'recount'],
  WRITE_OFF:        ['write off', 'waste', 'discard'],
  APPROVE_RESTOCK:  ['approve restock'],
  APPROVE_TRANSFER: ['approve transfer'],
}

const ROLE_TOKENS = ['owner', 'admin', 'manager', 'team_member', 'director']

export function categorizeConstraint(body: string): CategorizedConstraint {
  const text = body.trim().toLowerCase()
  const appliesToActionTypes = detectActionTypes(text)

  // 1. Time-window — "after 6pm", "between 9am and 5pm", "outside 9-17", "no <action> at night"
  const timeMatch = matchTimeWindow(text)
  if (timeMatch) {
    return { bucket: 'time-window', typedRule: timeMatch, appliesToActionTypes, confident: true }
  }

  // 2. Actor-role — "only admins", "managers and above", "team members can't"
  const roleMatch = matchActorRole(text)
  if (roleMatch) {
    return { bucket: 'actor-role', typedRule: roleMatch, appliesToActionTypes, confident: true }
  }

  // 3. Threshold — "no more than 500 units", "above 1000", "max quantity 200"
  const thresholdMatch = matchThreshold(text)
  if (thresholdMatch) {
    return { bucket: 'threshold', typedRule: thresholdMatch, appliesToActionTypes, confident: true }
  }

  // 4. Scope — fall-through: default to scope rule that gates on the current hotel.
  // Operators rarely author scope rules directly; the real categorizer will
  // surface this case when text mentions hotel ids or org names.
  return {
    bucket: 'threshold',
    typedRule: { bucket: 'threshold', field: 'quantityNeeded', max: 9999 },
    appliesToActionTypes,
    confident: false,
  }
}

function detectActionTypes(text: string): string[] {
  const types: string[] = []
  for (const [type, hints] of Object.entries(ACTION_HINTS)) {
    if (hints.some((h) => text.includes(h))) types.push(type)
  }
  return types
}

function matchTimeWindow(text: string): ConstraintTypedRule | null {
  // "between Xam/pm and Yam/pm"
  const between = /between\s+(\d{1,2})(am|pm)?\s+and\s+(\d{1,2})(am|pm)?/i.exec(text)
  if (between) {
    const start = normalizeHour(between[1], between[2])
    const end = normalizeHour(between[3], between[4])
    if (start != null && end != null) {
      return { bucket: 'time-window', startHour: start, endHour: end }
    }
  }
  // "after Xpm" → window 0..X (so anything after is OUT of allowed)
  const after = /after\s+(\d{1,2})(am|pm)?/i.exec(text)
  if (after) {
    const h = normalizeHour(after[1], after[2])
    if (h != null) return { bucket: 'time-window', startHour: 0, endHour: h }
  }
  // "before Xam" → window X..24
  const before = /before\s+(\d{1,2})(am|pm)?/i.exec(text)
  if (before) {
    const h = normalizeHour(before[1], before[2])
    if (h != null) return { bucket: 'time-window', startHour: h, endHour: 24 }
  }
  return null
}

function normalizeHour(num: string | undefined, suffix: string | undefined): number | null {
  if (!num) return null
  let h = parseInt(num, 10)
  if (Number.isNaN(h)) return null
  if (suffix?.toLowerCase() === 'pm' && h < 12) h += 12
  if (suffix?.toLowerCase() === 'am' && h === 12) h = 0
  if (h < 0 || h > 24) return null
  return h
}

function matchActorRole(text: string): ConstraintTypedRule | null {
  const onlyMatch = /only\s+(\w+)/i.exec(text)
  if (onlyMatch) {
    const role = onlyMatch[1].toLowerCase().replace(/s$/, '')
    if (ROLE_TOKENS.some((r) => r.startsWith(role))) {
      return { bucket: 'actor-role', allowedRoles: [role] }
    }
  }
  // Surface explicit role lists: "admins and owners"
  const roleList = ROLE_TOKENS.filter((r) => text.includes(r))
  if (roleList.length > 0 && /\b(can|may|allowed|permitted)\b/.test(text)) {
    return { bucket: 'actor-role', allowedRoles: roleList }
  }
  return null
}

function matchThreshold(text: string): ConstraintTypedRule | null {
  const max = /(?:no more than|at most|max(?:imum)?|under|below|less than)\s+(\d+)/i.exec(text)
  if (max) {
    return { bucket: 'threshold', field: 'quantityNeeded', max: parseInt(max[1], 10) }
  }
  const min = /(?:at least|min(?:imum)?|above|over|more than|greater than)\s+(\d+)/i.exec(text)
  if (min) {
    return { bucket: 'threshold', field: 'quantityNeeded', min: parseInt(min[1], 10) }
  }
  return null
}
