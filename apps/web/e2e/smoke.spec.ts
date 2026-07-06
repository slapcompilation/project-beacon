// Surface smoke (handbook §2): the app can be ontologically perfect while the
// operator sees a 0-pixel black box — #310–#314 proved every backend gate
// passes through that failure. These assertions demand VISIBLE rendering:
// Playwright visibility implies nonzero size, which is exactly what the
// CSS-collapse bug violated while every other signal stayed green.

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

async function passwordSession(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status} ${await res.text()}`)
  return JSON.stringify(await res.json())
}

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

test('home renders the map visibly, with pins, console clean', async ({ page }) => {
  const session = await passwordSession()
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(
    ([k, v]) => { localStorage.setItem(k, v) },
    [`sb-${ref}-auth-token`, session],
  )

  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('/briefing')

  // the map card mounts (org scope: "Portfolio map"; hotel scope: "Location")
  await expect(page.getByText(/portfolio map|location/i).first()).toBeVisible({ timeout: 45_000 })

  // the render surface — maplibre canvas wrapper or the SVG fallback — must be
  // VISIBLE at real size. This is the #314 regression: wrapper collapsed to
  // [624, 0] while tiles fetched and no error fired.
  const surface = page.locator('.maplibregl-map, div.relative.h-80 svg').first()
  await expect(surface).toBeVisible({ timeout: 45_000 })
  const box = await surface.boundingBox()
  expect(box?.height ?? 0, 'map surface height').toBeGreaterThan(200)
  expect(box?.width ?? 0, 'map surface width').toBeGreaterThan(300)

  // at least one property pin, visible (existence isn't enough — pins existed
  // in the DOM throughout the collapse bug)
  await expect(
    page.locator('.maplibregl-marker, div.relative.h-80 svg circle').first(),
  ).toBeVisible({ timeout: 45_000 })

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
})
