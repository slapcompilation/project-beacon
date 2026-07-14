// Insights smoke: the reframed /eye lands on the Overview (identity + lens
// directory), and a lens card navigates into its live panel.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('insights overview renders and a lens card opens its panel', async ({ page }) => {
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

  await page.goto('/eye')
  await expect(page.getByRole('heading', { name: 'Insights', exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByRole('heading', { name: 'Intelligence' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()

  // a lens card switches the panel
  await page.getByText('Waste Radar', { exact: true }).click()
  await expect(page).toHaveURL(/panel=waste/)
})
