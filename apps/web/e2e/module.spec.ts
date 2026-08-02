// W2's exit criterion, driven through the real UI: a row selection sets module
// variables, a Metric Card reads one of them, and a Button Group clears them.
// The unit test proves the reducer; this proves the wiring reaches the screen.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('a module reacts to a row selection and clears again', async ({ page }) => {
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

  // Nothing selected yet — the markdown widget interpolates an em dash.
  await expect(page.getByText(/^Selected: — /)).toBeVisible({ timeout: 30_000 })

  const firstRow = page.locator('table tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 30_000 })
  const name = (await firstRow.locator('td').first().innerText()).trim()

  await firstRow.click()
  await expect(page.getByText(`Selected: ${name}`, { exact: false })).toBeVisible()

  await page.getByRole('button', { name: 'Clear selection' }).click()
  await expect(page.getByText(/^Selected: — /)).toBeVisible()

  // The hidden tab's set resolves only once the tab is shown — Foundry's lazy rule.
  await page.getByRole('button', { name: 'Everything' }).click()
  await expect(page.getByText('Every variant')).toBeVisible({ timeout: 30_000 })
})

// W3: a Logic Tool behind a variable, and a Button Group that applies a typed
// Action through the registry's own form — not a second write path.
test('a module computes through a Logic Tool and proposes a typed action', async ({ page }) => {
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
  const firstRow = page.locator('table tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 45_000 })
  await firstRow.click()

  // The forecast tool runs only once its variantId argument is bound, and its
  // card must show the basis every computed result is required to carry.
  const forecast = page.locator('div').filter({ hasText: /^Projected 7-day use$/ }).locator('..')
  await expect(forecast).toContainText(/rolling|ewma|auto:|avg/i, { timeout: 45_000 })

  // The action opens the REGISTRY's own form — variantId is bound hidden, so it
  // never appears as a field, and urgency is prefilled read-only.
  await page.getByRole('button', { name: 'Request restock' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 15_000 })
  await expect(dialog.getByLabel(/variant/i)).toHaveCount(0)
  await expect(dialog.locator('select[disabled], input[disabled]').first()).toBeVisible()

  // Submitting goes through dispatchAction, the constraint gate and the audit
  // trail — the module is a caller, not a second write path.
  await dialog.getByRole('button', { name: /request|submit|create/i }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
})
