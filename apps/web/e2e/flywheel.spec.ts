// Flywheel smoke (A6): the learning-loop dashboard renders visibly — headline
// metrics, the monthly ECE bars, and principle influence — from live data.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('flywheel renders the learning loop', async ({ page }) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  const session = JSON.stringify(await res.json())
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(
    ([k, v]) => { localStorage.setItem(k, v) },
    [`sb-${ref}-auth-token`, session],
  )

  await page.goto('/mind?aip=flywheel')
  await expect(page.getByRole('heading', { name: 'Flywheel' })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByRole('heading', { name: 'Learning loop' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Rules taught')).toBeVisible()
  await expect(page.getByText('Decisions shaped by rules')).toBeVisible()
  // the trend row renders its month labels once learning data arrives
  await expect(page.getByText('Calibration error by month')).toBeVisible({ timeout: 30_000 })
})
