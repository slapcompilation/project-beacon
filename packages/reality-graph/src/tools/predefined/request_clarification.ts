import { z } from 'zod'
import type { LogicTool } from '../index'

const inputSchema = z.object({
  question: z.string().min(1).max(500),
  /** What the agent already knows; surfaced in the operator UI alongside the question. */
  contextSummary: z.string().min(1).max(2000),
  /** Confidence level that triggered the pause. */
  currentConfidence: z.number().min(0).max(1),
})

const outputSchema = z.object({
  paused: z.literal(true),
  question: z.string(),
  contextSummary: z.string(),
  currentConfidence: z.number(),
})

export type RequestClarificationInput = z.infer<typeof inputSchema>
export type RequestClarificationOutput = z.infer<typeof outputSchema>

/**
 * Framework helper: pauses the agent and surfaces a question to the operator.
 * Agents call this when confidence drops below threshold instead of emitting
 * a low-confidence proposal. The operator answer becomes a new agent input.
 */
export const requestClarificationTool: LogicTool<RequestClarificationInput, RequestClarificationOutput> = {
  name: 'request_clarification',
  category: 'predefined',
  kind: 'inproc',
  version: '1.0.0',
  description:
    'Pauses the agent and asks the operator a clarification question. ' +
    'Call when confidence at any reasoning step falls below the agent\'s threshold (default 0.6).',
  inputSchema,
  outputSchema,
  examples: [
    {
      input: {
        question: 'Should I prefer Marriott Riverside (sister, 40% of gap) or Sysco Foods (next-day, full quantity)?',
        contextSummary: 'Gap: 200 units tomatoes by Friday. Sister has 80 units. Sysco lead time 1 day, on-time 92%.',
        currentConfidence: 0.55,
      },
      output: {
        paused: true,
        question: 'Should I prefer Marriott Riverside (sister, 40% of gap) or Sysco Foods (next-day, full quantity)?',
        contextSummary: 'Gap: 200 units tomatoes by Friday. Sister has 80 units. Sysco lead time 1 day, on-time 92%.',
        currentConfidence: 0.55,
      },
    },
  ],
  invoke: (input) => Promise.resolve({
    paused: true as const,
    question: input.question,
    contextSummary: input.contextSummary,
    currentConfidence: input.currentConfidence,
  }),
}
