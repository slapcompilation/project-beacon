// Field-level diff between a parent proposal's action and its refined child.
// Only renders fields where the value changed; unchanged fields stay implicit.

import { Icon } from '@blueprintjs/core'
import type { BeaconAction } from '@beacon/reality-graph'

interface Props {
  parent: BeaconAction
  child: BeaconAction
  className?: string
}

export function ProposalDiff({ parent, child, className }: Props) {
  const changes = computeChanges(parent, child)
  if (changes.length === 0) return null

  return (
    <div className={className}>
      <div className="flex items-center gap-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        <Icon icon="changes" size={10} />
        Changed from previous
      </div>
      <ul className="space-y-0.5 text-xs">
        {changes.map((c) => (
          <li key={c.field} className="flex items-baseline gap-2 font-mono">
            <span className="w-24 truncate text-muted-foreground/70">{c.field}</span>
            <span className="text-red-500 line-through opacity-70">{c.before}</span>
            <Icon icon="arrow-right" size={10} className="text-muted-foreground/40" />
            <span className="text-emerald-500">{c.after}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface FieldChange {
  field: string
  before: string
  after: string
}

function computeChanges(parent: BeaconAction, child: BeaconAction): FieldChange[] {
  // Different action types are a full replacement — surface the type itself.
  if (parent.type !== child.type) {
    return [{ field: 'type', before: parent.type, after: child.type }]
  }
  const changes: FieldChange[] = []
  const p = parent as unknown as Record<string, unknown>
  const c = child as unknown as Record<string, unknown>
  const keys = new Set([...Object.keys(p), ...Object.keys(c)])
  for (const key of keys) {
    if (key === 'type') continue
    const before = format(p[key])
    const after  = format(c[key])
    if (before !== after) {
      changes.push({ field: key, before, after })
    }
  }
  return changes
}

function format(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try { return JSON.stringify(value) } catch { return Object.prototype.toString.call(value) }
}
