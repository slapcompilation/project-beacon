// Pillar 2 end-to-end (A3): the grown ontology is CONSUMED, not just stored.
// Fixture: untyped theft write-offs seeded on the smoke hotel. The loop:
// detector proposes "Theft" → operator approves on the Ontology page → the
// variant page's write-off form offers "Theft" as a typed category.
// First run exercises the approval; later runs find it already approved and
// only assert consumption — the invariant that must never regress.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('grown ontology reaches the write-off form (detect → approve → consume)', async ({ page }) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  const session = (await res.json()) as { access_token: string }
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(
    ([k, v]) => { localStorage.setItem(k, v) },
    [`sb-${ref}-auth-token`, JSON.stringify(session)],
  )

  // 1) Ontology page: approve the Theft gap when it's still pending (first
  //    run); on later runs it's already decided and no card shows.
  await page.goto('/mind?aip=ontology')
  await expect(page.getByText(/Ontology/i).first()).toBeVisible({ timeout: 45_000 })
  const theftCard = page.getByTestId('gap-Theft')
  try {
    await theftCard.waitFor({ state: 'visible', timeout: 15_000 })
    await theftCard.getByRole('button', { name: /approve/i }).click()
    await expect(theftCard).toBeHidden({ timeout: 20_000 })
  } catch { /* already approved on a previous run — consumption below is the invariant */ }

  // 2) A variant page's write-off form offers the typed category.
  const rows = await fetch(`${SUPABASE_URL}/rest/v1/product_variants?select=id&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
  }).then((r) => r.json() as Promise<{ id: string }[]>)
  test.skip(rows.length === 0, 'no variants visible to the smoke user')

  await page.goto(`/variant/${rows[0].id}`)
  await expect(page.locator('header h1')).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: /write off \(waste\)/i }).click()

  // datalist options are never "visible" — assert the approved category is
  // attached to the suggestion list
  await expect(
    page.locator('#writeoff-approved-categories option[value="Theft"]'),
  ).toBeAttached({ timeout: 20_000 })
})
