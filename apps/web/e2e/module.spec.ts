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

// W4: promotion is its own resource. Publishing lists the module in the portal
// and pins a version; unpublishing removes the listing and leaves the module.
test('an admin publishes a module to the portal and takes it back down', async ({ page }) => {
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

  // The module may already be published from an earlier run or a seed, so start
  // from a known state rather than assuming which button is on screen. CI found
  // this: prod had a promotion, so the control read "Publication" and the click
  // waited 90s for a button that was never going to appear.
  const existing = page.getByRole('button', { name: 'Publication' })
  if (await existing.isVisible()) {
    await existing.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Unpublish' }).click()
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 30_000 })
  }

  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('inventory, daily').fill('inventory, e2e')
  await dialog.getByRole('button', { name: /^Publish/ }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })

  // It is now findable by somebody who never knew the URL.
  await page.goto('/applications')
  await expect(page.getByRole('heading', { name: 'Built here' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Inventory', { exact: true })).toBeVisible()
  const card = page.getByRole('link', { name: /Low stock triage/ })
  await expect(card).toBeVisible()

  // A tag filters the cards; it is not a section.
  await page.getByRole('button', { name: 'e2e', exact: true }).click()
  await expect(card).toBeVisible()

  // Unpublishing removes the listing, not the module.
  await page.goto('/modules/low_stock_triage')
  await page.getByRole('button', { name: 'Publication' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Unpublish' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Low stock triage' })).toBeVisible()
})
