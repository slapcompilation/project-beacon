import { defineConfig } from 'vitest/config'

// Every suite opens one transaction and rolls it back — but two suites that
// both materialize datasets deadlock on the shared datasets-schema DDL, so
// files run serially. Within a file the order is the sequence (the view
// replay is five transactions in order).
export default defineConfig({
  test: {
    include:         ['src/**/*.test.ts'],
    environment:     'node',
    sequence:        { shuffle: false },
    fileParallelism: false,
    testTimeout:     30_000,
    // A `beforeAll` here builds a whole fixture — org, user, space, ontology,
    // project, types, properties, links — against a REMOTE database, so it does
    // more work than the tests it serves. Vitest's default gave it 10s while a
    // test got 30s, and that asymmetry is the flake: `branching.test.ts` timed
    // out on the first CI run that executed these suites on a pull request, and
    // `workingState.test.ts` did the same locally the same day. A timed-out
    // hook also keeps running, so the failure cascades into `rollback` on an
    // undefined client and reports twice.
    hookTimeout:     60_000,
  },
})
