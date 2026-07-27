// Where an interface tool's number came from. A single aggregate across several
// types is unauditable without this — which is the same reason every tool
// carries a basis.

import type { ToolTypeBreakdown } from '@beacon/reality-graph'

export default function Breakdown({ byType }: { byType: ToolTypeBreakdown[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
      {byType.map((b) => (
        <span key={b.typeId}>
          {b.label} <span className="tabular-nums font-medium text-foreground">{round(b.value)}</span>
          <span className="opacity-60"> ({b.matched}/{b.scanned})</span>
        </span>
      ))}
    </div>
  )
}

const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
