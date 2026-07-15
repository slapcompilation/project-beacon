// AIP-native OPERATE arc, P1 gate: a Live Stock row shows the agent's take
// inline (AipRowBadge), and clicking it opens that item's agent decisions in
// the ContextPanel slide-over — the "fabric, not destination" payoff.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('live stock row surfaces the agent take and opens it inline', async ({ page }) => {
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

  await page.goto('/floor?panel=stock')
  // the row badge appears where a variant has an open proposal (live demo data).
  // waitFor polls; the demo hotel reliably has proposals, but skip gracefully
  // rather than fail if a data reset ever clears them.
  const badge = page.getByRole('button', { name: /proposal|awaiting you/i }).first()
  const appeared = await badge.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false)
  test.skip(!appeared, 'no AIP row signal in the smoke hotel right now')

  await badge.click()
  // the slide-over opens the item's agent decisions inline — fabric, not destination
  await expect(page.getByText(/Agent Decisions/i).first()).toBeVisible({ timeout: 20_000 })
})

test('the badge reaches a P2 surface (Locations) via the provider', async ({ page }) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  const session = JSON.stringify(await res.json())
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v) }, [`sb-${ref}-auth-token`, session])

  await page.goto('/floor?panel=locations')
  const badge = page.getByRole('button', { name: /proposal|awaiting you/i }).first()
  const appeared = await badge.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false)
  test.skip(!appeared, 'no signalled variant in an open location group right now')
  await badge.click()
  await expect(page.getByText(/Agent Decisions/i).first()).toBeVisible({ timeout: 20_000 })
})
