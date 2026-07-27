import { describe, it, expect, vi } from 'vitest'
import { runIntelligenceCycle, type IntelligenceCycleDeps, type CycleVariant } from './intelligenceCycle'
import type { AgentProposal } from '../agents/index'
import type { ConstraintRecord } from '../constraints/index'
import { automationsToProposals } from '../automations/index'

const HOTEL = '21111111-1111-4111-8111-111111111111'
const USER = '31111111-1111-4111-8111-111111111111'
const VAR_A: CycleVariant = { id: '41111111-1111-4111-8111-111111111111', name: 'Tomatoes' }
const VAR_B: CycleVariant = { id: '41111111-1111-4111-8111-111111111112', name: 'Onions' }
const VAR_C: CycleVariant = { id: '41111111-1111-4111-8111-111111111113', name: 'Garlic' }

function proposal(confidence: number, quantityNeeded = 10): AgentProposal {
  return {
    action: { type: 'REQUEST_RESTOCK', variantId: VAR_A.id, quantityNeeded, hotelId: HOTEL, requestorId: USER },
    confidence,
    reasoning: 'test',
    provenance: [],
  }
}

function proposalWithForecast(confidence: number, basis: string): AgentProposal {
  return { ...proposal(confidence), forecast: { basis, projectedUnits: 20, horizonDays: 7, confidence } }
}

function thresholdConstraint(severity: 'hard' | 'soft', max: number): ConstraintRecord {
  return {
    id: 'c1',
    body: `quantityNeeded must be ≤ ${String(max)}`,
    bucket: 'threshold',
    typedRule: { bucket: 'threshold', field: 'quantityNeeded', max },
    severity,
    appliesToActionTypes: ['REQUEST_RESTOCK'],
    active: true,
  }
}

/** Deps with spies; `proposalsByVariant` controls what each runAgent call returns. */
function makeDeps(over: Partial<IntelligenceCycleDeps> & {
  proposals?: ReadonlyArray<AgentProposal>
  dispatchOk?: boolean
} = {}): IntelligenceCycleDeps & {
  runAgent: ReturnType<typeof vi.fn>
  persistProposal: ReturnType<typeof vi.fn>
  dispatch: ReturnType<typeof vi.fn>
  markApproved: ReturnType<typeof vi.fn>
} {
  let nextId = 0
  const runAgent = vi.fn(() => Promise.resolve(over.proposals ?? [proposal(0.95)]))
  const persistProposal = vi.fn(() => Promise.resolve(`p${String(++nextId)}`))
  const dispatch = vi.fn(() => Promise.resolve(over.dispatchOk ?? true))
  const markApproved = vi.fn(() => Promise.resolve())
  return {
    variants: over.variants ?? [VAR_A],
    constraints: over.constraints ?? [],
    policy: over.policy,
    agent: over.agent,
    releases: over.releases,
    // These suites exercise the threshold/constraint/dispatch paths, not the
    // release gate, so they opt out by default; the release-gate block overrides.
    allowUnreleased: over.allowUnreleased ?? true,
    openProposalKeys: over.openProposalKeys,
    forecastAccuracyByBasis: over.forecastAccuracyByBasis,
    maxForecastMape: over.maxForecastMape,
    maxVariants: over.maxVariants,
    now: over.now ?? (() => new Date('2026-05-29T12:00:00Z')),
    automationProposals: over.automationProposals,
    externalProposals: over.externalProposals,
    runAgent,
    persistProposal,
    dispatch,
    markApproved,
  }
}

