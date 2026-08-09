// Running a published example against the engine, and comparing to the answer
// the page prints.
//
// Palantir documents two algorithms the same way: a numbered sequence of
// instructions, and the resulting state stated after each one.
//
//   data-integration/datasets#example-of-transaction-types  — the dataset view
//   object-edits/how-edits-applied                          — T0 to T14
//
// Both are "replay a log, compare to the stated answer", so both go through this
// runner. The point is that a test becomes a TRANSCRIPTION of the table rather
// than an interpretation of it: adding a case is adding a row, each row states
// the whole expected state, and when Palantir edits the page the diff is a data
// diff.
//
// The shape this replaced bundled four of Palantir's stated answers into one
// `it`, so a break reported "replays the four stated steps" without saying which
// step — and the steps shared mutable state, so one failure cascaded.

import { it, expect } from 'vitest'

/** One row of a published table: what happens, and what the page says results. */
export interface Step<Input, State> {
  /** The page's own label — `T3`, `step 2`. Used as the test name. */
  readonly at: string
  /** What the page says happens at this point. */
  readonly input: Input
  /** What the page says the state is afterwards. */
  readonly expected: State
  /** The page's explanation, when it gives one. Shown in the test name. */
  readonly because?: string
}

export interface AnswerKey<Input, State> {
  /** Where the table is, so a reader can check the transcription. */
  readonly source: string
  readonly steps: readonly Step<Input, State>[]
  /** Apply one step to the engine and read back what it says the state is. */
  readonly run: (input: Input) => Promise<State>
}

/** One `it` per row, in order, each asserting the full state the page states. */
export function checkAnswerKey<Input, State>(key: AnswerKey<Input, State>): void {
  for (const step of key.steps) {
    const name = step.because ? `${step.at} — ${step.because}` : step.at
    it(name, async () => {
      const actual = await key.run(step.input)
      // toEqual on the whole state, never a field at a time: the page states the
      // entire result, and checking part of it would let the rest drift.
      expect(actual).toEqual(step.expected)
    })
  }
}
