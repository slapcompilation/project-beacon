// Rubric grader — the third AIP evaluator class (after object-match and
// string-contains). LLM-as-judge: for each checklist item, the model returns
// a passed/rationale verdict; the grader aggregates into a weighted score
// and a pass/fail bit.
//
// Usage in a *.eval.ts file:
//
//   it('reasoning cites at least one tool', async () => {
//     const result = await agent.run(input)
//     const verdict = await gradeWithRubric({
//       llm: stubLlm,
//       input,
//       output: result.proposals[0],
//       checks: [
//         { id: 'cites-tool', question: 'Does the reasoning name at least one tool that was called?' },
//         { id: 'has-confidence', question: 'Is a confidence score in [0,1] present?' },
//       ],
//     })
//     expect(verdict.passed).toBe(true)
//   })

import { z } from 'zod'
import type { LLMClient } from '../agents/llm'

export interface RubricCheck {
  id:       string
  question: string
  /** When omitted, treated as 1.0. */
  weight?:  number
  /** When true, failing this check fails the whole rubric regardless of score. */
  required?: boolean
}

export interface RubricPerCheck {
  id:        string
  passed:    boolean
  rationale: string
}

export interface RubricResult {
  /** True iff weighted score ≥ passThreshold AND every `required: true` check passed. */
  passed:        boolean
  /** Weighted fraction of checks passed in [0, 1]. */
  score:         number
  perCheck:      ReadonlyArray<RubricPerCheck>
}

const perCheckSchema = z.object({
  id:        z.string(),
  passed:    z.boolean(),
  rationale: z.string(),
})

const responseSchema = z.object({
  checks: z.array(perCheckSchema),
})

export async function gradeWithRubric(args: {
  llm: LLMClient
  input: unknown
  output: unknown
  checks: ReadonlyArray<RubricCheck>
  passThreshold?: number
}): Promise<RubricResult> {
  if (args.checks.length === 0) {
    throw new Error('gradeWithRubric requires at least one check')
  }

  const threshold = args.passThreshold ?? 0.8

  const systemPrompt =
    'You are evaluating an agent output against a rubric. For every check in the list, decide whether the output passes ' +
    'and write a one-sentence rationale. Return ONLY a JSON object matching the schema. Do not add prose.'

  const userPrompt =
    'Input the agent received:\n' +
    JSON.stringify(args.input, null, 2) +
    '\n\nAgent output:\n' +
    JSON.stringify(args.output, null, 2) +
    '\n\nRubric (return one verdict per id):\n' +
    JSON.stringify(args.checks.map((c) => ({ id: c.id, question: c.question })), null, 2)

  const resp = await args.llm.call({
    systemPrompt,
    messages:     [{ role: 'user', content: userPrompt }],
    outputSchema: responseSchema,
  })

  const parsed = responseSchema.parse(resp.output)

  // Index verdicts by id so a partial response still maps correctly.
  const verdictsById = new Map(parsed.checks.map((v) => [v.id, v]))
  const perCheck: RubricPerCheck[] = args.checks.map((c) => {
    const v = verdictsById.get(c.id)
    if (!v) {
      return { id: c.id, passed: false, rationale: 'Grader returned no verdict for this check' }
    }
    return v
  })

  const totalWeight  = args.checks.reduce((s, c) => s + (c.weight ?? 1), 0)
  const earnedWeight = perCheck.reduce((s, v, i) => {
    const w = args.checks[i]?.weight ?? 1
    return v.passed ? s + w : s
  }, 0)
  const score = totalWeight === 0 ? 0 : earnedWeight / totalWeight

  const requiredFailed = args.checks.some((c, i) => c.required === true && !(perCheck[i]?.passed ?? false))
  const passed = !requiredFailed && score >= threshold

  return { passed, score, perCheck }
}
