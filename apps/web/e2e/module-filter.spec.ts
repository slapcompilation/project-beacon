// Filter once — the table, the count and every other number narrow together.
//
// `object_set_filter` had been a variable type with no consumer since W1: the
// builder offered it and nothing did anything with it. This is the consumer.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('narrowing the set narrows everything reading it', async ({ page }) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  const session = JSON.stringify(await res.json())
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v) }, [`sb-${ref}-auth-token`, session])

  await page.goto('/modules/low_stock_triage')
  await expect(page.getByRole('heading', { name: 'Low stock triage' })).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 30_000 })

  const rowsBefore = await page.locator('table tbody tr').count()
  const countCard = page.locator('div').filter({ hasText: /^Below threshold$/ }).locator('..')
  await expect(countCard).toContainText(String(rowsBefore))

  // CONTAIN is a PREFIX. "Stand" matches the demo variants; a mid-word fragment
  // deliberately does not, which is Foundry's documented limit.
  const keyword = page.getByPlaceholder('Starts with…')
  await keyword.fill('zzz-no-such-thing')
  await expect(page.getByText(/resolved to no objects/)).toBeVisible({ timeout: 15_000 })

  // The count followed the table down to nothing — same set, one filter.
  await expect(countCard).toContainText('0')

  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 })
  await expect(countCard).toContainText(String(rowsBefore))
})