describe('runIntelligenceCycle', () => {
  it('auto-executes a confident, uncontested REQUEST_RESTOCK', async () => {
    const deps = makeDeps({ proposals: [proposal(0.95)] })
    const result = await runIntelligenceCycle(deps)

    expect(deps.dispatch).toHaveBeenCalledTimes(1)
    expect(deps.markApproved).toHaveBeenCalledWith('p1')
    expect(result).toMatchObject({ scanned: 1, proposed: 1, autoExecuted: 1, queued: 0 })
    expect(result.items[0]).toMatchObject({ outcome: 'auto-executed', actionType: 'REQUEST_RESTOCK', proposalId: 'p1' })
  })

  it('fires an operator-authored automation through the same gate, tagged as automation', async () => {
    const autoProposals = automationsToProposals(
      [{ id: 'auto1', name: 'Low → restock', organizationId: 'o', hotelId: HOTEL,
         when: { subject: 'variant', metric: 'units_below_par', op: 'gt', value: 0 },
         effect: 'REQUEST_RESTOCK', gate: 'auto', confidence: 0.95, enabled: true, stage: 'production', version: 1 }],
      [{ subject: 'variant', subjectId: VAR_A.id, subjectName: 'Tomatoes', hotelId: HOTEL,
         metrics: { current_stock: 2, par_level: 12, units_below_par: 10, stock_vs_par_pct: 17 } }],
      { requestorId: USER },
    ).map((p) => p.proposal)
    // no agent proposal — only the automation fires
    const deps = makeDeps({ proposals: [], automationProposals: () => autoProposals })
    const result = await runIntelligenceCycle(deps)
    expect(result.proposed).toBe(1)
    expect(result.autoExecuted).toBe(1) // 0.95, uncontested → through the same gate
    expect(result.items[0]).toMatchObject({ source: 'automation', actionType: 'REQUEST_RESTOCK', outcome: 'auto-executed' })
  })

  it('runs an authored agent ONCE per cycle, not once per variant', async () => {
    const authored = vi.fn(() => Promise.resolve([]))
    const deps = makeDeps({
      variants: [VAR_A, { id: 'v-b', name: 'Onions' }, { id: 'v-c', name: 'Garlic' }],
      proposals: [],
      externalProposals: authored,
    })
    await runIntelligenceCycle(deps)
    expect(authored).toHaveBeenCalledTimes(1)   // not 3 — model cost can't scale with the scan
  })

  it('puts an authored agent proposal through the same gate + persist path', async () => {
    const p = proposal(0.95)
    const authoredProposal = { ...p, provenance: [{ kind: 'tool' as const, ref: 'authored-agent:expiry_watcher' }] }
    const deps = makeDeps({
      proposals: [],
      externalProposals: () => Promise.resolve([{ variant: VAR_A, proposal: authoredProposal }]),
    })
    const result = await runIntelligenceCycle(deps)
    expect(result.proposed).toBe(1)
    expect(result.autoExecuted).toBe(1)
    expect(result.items[0]).toMatchObject({ source: 'authored-agent', outcome: 'auto-executed' })
  })

  it('puts a MONITOR proposal through the same gate, labelled as its own source', async () => {
    // Monitors used to write proposals directly, bypassing decideAutoExecution.
    // They are now just another external source — one gate, one audit path.
    const p = proposal(0.95)
    const monitorProposal = { ...p, provenance: [{ kind: 'tool' as const, ref: 'monitor:expiry' }] }
    const deps = makeDeps({
      proposals: [],
      externalProposals: () => Promise.resolve([{ variant: VAR_A, proposal: monitorProposal }]),
    })
    const result = await runIntelligenceCycle(deps)
    expect(result.proposed).toBe(1)
    expect(result.items[0]).toMatchObject({ source: 'monitor', outcome: 'auto-executed' })
  })

  it('lets a hard constraint veto a monitor proposal — the gate is not optional', async () => {
    const monitorProposal = {
      ...proposal(0.99, 10),
      provenance: [{ kind: 'tool' as const, ref: 'monitor:expiry' }],
    }
    const deps = makeDeps({
      proposals: [],
      externalProposals: () => Promise.resolve([{ variant: VAR_A, proposal: monitorProposal }]),
      constraints: [thresholdConstraint('hard', 5)],
    })
    const result = await runIntelligenceCycle(deps)

    // The old direct-write path would have persisted this regardless.
    expect(deps.dispatch).not.toHaveBeenCalled()
    expect(result).toMatchObject({ autoExecuted: 0, queued: 1 })
    expect(result.items[0]).toMatchObject({ source: 'monitor', outcome: 'queued' })
  })

  it('ignores an authored proposal about a variant outside this cycle scope', async () => {
    const deps = makeDeps({
      variants: [VAR_A],
      proposals: [],
      externalProposals: () => Promise.resolve([
        { variant: { id: 'not-scanned', name: 'Elsewhere' }, proposal: proposal(0.95) },
      ]),
    })
    const result = await runIntelligenceCycle(deps)
    expect(result.proposed).toBe(0)
  })

  it('survives an authored agent that throws — the cycle still runs', async () => {
    const deps = makeDeps({
      proposals: [proposal(0.95)],
      externalProposals: () => Promise.reject(new Error('model unavailable')),
    })
    const result = await runIntelligenceCycle(deps)
    expect(result.proposed).toBe(1)          // the shipped agent's proposal still lands
    expect(result.autoExecuted).toBe(1)
  })

  it('dedups a proposal whose variant+action is already open (no re-persist)', async () => {
    const deps = makeDeps({
      proposals: [proposal(0.95)],
      openProposalKeys: new Set([`REQUEST_RESTOCK:${VAR_A.id}`]),
    })
    const result = await runIntelligenceCycle(deps)

    expect(deps.persistProposal).not.toHaveBeenCalled()
    expect(deps.dispatch).not.toHaveBeenCalled()
    expect(result).toMatchObject({ proposed: 0, autoExecuted: 0, queued: 0, deduped: 1 })
    expect(result.items[0].outcome).toBe('duplicate')
  })

  it('queues a proposal below the confidence floor without dispatching', async () => {
    const deps = makeDeps({ proposals: [proposal(0.7)] })
    const result = await runIntelligenceCycle(deps)

    expect(deps.dispatch).not.toHaveBeenCalled()
    expect(deps.markApproved).not.toHaveBeenCalled()
    expect(result).toMatchObject({ proposed: 1, autoExecuted: 0, queued: 1 })
    expect(result.items[0].outcome).toBe('queued')
    expect(result.items[0].reason).toMatch(/below/)
  })

  it('queues when a hard constraint is violated, even at high confidence', async () => {
    const deps = makeDeps({ proposals: [proposal(0.99, 10)], constraints: [thresholdConstraint('hard', 5)] })
    const result = await runIntelligenceCycle(deps)

    expect(deps.dispatch).not.toHaveBeenCalled()
    expect(result).toMatchObject({ autoExecuted: 0, queued: 1 })
    expect(result.items[0].outcome).toBe('queued')
  })

  it('still auto-executes through a soft violation (soft never blocks)', async () => {
    const deps = makeDeps({ proposals: [proposal(0.95, 10)], constraints: [thresholdConstraint('soft', 5)] })
    const result = await runIntelligenceCycle(deps)

    expect(deps.dispatch).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ autoExecuted: 1, queued: 0 })
  })

  it('queues (does not mark approved) when dispatch fails', async () => {
    const deps = makeDeps({ proposals: [proposal(0.95)], dispatchOk: false })
    const result = await runIntelligenceCycle(deps)

    expect(deps.dispatch).toHaveBeenCalledTimes(1)
    expect(deps.markApproved).not.toHaveBeenCalled()
    expect(result).toMatchObject({ autoExecuted: 0, queued: 1 })
    expect(result.items[0].outcome).toBe('queued')
  })

  it('caps the scan at maxVariants', async () => {
    const deps = makeDeps({ variants: [VAR_A, VAR_B, VAR_C], maxVariants: 2 })
    const result = await runIntelligenceCycle(deps)

    expect(deps.runAgent).toHaveBeenCalledTimes(2)
    expect(result.scanned).toBe(2)
  })

  it('records a no-proposal item when the agent emits nothing', async () => {
    const deps = makeDeps({ proposals: [] })
    const result = await runIntelligenceCycle(deps)

    expect(result).toMatchObject({ proposed: 0, autoExecuted: 0, queued: 0 })
    expect(result.items[0].outcome).toBe('no-proposal')
  })

  it('records an error item and continues when one agent run throws', async () => {
    const deps = makeDeps({ variants: [VAR_A, VAR_B] })
    deps.runAgent
      .mockImplementationOnce(() => Promise.reject(new Error('boom')))
      .mockImplementationOnce(() => Promise.resolve([proposal(0.95)]))
    const result = await runIntelligenceCycle(deps)

    expect(result.items).toHaveLength(2)
    expect(result.items[0].outcome).toBe('error')
    expect(result.items[1].outcome).toBe('auto-executed')
    expect(result.scanned).toBe(2)
  })

  it('opens a case for a queued proposal but not an auto-executed one', async () => {
    const queuedCase = vi.fn(() => Promise.resolve())
    await runIntelligenceCycle({ ...makeDeps({ proposals: [proposal(0.7)] }), openCase: queuedCase })
    expect(queuedCase).toHaveBeenCalledTimes(1)
    expect(queuedCase).toHaveBeenCalledWith(VAR_A, 'p1', expect.objectContaining({ type: 'REQUEST_RESTOCK' }))

    const autoCase = vi.fn(() => Promise.resolve())
    await runIntelligenceCycle({ ...makeDeps({ proposals: [proposal(0.95)] }), openCase: autoCase })
    expect(autoCase).not.toHaveBeenCalled()
  })

  it('a failing openCase never drops the queued proposal', async () => {
    const openCase = vi.fn(() => Promise.reject(new Error('case write boom')))
    const result = await runIntelligenceCycle({ ...makeDeps({ proposals: [proposal(0.7)] }), openCase })
    expect(result).toMatchObject({ proposed: 1, queued: 1 })
    expect(result.items[0].outcome).toBe('queued')
  })

  it('stamps ranAt from the injected clock', async () => {
    const deps = makeDeps({ now: () => new Date('2026-01-02T03:04:05Z') })
    const result = await runIntelligenceCycle(deps)
    expect(result.ranAt).toBe('2026-01-02T03:04:05.000Z')
  })

  describe('release gate plumbing (Phase C step 2b)', () => {
    const agent = { agentName: 'restock_advisor', agentVersion: '1.0.0' }

    it('queues (does not dispatch) when agent has no production release', async () => {
      const deps = makeDeps({
        proposals: [proposal(0.95)],
        agent,
        releases: { production: [] },
        allowUnreleased: false,
      })
      const result = await runIntelligenceCycle(deps)

      expect(deps.dispatch).not.toHaveBeenCalled()
      expect(result).toMatchObject({ autoExecuted: 0, queued: 1 })
      expect(result.items[0].reason).toContain('no production release')
    })

    it('auto-executes when the agent has a production release', async () => {
      const deps = makeDeps({
        proposals: [proposal(0.95)],
        agent,
        releases: { production: [{ agentName: 'restock_advisor', version: '1.0.0' }] },
        allowUnreleased: false,
      })
      const result = await runIntelligenceCycle(deps)

      expect(deps.dispatch).toHaveBeenCalledTimes(1)
      expect(result).toMatchObject({ autoExecuted: 1, queued: 0 })
    })
  })

  describe('forecast-accuracy trust budget (Q3)', () => {
    const basis = 'reorder-point-normal-v1/auto:ewma-v1'

    it('queues a proposal whose sizing forecast basis runs hot', async () => {
      const deps = makeDeps({
        proposals: [proposalWithForecast(0.95, basis)],
        forecastAccuracyByBasis: new Map([[basis, { mape: 0.6, n: 5 }]]),
      })
      const result = await runIntelligenceCycle(deps)
      expect(deps.dispatch).not.toHaveBeenCalled()
      expect(result).toMatchObject({ autoExecuted: 0, queued: 1 })
      expect(result.items[0].reason).toContain('MAPE')
    })

    it('auto-executes when the sizing forecast basis is accurate', async () => {
      const deps = makeDeps({
        proposals: [proposalWithForecast(0.95, basis)],
        forecastAccuracyByBasis: new Map([[basis, { mape: 0.1, n: 5 }]]),
      })
      const result = await runIntelligenceCycle(deps)
      expect(result).toMatchObject({ autoExecuted: 1, queued: 0 })
    })

    it('does not veto when the basis has no accuracy record yet', async () => {
      const deps = makeDeps({
        proposals: [proposalWithForecast(0.95, basis)],
        forecastAccuracyByBasis: new Map(),   // nothing scored for this basis
      })
      const result = await runIntelligenceCycle(deps)
      expect(result).toMatchObject({ autoExecuted: 1, queued: 0 })
    })
  })
})
