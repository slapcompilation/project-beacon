import { defineConfig } from 'vitest/config'
import { evalAutoPersistReporter } from './src/evals/autoPersistReporter'

// Reporters: 'default' keeps the standard Vitest console output; the
// auto-persist reporter is a no-op unless EVAL_PERSIST_URL +
// EVAL_PERSIST_TOKEN are set (typically only in CI).
export default defineConfig({
  test: {
    include:    ['src/**/*.{test,spec,eval}.ts'],
    environment:'node',
    reporters:  ['default', evalAutoPersistReporter()],
  },
})
