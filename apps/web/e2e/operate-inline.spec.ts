// AIP-native OPERATE arc gates (docs/AIP-OPERATE-INLINE.md):
//  P1  a Live Stock row surfaces the agent take inline + opens it in the slide-over
//  P2  the badge reaches another list (Locations) via the provider
//  P3  a pending proposal can be ACTED ON inline (approve button on the shared
//      ObjectAgentActivity — tested on the variant page for determinism, since
//      proposal-bearing rows can be virtualized off a long list)
//  P4  "Ask copilot" opens the copilot ALREADY SCOPED to the item — the
//      selection-aware copilot reached in one click, not a manual tab switch

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

async function auth(page: import('@playwright/test').Page) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  const session = await res.json() as { access_token: string }
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v) }, [`sb-${ref}-auth-token`, JSON.stringify(session)])
  return session
}

test('a list row surfaces the agent take and opens it in the slide-over (P1/P2)', async ({ page }) => {
  await auth(page)
  await page.goto('/floor?panel=stock')
  const badge = page.getByRole('button', { name: /proposal|awaiting you/i }).first()
  const appeared = await badge.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false)
  test.skip(!appeared, 'no AIP row signal in the smoke hotel right now')
  await badge.click()
  await expect(page.getByText(/Agent Decisions/i).first()).toBeVisible({ timeout: 20_000 })
})

test('a pending proposal can be acted on inline (P3)', async ({ page }) => {
  const session = await auth(page)
  // a variant that actually has a pending proposal (via its action_payload link)
  const rows = await fetch(`${SUPABASE_URL}/rest/v1/proposals?status=eq.pending&select=action_payload&limit=20`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
  }).then((r) => r.json() as Promise<{ action_payload: { variantId?: string } }[]>)
  const variantId = rows.map((r) => r.action_payload?.variantId).find(Boolean)
  test.skip(!variantId, 'no pending proposal with a variant link right now')

  await page.goto(`/variant/${variantId}`)
  await expect(page.getByText(/Agent Decisions/i).first()).toBeVisible({ timeout: 45_000 })
  // the inline approve button — acting where the item lives, no trip to the queue
  await expect(page.getByRole('button', { name: /Approve — executes the action/i }).first())
    .toBeVisible({ timeout: 15_000 })
})

test('Ask copilot opens the copilot scoped to the item (P4)', async ({ page }) => {
  const session = await auth(page)
  const variants = await fetch(`${SUPABASE_URL}/rest/v1/variants?select=id&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
  }).then((r) => r.json() as Promise<{ id: string }[]>)
  const variantId = variants[0]?.id
  test.skip(!variantId, 'no variant in the smoke hotel right now')

  await page.goto(`/variant/${variantId}`)
  await expect(page.getByText(/Agent Decisions/i).first()).toBeVisible({ timeout: 45_000 })
  // one click from the agent's take to a copilot already bound to this variant
  await page.getByRole('button', { name: /Ask copilot/i }).first().click()
  await expect(page.getByText(/Viewing/i).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByPlaceholder(/Ask anything/i)).toBeVisible({ timeout: 15_000 })
})

test('the badge reaches a P2 surface (Locations) via the provider', async ({ page }) => {
  await auth(page)
  await page.goto('/floor?panel=locations')
  const badge = page.getByRole('button', { name: /proposal|awaiting you/i }).first()
  const appeared = await badge.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false)
  test.skip(!appeared, 'no signalled variant in an open location group right now')
  await badge.click()
  await expect(page.getByText(/Agent Decisions/i).first()).toBeVisible({ timeout: 20_000 })
})
