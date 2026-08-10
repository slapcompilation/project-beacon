import { defineConfig } from 'vitest/config'

// The auto-persist reporter shipped eval runs to a table; both went with the
// eval pipeline, which was our approximation rather than AIP Evals' shape.
export default defineConfig({
  test: {
    include:    ['src/**/*.{test,spec,eval}.ts'],
    environment:'node',
  },
})
