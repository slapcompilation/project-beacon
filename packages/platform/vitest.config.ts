import { defineConfig } from 'vitest/config'

// Every suite opens one transaction and rolls it back, so files can run in
// parallel — but a file's own tests build on each other (the view replay is five
// transactions in order), so within a file the order is the sequence.
export default defineConfig({
  test: {
    include:     ['src/**/*.test.ts'],
    environment: 'node',
    sequence:    { shuffle: false },
    testTimeout: 30_000,
  },
})
