import { defineConfig } from 'vitest/config'

// Every suite opens one transaction and rolls it back — but two suites that
// both materialize datasets deadlock on the shared datasets-schema DDL, so
// files run serially. Within a file the order is the sequence (the view
// replay is five transactions in order).
//
// ── PARALLELISM WAS TRIED, MEASURED, AND REVERTED (2026-09-23) ─────────────
// The suite costs ~573s and runs three times per change (local, PR CI, then
// DB migrate on main), so it is most of the ~30 minutes each chunk waits. The
// obvious fix is to parallelise, and the comment above suggests the constraint
// belongs to a minority of files: 16 of 70 call `dataset_materialize` or an
// index build, and the other 54 touch no shared-schema DDL at all.
//
// So they were split — the 16 serial, the 54 in parallel across 4 workers,
// with the split DERIVED by grepping the sources rather than listed, so a new
// suite could not drift out of the serial group. It was faster: **349s against
// a 573s baseline, a 39% cut.**
//
// It was also WRONG, and the second run is what showed it. The first run failed
// one test; the second failed TWENTY-THREE, in different files, almost all
// `Test timed out in 30000ms` inside `branching`, `createOrModify` and their
// neighbours. Those are lock waits, not logic: every suite holds one long
// transaction against the SAME remote database and inserts into the same shared
// tables — organizations, users, ontologies, projects, markings — so concurrent
// suites block each other on ordinary row locks, and a 30s test timeout turns a
// lock wait into a red build.
//
// **The comment above understates the constraint**, and that is the finding
// worth keeping: the files are not serialised because of DDL, they are
// serialised because they are not ISOLATED from one another. Real parallelism
// needs a database or a schema per worker, which is a much larger change than a
// config flag — and until then a 39% speed-up that makes the suite
// non-deterministic is worse than the wait, because a suite you cannot trust
// green is worse than no suite.
//
// Do not retry this with a different worker count. The failure rate scales with
// contention rather than disappearing at some threshold, and one flaky run in
// ten is enough to make every red build ambiguous.
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
