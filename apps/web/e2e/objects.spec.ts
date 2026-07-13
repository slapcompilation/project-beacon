// Objects browser smoke: the ontology's front door renders every type card
// with a live count — the sidebar's Objects entry must never land on a blank.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('objects page renders a card per node type', async ({ page }) => {
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

  await page.goto('/objects')
  await expect(page.getByRole('heading', { name: 'Objects' })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText('Variant', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Supplier', { exact: true })).toBeVisible()
  await expect(page.getByText('Purchase Order', { exact: true })).toBeVisible()
  // the retired explorer still deep-links here
  await page.goto('/graph')
  await expect(page).toHaveURL(/\/objects/)
})
