// Studio landing smoke: the guided "Create a workflow" recipe renders as the
// front door, the loop stages render underneath as the browse view, and a
// card-click navigates into a tab (including a rail-hidden one the landing links).

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('studio landing tells the loop and navigates', async ({ page }) => {
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

  await page.goto('/mind?aip=studio')
  await expect(page.getByRole('heading', { name: 'Studio', exact: true })).toBeVisible({ timeout: 45_000 })
  // the guided recipe front door
  await expect(page.getByRole('heading', { name: 'Create a workflow' })).toBeVisible()
  await expect(page.getByText('Shape the data')).toBeVisible()
  // the loop stages render underneath as the browse view
  for (const stage of ['Build', 'Govern', 'Prove', 'Sandbox']) {
    await expect(page.getByRole('heading', { name: stage, exact: true })).toBeVisible()
  }
  // a rail-hidden tab is reachable through its landing card
  await page.getByText('Scenarios', { exact: true }).click()
  await expect(page).toHaveURL(/aip=scenarios/)
})
