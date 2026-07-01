// Judgment evals — the AIP eval loop applied to agent *reasoning quality*, not
// just mechanical correctness. A scenario is run through an agent version and
// the resulting proposal(s) are graded by an LLM-as-judge rubric
// (gradeWithRubric). This is what lets us answer "is the 'llm' reasoning path
// actually better than the deterministic baseline?" with a graded number
// instead of a hunch.
//
// Same harness, two execution modes:
//   • CI (default): pass a scripted StubLLMClient judge. The agent output is
//     produced for real, so the object-match + string-contains assertions in
//     each *.judgment.eval.ts still guard regressions; the rubric verdict here
//     proves the harness wiring, not model judgment. Zero spend, always green.
//   • Live (BEACON_EVAL_LIVE=1 + a real-model judge): measures real judgment
//     quality. This is the billed run that compares the 'llm' agent version
//     against the deterministic baseline and gates promotion. See
//     docs/AIP-PARITY-ROADMAP.md (P2 evals).

import type { AgentSpec, AgentInput, AgentRunResult } from '../agents/index'
import { StubLLMClient, type LLMClient } from '../agents/llm'
import { gradeWithRubric, type RubricCheck, type RubricResult } from './rubricGrader'

export interface JudgmentCase {
  name: string
  input: AgentInput
  /** The judgment criteria the LLM-as-judge grades the run against. */
  rubric: ReadonlyArray<RubricCheck>
  /** Which slice of the run to grade. Default: { proposals, paused }. */
  select?: (r: AgentRunResult) => unknown
}

export interface JudgmentOutcome {
  result: AgentRunResult
  graded: unknown
  verdict: RubricResult
}

/** Runs one agent version against a judgment scenario and grades the output. */
export async function runJudgmentCase(args: {
  agent: AgentSpec
  /** LLM-as-judge — a StubLLMClient in CI, a real model in a live eval run. */
  judge: LLMClient
  testCase: JudgmentCase
  passThreshold?: number
}): Promise<JudgmentOutcome> {
  const result = await args.agent.run(args.testCase.input)
  const graded = args.testCase.select
    ? args.testCase.select(result)
    : { proposals: result.proposals, paused: result.paused }
  const verdict = await gradeWithRubric({
    llm: args.judge,
    input: args.testCase.input,
    output: graded,
    checks: args.testCase.rubric,
    passThreshold: args.passThreshold,
  })
  return { result, graded, verdict }
}

/** True when a live judgment run (real model judge) is requested. */
export const LIVE_JUDGMENT = process.env.BEACON_EVAL_LIVE === '1'

/** A scripted LLM-as-judge that returns one passed/rationale verdict per rubric
 *  id. Used by CI judgment evals to prove the harness; a live run swaps in a
 *  real model. */
export function stubRubricJudge(verdicts: ReadonlyArray<{ id: string; passed: boolean }>): StubLLMClient {
  return new StubLLMClient([{
    output: { checks: verdicts.map((v) => ({ id: v.id, passed: v.passed, rationale: v.passed ? 'ok' : 'criterion not met' })) },
    toolCalls: [],
    tokensUsed: 0,
  }])
}
