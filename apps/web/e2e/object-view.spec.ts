// Object View smoke (Phase 2 gate): the canonical frame renders visibly on a
// real object — header, metric strip, body, audit rail. Same visibility bar
// as smoke.spec.ts: existing in the DOM is not enough.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('variant object page renders the canonical frame', async ({ page }) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  const session = (await res.json()) as { access_token: string }

  // any variant the smoke user can see — no hardcoded ids to go stale
  const rows = await fetch(`${SUPABASE_URL}/rest/v1/product_variants?select=id&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
  }).then((r) => r.json() as Promise<{ id: string }[]>)
  test.skip(rows.length === 0, 'no variants visible to the smoke user')

  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(
    ([k, v]) => { localStorage.setItem(k, v) },
    [`sb-${ref}-auth-token`, JSON.stringify(session)],
  )

  await page.goto(`/variant/${rows[0].id}`)

  // frame anatomy, each visibly rendered
  await expect(page.locator('header h1')).toBeVisible({ timeout: 45_000 })   // header band
  await expect(page.getByText('Current Stock').first()).toBeVisible()        // metric strip
  const rail = page.locator('aside').last()                                  // audit rail
  await expect(rail).toBeVisible()
  expect(((await rail.boundingBox())?.height ?? 0), 'rail height').toBeGreaterThan(100)
})
