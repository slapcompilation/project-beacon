// Pure helpers for the process explorer — layout + metric formatting + the
// bottleneck rule. Kept separate from the SVG so they can be unit-tested.

import { LIFECYCLES, legalNext, type LifecycleNode } from '@beacon/reality-graph'
import type { ProcessState } from './api'

export function formatDuration(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return '—'
  if (s < 90) return `${Math.round(s)}s`
  const m = s / 60
  if (m < 90) return `${Math.round(m)}m`
  const h = m / 60
  if (h < 48) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

// BFS depth of each state from the lifecycle's initial states — drives a
// left→right layered layout. Initial states have no incoming legal transition.
export function stateDepths(nodeType: LifecycleNode): Map<string, number> {
  const states = Object.keys(LIFECYCLES[nodeType])
  const incoming = new Set<string>()
  for (const from of states) for (const to of legalNext(nodeType, from)) incoming.add(to)

  const roots = states.filter((s) => !incoming.has(s))
  const seeds = roots.length > 0 ? roots : states.slice(0, 1)

  const depth = new Map<string, number>()
  const queue: string[] = []
  for (const r of seeds) { depth.set(r, 0); queue.push(r) }

  while (queue.length > 0) {
    const cur = queue.shift()
    if (cur === undefined) break
    const curDepth = depth.get(cur) ?? 0
    for (const nxt of legalNext(nodeType, cur)) {
      const d = curDepth + 1
      const existing = depth.get(nxt)
      if (existing === undefined || d > existing) { depth.set(nxt, d); queue.push(nxt) }
    }
  }
  for (const s of states) if (!depth.has(s)) depth.set(s, 0)
  return depth
}

export function isTerminal(nodeType: LifecycleNode, state: string): boolean {
  return legalNext(nodeType, state).length === 0
}

// A bottleneck: a non-terminal state where far more objects entered than exited
// (Machinery's "266 entered, only 16 exited" signal). Needs enough volume.
export function isBottleneck(nodeType: LifecycleNode, st: ProcessState): boolean {
  if (isTerminal(nodeType, st.state) || st.entered_count < 3) return false
  return st.exited_count / st.entered_count < 0.4
}
