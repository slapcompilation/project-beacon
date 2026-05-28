// Agent Studio descriptor registry (read-only).
//
// Pulls the AgentSpec metadata + block info + tool definitions from
// @beacon/reality-graph using a no-op GraphReader. The `invoke` paths are
// never called from the studio — we only render schemas, prompts, and shape.

import {
  // agent metadata + blocks
  RESTOCK_ADVISOR_TASK_PROMPT,
  WASTE_TRIAGE_TASK_PROMPT,
  restockExtractVariantBlock,
  restockExtractSupplierBlock,
  restockReasonAndProposeBlock,
  wasteExtractVariantBlock,
  wasteProposeActionsBlock,
  // tool factories
  makeQueryOpenRestockRequestsTool,
  makeQuerySisterPropertyInventoryTool,
  makeForecastConsumptionTool,
  makeRankAlternativeSuppliersTool,
  makeQueryRecentWasteLogsTool,
  makeQueryVariantDocumentsTool,
  makeQueryDocumentChunksTool,
  requestClarificationTool,
  // types
  type BlockDef,
  type LogicTool,
  type GraphReader,
  type AgentCadence,
  type AgentScope,
  type AgentApprovalBoundary,
  type AgentReleaseStage,
} from '@beacon/reality-graph'

// ─── NoOp reader for metadata-only tool instantiation ────────────────────────

const noopReader: GraphReader = {
  getVariant:              () => Promise.resolve(null),
  getOpenRestockRequests:  () => Promise.resolve([]),
  getStockLogs:            () => Promise.resolve([]),
  getSisterHotels:         () => Promise.resolve([]),
  getVariantsByName:       () => Promise.resolve([]),
  getSuppliersForVariant:  () => Promise.resolve([]),
  getDocumentsForEntity:   () => Promise.resolve([]),
  searchDocumentChunks:    () => Promise.resolve([]),
  getActivePrinciples:     () => Promise.resolve([]),
}

// ─── Tool descriptors ────────────────────────────────────────────────────────

const tools: LogicTool[] = [
  makeQueryOpenRestockRequestsTool(noopReader) as LogicTool,
  makeQuerySisterPropertyInventoryTool(noopReader) as LogicTool,
  makeForecastConsumptionTool(noopReader) as LogicTool,
  makeRankAlternativeSuppliersTool(noopReader) as LogicTool,
  makeQueryRecentWasteLogsTool(noopReader) as LogicTool,
  makeQueryVariantDocumentsTool(noopReader) as LogicTool,
  makeQueryDocumentChunksTool(noopReader) as LogicTool,
  requestClarificationTool as LogicTool,
]

export const toolDescriptors: ReadonlyArray<LogicTool> = tools

export function getToolDescriptor(name: string): LogicTool | undefined {
  return tools.find((t) => t.name === name)
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

export const agentDescriptors: ReadonlyArray<AgentDescriptor> = [
  {
    name:             'restock_advisor',
    version:          '1.0.0',
    purpose:          'Resolves operator stockout concerns into typed TRANSFER_STOCK and/or REQUEST_RESTOCK proposals.',
    scope:            'hotel',
    cadence:          'on-event',
    approvalBoundary: 'operator',
    releaseStage:     'sandbox',
    toolset: [
      'query_open_restock_requests',
      'forecast_consumption',
      'query_sister_property_inventory',
      'rank_alternative_suppliers',
      'query_variant_documents',
      'query_document_chunks',
      'request_clarification',
    ],
    emits: ['TRANSFER_STOCK', 'REQUEST_RESTOCK'],
    blocks: [
      restockExtractVariantBlock as unknown as BlockDef<unknown, unknown>,
      restockExtractSupplierBlock as unknown as BlockDef<unknown, unknown>,
      restockReasonAndProposeBlock as unknown as BlockDef<unknown, unknown>,
    ],
    taskPrompt:  RESTOCK_ADVISOR_TASK_PROMPT,
    invokeFrom:  'Variant page · "Get restock advice"',
    evalFile:    'packages/reality-graph/src/agents/restock_advisor/eval/restock_advisor.eval.ts',
  },
  {
    name:             'waste_triage',
    version:          '1.0.0',
    purpose:          'Resolves spoilage/waste concerns into typed TRANSFER_STOCK (redirect to a needy sister) and/or WRITE_OFF proposals.',
    scope:            'hotel',
    cadence:          'on-event',
    approvalBoundary: 'operator',
    releaseStage:     'sandbox',
    toolset: [
      'query_recent_waste_logs',
      'forecast_consumption',
      'query_sister_property_inventory',
      'query_variant_documents',
      'query_document_chunks',
      'request_clarification',
    ],
    emits: ['TRANSFER_STOCK', 'WRITE_OFF'],
    blocks: [
      wasteExtractVariantBlock as unknown as BlockDef<unknown, unknown>,
      wasteProposeActionsBlock as unknown as BlockDef<unknown, unknown>,
    ],
    taskPrompt:  WASTE_TRIAGE_TASK_PROMPT,
    invokeFrom:  'Variant page · "Waste triage"',
    evalFile:    'packages/reality-graph/src/agents/waste_triage/eval/waste_triage.eval.ts',
  },
]

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
