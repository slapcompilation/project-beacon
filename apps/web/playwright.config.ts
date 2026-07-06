// E2E smoke config. Runs against the BUILT app (vite preview) — the CSS-order
// bug class that blanked the map (#314) only exists in production bundles, so
// testing dev mode would miss exactly what this suite is for.
// Set SMOKE_URL to point the same specs at a deployed environment instead.

import { defineConfig } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Vite only reads .env.local at build time — mirror it into the test process
// so login can reach the same Supabase project the bundle was built against.
try {
  const here = dirname(fileURLToPath(import.meta.url))
  for (const line of readFileSync(join(here, '.env.local'), 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch { /* no .env.local (CI) — env comes from the workflow */ }

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env.SMOKE_URL ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: process.env.SMOKE_URL
    ? undefined
    : {
        command: 'pnpm preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
})
