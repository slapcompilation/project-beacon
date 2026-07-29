// Two fields CLAUDE.md described as load-bearing were reaching nobody:
// `traversableLinks` never entered a prompt, and `version` never entered a
// trace. These lock in the consumers that make the claims true.

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { toolSpec, StubLLMClient } from './llm'
import { buildRunner } from './runtime'
import type { LogicTool } from '../tools/index'

const tool: LogicTool = {
  name: 'query_variant_documents',
  category: 'data',
  kind: 'inproc',
  version: '2.1.0',
  description: 'Documents describing a variant.',
  traversableLinks: ['describes_entity', 'cited_in'],
  inputSchema: z.object({ variantId: z.string() }),
  outputSchema: z.object({ count: z.number() }),
  invoke: () => Promise.resolve({ count: 1 }),
}

describe('toolSpec', () => {
  it('surfaces traversableLinks to the model', () => {
    expect(toolSpec(tool).description).toBe(
      'Documents describing a variant. Traverses only these links: describes_entity, cited_in.',
    )
  })

  it('leaves the description alone when a tool declares no traversals', () => {
    const { traversableLinks: _omit, ...noLinks } = tool
    expect(toolSpec(noLinks).description).toBe('Documents describing a variant.')
  })

  it('drops an empty list rather than emitting a dangling sentence', () => {
    expect(toolSpec({ ...tool, traversableLinks: [] }).description).toBe('Documents describing a variant.')
  })
})

describe('trace provenance', () => {
  it('records the tool version on both the call and the response step', async () => {
    const runner = buildRunner({
      agentName: 'test_agent',
      agentVersion: '1.0.0',
      llm: new StubLLMClient([]),
      toolRegistry: new Map([[tool.name, tool]]),
      allowedTools: [tool.name],
    })

    await runner.runBlock({
      name: 'probe',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      systemPrompt: 'probe',
      run: (_input, ctx) => ctx.invokeTool(tool.name, { variantId: 'v1' }),
    }, {})

    const versions = runner.snapshotTrace().steps
      .filter((s) => s.type === 'llm_tool_use' || s.type === 'tool_response')
      .map((s) => s.toolVersion)
    expect(versions).toEqual(['2.1.0', '2.1.0'])
  })
})
