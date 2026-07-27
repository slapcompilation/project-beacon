// An authored tool, made callable by anything that calls a Logic Tool.
//
// The copilot could already run these (#408). Authored AGENTS could not:
// buildAuthoredAgentTools contained zero of them, while RunAuthoredAgentArgs
// promised "code tools and authored ones alike". This closes that gap, and with
// it Foundry's "functions are usable across action types and applications".
//
// Because an authored tool may target an interface, an agent that calls one
// inherits that reach for free — it asks about a shape, not a table.

import { z } from 'zod'
import type { LogicTool } from '../tools/index'
import type { ObjectTypeDef } from '../objectTypes/index'
import {
  bindToolArgs, evaluateUserToolAcross,
  type ToolArgs, type ToolParamDef, type ToolRecord, type ToolRecordGroup, type UserToolDef,
} from './index'

/** The reads an authored tool needs. Deliberately fetch-only: resolving a
 *  subject to the types it spans stays in reality-graph, so every caller agrees
 *  on what "every implementer" means rather than each re-deriving it. */
export interface AuthoredToolReader {
  objectTypes: () => Promise<ReadonlyArray<ObjectTypeDef>>
  interfaceImplementers: (interfaceId: string) => Promise<ReadonlyArray<string>>
  objectRecords: (typeIds: ReadonlyArray<string>) => Promise<ReadonlyArray<{ objectTypeId: string; data: ToolRecord }>>
}

/** The tool's record set: one group for a type subject, one per implementer for
 *  an interface subject. Empty when nothing implements it yet — an honest
 *  "no records", which evaluateUserToolAcross reports at zero confidence. */
export async function resolveToolGroups(
  def: Pick<UserToolDef, 'subjectTypeId' | 'subjectInterfaceId'>,
  reader: AuthoredToolReader,
): Promise<ToolRecordGroup[]> {
  const typeIds = def.subjectInterfaceId
    ? await reader.interfaceImplementers(def.subjectInterfaceId)
    : def.subjectTypeId ? [def.subjectTypeId] : []
  if (typeIds.length === 0) return []

  const [types, records] = await Promise.all([reader.objectTypes(), reader.objectRecords(typeIds)])
  const wanted = new Set(typeIds)
  return types.filter((t) => wanted.has(t.id)).map((t) => ({
    type: t,
    records: records.filter((r) => r.objectTypeId === t.id).map((r) => r.data),
  }))
}

const outputSchema = z.object({
  value: z.number(),
  basis: z.string(),
  confidence: z.number(),
  matched: z.number(),
  scanned: z.number(),
  byType: z.array(z.object({
    typeId: z.string(), label: z.string(), matched: z.number(), scanned: z.number(), value: z.number(),
  })),
})

/** The tool's declared parameters as a zod schema — what the LLM sees as the
 *  tool's input, and what the runtime validates a call against before it runs. */
export function paramsToSchema(params: ReadonlyArray<ToolParamDef>): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const p of params) {
    const base = p.type === 'number' ? z.number() : p.type === 'boolean' ? z.boolean() : z.string()
    shape[p.key] = p.required ? base.describe(p.label) : base.optional().describe(p.label)
  }
  return z.object(shape)
}

/** Wraps the definition as a real Logic Tool — same shape, same value + basis +
 *  confidence contract, so a caller can't tell it wasn't shipped in code. */
export function authoredToolAsLogicTool(def: UserToolDef, reader: AuthoredToolReader): LogicTool {
  const params = def.parameters.length === 0
    ? ''
    : ` Takes: ${def.parameters.map((p) => `${p.key} (${p.type}${p.required ? '' : ', optional'})`).join(', ')}.`

  return {
    name: def.apiName,
    category: 'logic',
    kind: 'inproc',
    version: '1.0.0',
    description: `${def.description || def.name} (authored by this organization).${params} Returns a number with the basis it was computed from and a confidence.`,
    inputSchema: paramsToSchema(def.parameters),
    outputSchema,
    invoke: async (input: unknown) => {
      const { filters, errors } = bindToolArgs(def, (input ?? {}) as ToolArgs)
      // Throwing gives the model a correctable error; answering with the
      // authored fallback would be a wrong answer that looks right.
      if (errors.length > 0) throw new Error(errors.join('; '))
      const groups = await resolveToolGroups(def, reader)
      return evaluateUserToolAcross({ filters, aggregation: def.aggregation }, groups)
    },
  } as LogicTool
}
