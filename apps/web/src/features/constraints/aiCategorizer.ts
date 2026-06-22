// The real LLM behind categorizeConstraint (OPTIMIZATION-ROADMAP #1, Rung 2 of
// the authoring ladder). The regex heuristic stays the instant, offline preview;
// when it isn't confident, we fall back to the LLM at save time — same
// CategorizedConstraint shape, via the already-deployed agent-llm edge fn. The
// model's typed rule is clamped to a valid ConstraintTypedRule so it can never
// persist a malformed gate.

import { supabase } from '@/lib/supabase/client'
import type { ConstraintTypedRule } from '@beacon/reality-graph'
import { categorizeConstraint, type CategorizedConstraint } from './categorizer'

const KNOWN_ACTION_TYPES = new Set([
  'REQUEST_RESTOCK', 'TRANSFER_STOCK', 'WRITE_OFF', 'ADJUST_STOCK',
  'APPROVE_RESTOCK', 'REJECT_RESTOCK', 'APPROVE_TRANSFER', 'CREATE_PO', 'RECEIVE_STOCK',
])

const SYSTEM = `You categorize a hotel operator's plain-English inventory rule into ONE typed constraint bucket.
Return a JSON object: { bucket, typedRule, appliesToActionTypes, confident }.

Buckets + their typedRule shape:
- "threshold": a numeric limit on an action field. typedRule = { bucket:"threshold", field, max?, min? }. field is usually "quantityNeeded" (restock), "quantity" (write-off/transfer) or "delta" (adjust). Give max for "no more than / under", min for "at least / over".
- "time-window": allowed hours/days. typedRule = { bucket:"time-window", startHour (0-23), endHour (0-23), daysOfWeek? ([0=Sun..6=Sat]) }. "no X after 6pm" → allowed window startHour 0 endHour 18.
- "actor-role": which roles may take the action. typedRule = { bucket:"actor-role", allowedRoles:[...] }. Roles: owner, admin, regional_manager, hotel_admin, hotel_manager, team_member.
- "scope": restrict to specific hotels/orgs. typedRule = { bucket:"scope", allowedHotelIds?:[...], allowedOrgIds?:[...] }.

appliesToActionTypes: which action types the rule gates (REQUEST_RESTOCK, TRANSFER_STOCK, WRITE_OFF, ADJUST_STOCK, APPROVE_RESTOCK, …); [] means all.
confident: true only if you are sure of the bucket + values.`

const SCHEMA = {
  bucket: 'threshold',
  typedRule: { bucket: 'threshold', field: 'quantityNeeded', max: 200 },
  appliesToActionTypes: ['REQUEST_RESTOCK'],
  confident: true,
}

interface AgentLLMResponse { output?: unknown; error?: string }

/** LLM categorization. Returns null on any failure or an unusable rule, so the
 *  caller keeps the heuristic result. */
export async function aiCategorizeConstraint(body: string): Promise<CategorizedConstraint | null> {
  const invokeResult = await supabase.functions.invoke<AgentLLMResponse>('agent-llm', {
    body: {
      systemPrompt: SYSTEM,
      messages: [{ role: 'user', content: `Rule: "${body}"` }],
      outputSchema: SCHEMA,
      maxTokens: 400,
    },
  })
  const data = invokeResult.data
  const error: unknown = invokeResult.error
  if (error instanceof Error || data?.error || !isObj(data?.output)) return null

  const out = data.output
  const rule = clampTypedRule(out.typedRule)
  if (!rule) return null
  const appliesToActionTypes = Array.isArray(out.appliesToActionTypes)
    ? out.appliesToActionTypes.filter((t): t is string => typeof t === 'string' && KNOWN_ACTION_TYPES.has(t))
    : []
  return { bucket: rule.bucket, typedRule: rule, appliesToActionTypes, confident: true }
}

/** Heuristic first (instant); only call the LLM when the heuristic is unsure. */
export async function resolveConstraintCategory(body: string): Promise<CategorizedConstraint> {
  const heuristic = categorizeConstraint(body)
  if (heuristic.confident) return heuristic
  try {
    return (await aiCategorizeConstraint(body)) ?? heuristic
  } catch {
    return heuristic
  }
}

function clampTypedRule(raw: unknown): ConstraintTypedRule | null {
  if (!isObj(raw)) return null
  switch (raw.bucket) {
    case 'threshold': {
      const field = typeof raw.field === 'string' && raw.field ? raw.field : 'quantityNeeded'
      const max = typeof raw.max === 'number' ? raw.max : undefined
      const min = typeof raw.min === 'number' ? raw.min : undefined
      if (max === undefined && min === undefined) return null
      return { bucket: 'threshold', field, ...(max !== undefined ? { max } : {}), ...(min !== undefined ? { min } : {}) }
    }
    case 'time-window': {
      const startHour = clampHour(raw.startHour)
      const endHour = clampHour(raw.endHour)
      if (startHour === null || endHour === null) return null
      const dows = Array.isArray(raw.daysOfWeek)
        ? raw.daysOfWeek.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
        : []
      return { bucket: 'time-window', startHour, endHour, ...(dows.length ? { daysOfWeek: dows } : {}) }
    }
    case 'actor-role': {
      const roles = Array.isArray(raw.allowedRoles) ? raw.allowedRoles.filter((r): r is string => typeof r === 'string') : []
      if (roles.length === 0) return null
      return { bucket: 'actor-role', allowedRoles: roles }
    }
    case 'scope': {
      const hotels = Array.isArray(raw.allowedHotelIds) ? raw.allowedHotelIds.filter((s): s is string => typeof s === 'string') : []
      const orgs = Array.isArray(raw.allowedOrgIds) ? raw.allowedOrgIds.filter((s): s is string => typeof s === 'string') : []
      return { bucket: 'scope', ...(hotels.length ? { allowedHotelIds: hotels } : {}), ...(orgs.length ? { allowedOrgIds: orgs } : {}) }
    }
    default:
      return null
  }
}

function clampHour(h: unknown): number | null {
  return typeof h === 'number' && Number.isInteger(h) && h >= 0 && h <= 24 ? h : null
}

function isObj(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === 'object' && !Array.isArray(x)
}
