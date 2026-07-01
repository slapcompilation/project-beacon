// Agent Studio descriptor registry (read-only).
//
// Tool + agent metadata is derived from @beacon/reality-graph's canonical
// catalog (listAllToolDescriptors / listAllAgentSpecs) — the single source of
// truth — so the Studio can't drift from what actually ships. Only
// presentation-only metadata (emitted action types, block list, task prompt,
// launch surface, eval path) that isn't on the AgentSpec is kept here, keyed by
// agent name. The `invoke` paths are never called from the studio.

import {
  listAllToolDescriptors,
  listAllAgentSpecs,
  RESTOCK_ADVISOR_TASK_PROMPT,
  WASTE_TRIAGE_TASK_PROMPT,
  OVERSTOCK_REBALANCER_TASK_PROMPT,
  restockExtractVariantBlock,
  restockExtractSupplierBlock,
  restockReasonAndProposeBlock,
  wasteExtractVariantBlock,
  wasteProposeActionsBlock,
  overstockExtractVariantBlock,
  overstockReasonAndRebalanceBlock,
  type BlockDef,
  type LogicTool,
  type AgentCadence,
  type AgentScope,
  type AgentApprovalBoundary,
  type AgentReleaseStage,
} from '@beacon/reality-graph'

// ─── Tool descriptors (from the canonical catalog) ───────────────────────────

export const toolDescriptors: ReadonlyArray<LogicTool> = listAllToolDescriptors()

export function getToolDescriptor(name: string): LogicTool | undefined {
  return toolDescriptors.find((t) => t.name === name)
}

// ─── Agent descriptors ───────────────────────────────────────────────────────

export interface AgentDescriptor {
  name:             string
  version:          string
  purpose:          string
  scope:            AgentScope
  cadence:          AgentCadence
  approvalBoundary: AgentApprovalBoundary
  releaseStage:     AgentReleaseStage
  toolset:          ReadonlyArray<string>
  /** BeaconAction types the agent can emit as proposals. Used by the System Map. */
  emits:            ReadonlyArray<string>
  blocks:           ReadonlyArray<BlockDef<unknown, unknown>>
  taskPrompt:       string
  /** Tells the studio which UI surface launches a live run. */
  invokeFrom:       string
  /** Path to the eval file relative to repo root (for "View evals" link). */
  evalFile:         string
}

// Presentation-only metadata, keyed by agent name. Everything else is read from
// the live AgentSpec so toolset/version/stage can't go stale.
interface AgentPresentation {
  emits:      ReadonlyArray<string>
  blocks:     ReadonlyArray<BlockDef<unknown, unknown>>
  taskPrompt: string
  invokeFrom: string
  evalFile:   string
}

const AGENT_PRESENTATION = new Map<string, AgentPresentation>([
  ['restock_advisor', {
    emits: ['TRANSFER_STOCK', 'REQUEST_RESTOCK'],
    blocks: [
      restockExtractVariantBlock as unknown as BlockDef<unknown, unknown>,
      restockExtractSupplierBlock as unknown as BlockDef<unknown, unknown>,
      restockReasonAndProposeBlock as unknown as BlockDef<unknown, unknown>,
    ],
    taskPrompt: RESTOCK_ADVISOR_TASK_PROMPT,
    invokeFrom: 'Variant page · "Get restock advice"',
    evalFile:   'packages/reality-graph/src/agents/restock_advisor/eval/restock_advisor.eval.ts',
  }],
  ['waste_triage', {
    emits: ['TRANSFER_STOCK', 'WRITE_OFF'],
    blocks: [
      wasteExtractVariantBlock as unknown as BlockDef<unknown, unknown>,
      wasteProposeActionsBlock as unknown as BlockDef<unknown, unknown>,
    ],
    taskPrompt: WASTE_TRIAGE_TASK_PROMPT,
    invokeFrom: 'Variant page · "Waste triage"',
    evalFile:   'packages/reality-graph/src/agents/waste_triage/eval/waste_triage.eval.ts',
  }],
  ['overstock_rebalancer', {
    emits: ['TRANSFER_STOCK'],
    blocks: [
      overstockExtractVariantBlock as unknown as BlockDef<unknown, unknown>,
      overstockReasonAndRebalanceBlock as unknown as BlockDef<unknown, unknown>,
    ],
    taskPrompt: OVERSTOCK_REBALANCER_TASK_PROMPT,
    invokeFrom: 'Variant page · "Rebalance overstock"',
    evalFile:   'packages/reality-graph/src/agents/overstock_rebalancer/eval/overstock_rebalancer.eval.ts',
  }],
])

export const agentDescriptors: ReadonlyArray<AgentDescriptor> = listAllAgentSpecs().map((spec) => {
  const p = AGENT_PRESENTATION.get(spec.name)
  return {
    name:             spec.name,
    version:          spec.version,
    purpose:          spec.purpose,
    scope:            spec.scope,
    cadence:          spec.cadence,
    approvalBoundary: spec.approvalBoundary,
    releaseStage:     spec.releaseStage,
    toolset:          spec.toolset,
    emits:            p?.emits ?? [],
    blocks:           p?.blocks ?? [],
    taskPrompt:       p?.taskPrompt ?? '',
    invokeFrom:       p?.invokeFrom ?? '',
    evalFile:         p?.evalFile ?? '',
  }
})

export function getAgentDescriptor(name: string): AgentDescriptor | undefined {
  return agentDescriptors.find((a) => a.name === name)
}

// ─── Schema → string list helper (for rendering block I/O) ───────────────────

export interface SchemaField {
  name: string
  type: string
  optional: boolean
}

/** Pulls top-level field names + types from a zod object schema. Best-effort;
 *  falls back to an empty list when the schema isn't a ZodObject. */
export function describeSchema(schema: unknown): SchemaField[] {
  if (!schema || typeof schema !== 'object') return []
  const s = schema as {
    _def?: { typeName?: string }
    shape?: () => Record<string, { _def?: { typeName?: string; innerType?: { _def?: { typeName?: string } } } }>
  }
  if (s._def?.typeName !== 'ZodObject' || typeof s.shape !== 'function') return []
  const shape = s.shape()
  return Object.keys(shape).map((key) => {
    const f = shape[key]
    const inner = f._def?.innerType?._def?.typeName ?? f._def?.typeName ?? 'Unknown'
    const optional = f._def?.typeName === 'ZodOptional' || f._def?.typeName === 'ZodNullable' || f._def?.typeName === 'ZodDefault'
    return {
      name: key,
      type: zodTypeName(inner),
      optional,
    }
  })
}

function zodTypeName(t: string): string {
  switch (t) {
    case 'ZodString':            return 'string'
    case 'ZodNumber':            return 'number'
    case 'ZodBoolean':           return 'boolean'
    case 'ZodArray':             return 'array'
    case 'ZodObject':            return 'object'
    case 'ZodEnum':              return 'enum'
    case 'ZodLiteral':           return 'literal'
    case 'ZodNullable':          return 'nullable'
    case 'ZodOptional':          return 'optional'
    case 'ZodDiscriminatedUnion':return 'union'
    case 'ZodUnion':             return 'union'
    case 'ZodDefault':           return 'with-default'
    case 'ZodRecord':            return 'record'
    default:                     return t.replace(/^Zod/, '').toLowerCase()
  }
}
