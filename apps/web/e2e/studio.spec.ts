// Studio landing smoke: the capability map (loop stages) is the everyday primary
// view, a card-click navigates into a tab (including a rail-hidden one), and the
// guided "Create a workflow" recipe lives on its own surface behind the bottom card.

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
  // the capability map is the everyday primary view
  for (const stage of ['Build', 'Govern', 'Prove', 'Sandbox']) {
    await expect(page.getByRole('heading', { name: stage, exact: true })).toBeVisible()
  }
  // a rail-hidden tab is reachable through its landing card
  await page.getByText('Scenarios', { exact: true }).click()
  await expect(page).toHaveURL(/aip=scenarios/)

  // the guided recipe is its own surface, linked from the bottom card
  await page.goto('/mind?aip=studio')
  await page.getByText('Create a workflow', { exact: true }).click()
  await expect(page).toHaveURL(/create-workflow/)
  await expect(page.getByText('Shape the data')).toBeVisible()
})
