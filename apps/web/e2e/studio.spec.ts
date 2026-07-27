// Studio landing smoke: five destinations are the everyday primary view, a card
// navigates into the destination's first panel, a rail-hidden panel is still
// reachable, deep links to a panel still resolve (no redirect table), and the
// guided "Create a workflow" recipe lives on its own surface.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('studio landing shows the destinations and navigates', async ({ page }) => {
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
  // five applications over one ontology — the destinations are the primary view
  for (const dest of ['Ontology Manager', 'Object Explorer', 'Automate', 'Logic & Evals', 'Policy']) {
    await expect(page.getByText(dest, { exact: true }).first()).toBeVisible()
  }
  // a rail-hidden panel is still reachable from its destination card
  await page.getByRole('button', { name: 'Scenarios', exact: true }).click()
  await expect(page).toHaveURL(/aip=scenarios/)

  // an existing deep link to a panel still resolves, and the rail shows the
  // destination that contains it — this is what replaces a redirect table.
  await page.goto('/mind?aip=monitors')
  await expect(page.getByRole('button', { name: /Automate/ })).toBeVisible({ timeout: 45_000 })

  // the guided recipe is its own surface, linked from the bottom card
  await page.goto('/mind?aip=studio')
  await page.getByText('Create a workflow', { exact: true }).click()
  await expect(page).toHaveURL(/create-workflow/)
  await expect(page.getByText('Shape the data')).toBeVisible()
})
