// Process Mining (P11) — Foundry Machinery for hospitality. Pick a process
// (restock / PO / case / proposal), see its mined state machine with per-state
// and per-transition metrics, and catch bottlenecks where objects pile up.

import { useMemo, useState } from 'react'
import { Icon, SegmentedControl, Spinner, SpinnerSize, HTMLTable, Tag, Intent } from '@blueprintjs/core'
import { selectBottleneckTriggers, type LifecycleNode } from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useMonitorPolicy } from '@/features/monitors/hooks'
import { useMinedProcess } from '@/features/processMining/hooks'
import { ProcessExplorer } from '@/features/processMining/ProcessExplorer'
import { toBottleneckReadings, formatDuration } from '@/features/processMining/analysis'

const PROCESSES: { id: LifecycleNode; label: string }[] = [
  { id: 'restock_request', label: 'Restock Requests' },
  { id: 'purchase_order',  label: 'Purchase Orders' },
  { id: 'case',            label: 'Cases' },
  { id: 'proposal',        label: 'Proposals' },
]

export default function ProcessMiningPage() {
  const hotelId = useActiveHotelId()
  const { data: policy } = useMonitorPolicy()
  const [nodeType, setNodeType] = useState<LifecycleNode>('restock_request')
  const { data, isLoading } = useMinedProcess(nodeType, hotelId)

  const process = data ?? { states: [], transitions: [] }
  const rule = policy?.merged.monitors.bottleneck

  // The bottleneck monitor's trigger is operator-tunable (org policy); the
  // firing rule lives in reality-graph so the threshold isn't hardcoded here.
  const hits = useMemo(
    () => (rule ? selectBottleneckTriggers(toBottleneckReadings(nodeType, process.states), rule) : []),
    [rule, nodeType, process.states],
  )
  const bottleneckStates = useMemo(() => new Set(hits.map((h) => h.state)), [hits])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-8 py-5 flex-shrink-0">
        <h1 className="text-xl font-semibold">Process Mining</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Mined from the lifecycle transition log — how objects flow through their states, where they pile up.
        </p>
        <div className="mt-3">
          <SegmentedControl
            options={PROCESSES.map((p) => ({ label: p.label, value: p.id }))}
            value={nodeType}
            onValueChange={(v) => { setNodeType(v as LifecycleNode) }}
            size="small"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Spinner size={SpinnerSize.SMALL} /> Mining…
          </div>
        ) : (
          <>
            {hits.length > 0 && (
              <div className="flex items-start gap-2 rounded border border-amber-400/50 bg-amber-50/60 px-4 py-3 text-sm dark:bg-amber-950/20">
                <Icon icon="warning-sign" className="mt-0.5 text-amber-600" />
                <div>
                  <span className="font-medium">
                    {hits.length === 1 ? '1 bottleneck' : `${String(hits.length)} bottlenecks`} detected.
                  </span>{' '}
                  <span className="text-muted-foreground">
                    {hits.map((h) => `${h.state.replace(/_/g, ' ')} (${String(Math.round(h.exitRatio * 100))}% exit)`).join(', ')} — far more objects entered than exited.
                  </span>
                </div>
              </div>
            )}

            <ProcessExplorer nodeType={nodeType} data={process} bottlenecks={bottleneckStates} />

            {process.states.length > 0 && (
              <div className="grid gap-6 lg:grid-cols-2">
                <section>
                  <h2 className="mb-2 text-sm font-semibold">States</h2>
                  <HTMLTable compact striped className="w-full text-sm">
                    <thead>
                      <tr>
                        <th>State</th>
                        <th className="text-right">In state</th>
                        <th className="text-right">Entered</th>
                        <th className="text-right">Exited</th>
                        <th className="text-right">Ø duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {process.states.map((s) => (
                        <tr key={s.state}>
                          <td className="capitalize">
                            {s.state.replace(/_/g, ' ')}
                            {bottleneckStates.has(s.state) && (
                              <Tag intent={Intent.WARNING} minimal className="ml-2">bottleneck</Tag>
                            )}
                          </td>
                          <td className="text-right tabular-nums">{s.current_count}</td>
                          <td className="text-right tabular-nums">{s.entered_count}</td>
                          <td className="text-right tabular-nums">{s.exited_count}</td>
                          <td className="text-right tabular-nums">{formatDuration(s.avg_duration_s)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </HTMLTable>
                </section>

                <section>
                  <h2 className="mb-2 text-sm font-semibold">Transitions</h2>
                  {process.transitions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No transitions recorded yet — only the current state of each object. Moves are logged as statuses change.
                    </p>
                  ) : (
                    <HTMLTable compact striped className="w-full text-sm">
                      <thead>
                        <tr>
                          <th>Transition</th>
                          <th className="text-right">Count</th>
                          <th className="text-right">Ø lead time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {process.transitions.map((t) => (
                          <tr key={`${t.from}->${t.to}`}>
                            <td className="capitalize">{t.from.replace(/_/g, ' ')} → {t.to.replace(/_/g, ' ')}</td>
                            <td className="text-right tabular-nums">{t.count}</td>
                            <td className="text-right tabular-nums">{formatDuration(t.avg_lead_time_s)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </HTMLTable>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
