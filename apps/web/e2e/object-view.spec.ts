// Object View smoke (Phase 2 gate): the canonical frame renders visibly on
// real objects — header band + audit rail at nonzero size. Covers every page
// migrated onto ObjectViewFrame; add a row per migration.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

const MIGRATED: { table: string; route: string }[] = [
  { table: 'product_variants', route: 'variant' },
  { table: 'purchase_orders',  route: 'po' },
  { table: 'suppliers',        route: 'supplier' },
  { table: 'restock_requests', route: 'restock' },
]

let session: { access_token: string }
test.beforeAll(async () => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  session = (await res.json()) as { access_token: string }
})

for (const { table, route } of MIGRATED) {
  test(`${route} object page renders the canonical frame`, async ({ page }) => {
    // any row the smoke user can see — no hardcoded ids to go stale
    const rows = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
    }).then((r) => r.json() as Promise<{ id: string }[]>)
    test.skip(!Array.isArray(rows) || rows.length === 0, `no ${table} visible to the smoke user`)

    const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
    await page.addInitScript(
      ([k, v]) => { localStorage.setItem(k, v) },
      [`sb-${ref}-auth-token`, JSON.stringify(session)],
    )
    await page.goto(`/${route}/${rows[0].id}`)

    await expect(page.locator('header h1')).toBeVisible({ timeout: 45_000 }) // header band
    const rail = page.locator('aside').last()                                // audit rail
    await expect(rail).toBeVisible()
    expect(((await rail.boundingBox())?.height ?? 0), 'rail height').toBeGreaterThan(100)
  })
}
