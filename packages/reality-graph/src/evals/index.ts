// Eval primitives shared across *.eval.ts files.
//
// AIP triad:
//   - object match  (vitest's `expect(out).toEqual(expected)`)
//   - string contains (vitest's `expect(out).toMatch(pattern)`)
//   - rubric grader (LLM-as-judge — gradeWithRubric below)

export {
  gradeWithRubric,
  type RubricCheck,
  type RubricResult,
  type RubricPerCheck,
} from './rubricGrader'

export {
  evalAutoPersistReporter,
  type EvalRunRecord,
} from './autoPersistReporter'

export {
  runJudgmentCase,
  stubRubricJudge,
  LIVE_JUDGMENT,
  type JudgmentCase,
  type JudgmentOutcome,
} from './judgmentEval'
