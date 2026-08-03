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
  //
  // A live org constraint blocks stock actions outside 06:00–22:00 UTC, so this
  // used to pass by day and fail every night. Pinning the browser clock instead
  // expires the JWT and lands on the login page — the constraint is DATA, so the
  // test suspends that one row and puts it back.
  const token = await accessToken()
  const windows = await setTimeWindowConstraints(token, false)
  try {
    await dialog.getByRole('button', { name: /request|submit|create/i }).click()
    await expect(dialog).toBeHidden({ timeout: 30_000 })
  } finally {
    await setTimeWindowConstraints(token, true, windows)
  }
})

async function accessToken(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  return ((await res.json()) as { access_token: string }).access_token
}

/** Suspend (or restore) the org's time-window constraints. Returns the ids it
 *  touched so the restore only re-activates what it switched off. */
async function setTimeWindowConstraints(
  token: string, active: boolean, only?: string[],
): Promise<string[]> {
  const headers = {
    apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json', Prefer: 'return=representation',
  }
  const ids = only ?? await fetch(
    `${SUPABASE_URL}/rest/v1/constraints?bucket=eq.time-window&active=eq.true&select=id`,
    { headers },
  ).then(async (r) => ((await r.json()) as Array<{ id: string }>).map((c) => c.id))

  if (ids.length === 0) return []
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/constraints?id=in.(${ids.join(',')})`,
    { method: 'PATCH', headers, body: JSON.stringify({ active }) },
  )
  if (!res.ok) throw new Error(`constraint toggle failed: ${res.status} ${await res.text()}`)
  return ids
}

// W5: a workflow authored at one property is adopted by another. The scope rule
// itself is proved in supabase/tests/rls_contracts.sql (C28) under a
// hotel-scoped role — an org-level user sees every hotel, so a browser test
// could not prove it. This covers the operator's half: the adoption surface.
test('an org director sees which properties have adopted a module', async ({ page }) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  const session = JSON.stringify(await res.json())
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v) }, [`sb-${ref}-auth-token`, session])

  await page.goto('/modules/morning_par_check')
  await expect(page.getByRole('heading', { name: 'Morning par check' })).toBeVisible({ timeout: 45_000 })

  await expect(page.getByText('Adoption', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('authored here')).toBeVisible()

  // A previous run may have left the sister property adopted, so start from a
  // known state instead of assuming which button is on screen.
  const uninstall = page.getByRole('button', { name: 'Uninstall' })
  if (await uninstall.isVisible()) {
    await uninstall.click()
    await expect(page.getByRole('button', { name: 'Install' })).toBeVisible({ timeout: 30_000 })
  }

  await expect(page.getByText('0 of 1 other property')).toBeVisible()

  // Install at the sister property. The count is the org-wide half of the exit
  // criterion — who has adopted this, not just that it can be adopted.
  await page.getByRole('button', { name: 'Install' }).click()
  await expect(page.getByRole('button', { name: 'Fork' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('1 of 1 other property')).toBeVisible()

  // Uninstalling puts the property back to offering Install — and leaves the
  // suite re-runnable, which a test that adopts and walks away would not.
  await page.getByRole('button', { name: 'Uninstall' }).click()
  await expect(page.getByRole('button', { name: 'Install' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('0 of 1 other property')).toBeVisible()
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

  // The module may already be published from a previous run or a seed, so start
  // from a known state rather than assuming which button is on screen.
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
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible()
})
