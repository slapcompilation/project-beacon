// The Tabs widget — navigation, with selection DERIVED rather than held.
//
// The unit tests in runtime.test.ts prove the derivation. This proves it reaches
// the screen: pressing a tab fires its event, the layout moves, and the tab that
// now describes where you are is the one that reads as selected.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('tabs navigate, and the selected one is worked out from where you are', async ({ page }) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  const session = JSON.stringify(await res.json())
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v) }, [`sb-${ref}-auth-token`, session])

  await page.goto('/modules/shift_nav')
  await expect(page.getByRole('heading', { name: 'Shift board' })).toBeVisible({ timeout: 45_000 })

  // Pages, not a tabbed section — the widget navigates "throughout pages and
  // overlays", and a tabbed section would draw its own bar next to this one.
  const belowPar = page.getByRole('button', { name: /Below par/ })
  const catalogue = page.getByRole('button', { name: /Catalogue/ })

  // Nothing was pressed yet: the first tab's switch_tab would be a no-op,
  // because that tab is already the active one. So it reads as selected.
  await expect(belowPar).toHaveClass(/font-semibold/, { timeout: 30_000 })
  await expect(catalogue).not.toHaveClass(/font-semibold/)

  // Its badge reads a variable — a count that is live, not typed in.
  await expect(belowPar).toContainText(/[0-9]/)

  // Pressing the second tab moves the layout, and selection follows the layout.
  await catalogue.click()
  await expect(catalogue).toHaveClass(/font-semibold/, { timeout: 15_000 })
  await expect(belowPar).not.toHaveClass(/font-semibold/)
  await expect(page.getByRole('heading', { name: 'Everything we stock' })).toBeVisible()

  await belowPar.click()
  await expect(belowPar).toHaveClass(/font-semibold/, { timeout: 15_000 })
  await expect(page.locator('table tbody tr').first()).toBeVisible()
})
