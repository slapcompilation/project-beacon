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
  },
})
