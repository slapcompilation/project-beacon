// W6's exit criterion: an admin composes an application in the UI and publishes
// it. No SQL anywhere in this test — if it passes, a module can be built by
// somebody without database access, which is the whole point of the arc.

import { test, expect } from '@playwright/test'
import { accessToken, deleteModule } from './helpers/modules'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

// A spec that creates a module owns removing it. An audit found 87 leftovers in
// the demo org — one more every run — because none of them did.
const created: string[] = []
test.afterEach(async () => {
  const token = await accessToken()
  for (const name of created.splice(0)) await deleteModule(token, name)
})

/** The builder edits an existing module, so the test needs one it can wreck.
 *  A fresh api_name per run keeps the suite re-runnable. */
async function seedEmptyModule(apiName: string) {
  const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!auth.ok) throw new Error(`smoke login failed: ${auth.status}`)
  const session = await auth.json() as { access_token: string }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/modules`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ api_name: apiName, title: 'Builder probe', status: 'draft' }),
  })
  if (!res.ok) throw new Error(`seed failed: ${res.status} ${await res.text()}`)
  return session
}

test('an admin builds an application in the UI and publishes it', async ({ page }) => {
  const apiName = `builder_probe_${Date.now().toString(36)}`
  created.push(apiName)
  const session = await seedEmptyModule(apiName)
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v) },
    [`sb-${ref}-auth-token`, JSON.stringify(session)])

  await page.goto(`/modules/${apiName}/edit`)
  const config = page.getByRole('complementary', { name: 'Configuration' })
  await expect(page.getByText('Builder probe').first()).toBeVisible({ timeout: 45_000 })

  // A variable first — a display widget cannot exist without one to bind to,
  // which is the module_widgets_needs_binding CHECK showing up in the UI.
  // Adding selects it, so the configuration panel is already open on it.
  await page.getByRole('button', { name: 'Add Variables' }).click()
  await expect(config.getByText('Variable', { exact: true })).toBeVisible({ timeout: 15_000 })

  // By label, not by position — a field added to the panel used to shift these.
  const nameField = config.getByLabel('Name')
  await nameField.fill('lines')
  await nameField.blur()
  const valueField = config.getByLabel('Value')
  await valueField.fill('12')
  await valueField.blur()
  await expect(page.getByText('lines').first()).toBeVisible({ timeout: 15_000 })

  // A text widget, configured to interpolate that variable.
  await page.getByRole('button', { name: 'Add widget' }).click()
  await page.getByRole('button', { name: /^Text/ }).click()
  const body = config.locator('textarea')
  await expect(body).toBeVisible({ timeout: 15_000 })
  await body.fill('Counting {{lines}} today.')
  await body.blur()

  // The canvas is the real renderer — what it shows is what an operator sees.
  await expect(page.getByText('Counting 12 today.')).toBeVisible({ timeout: 15_000 })

  // Publishing moves the version promotions and installations point at.
  await page.getByRole('button', { name: 'Publish v2' }).click()
  await expect(page.getByRole('button', { name: 'Publish v3' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('published').first()).toBeVisible()

  // And it renders for an operator at its own route, built without any SQL.
  await page.goto(`/modules/${apiName}`)
  await expect(page.getByRole('heading', { name: 'Builder probe' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Counting 12 today.')).toBeVisible()
})
