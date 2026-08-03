// G1 — a module inside a module, once per object.
//
// `variant_card` is a component: one interface variable, one text widget that
// reads properties off it, and nothing else. `below_par_cards` loops the
// low-stock set and renders that same card per entry. The point of the phase is
// that the card is written once.

import { test, expect } from '@playwright/test'
import { deleteModule } from './helpers/modules'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

const created: string[] = []
test.afterEach(async () => {
  const token = await accessToken()
  for (const name of created.splice(0)) await deleteModule(token, name)
})

async function signIn(page: import('@playwright/test').Page) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  const session = JSON.stringify(await res.json())
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v) }, [`sb-${ref}-auth-token`, session])
}

test('one card is written once and rendered per object', async ({ page }) => {
  await signIn(page)
  await page.goto('/modules/below_par_cards')
  await expect(page.getByRole('heading', { name: 'Below par' })).toBeVisible({ timeout: 45_000 })

  // The child's interface variable received a whole object, and the card read
  // properties off it — anything less and this prints JSON.
  const cards = page.locator('.bp6-card, [class*="rounded"]').filter({ hasText: /on hand, par/ })
  await expect(cards.first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/on hand, par/).first()).toBeVisible()
  await expect(page.getByText('{{item')).toHaveCount(0)

  // Paging is configured at 2 per page over 4 low-stock lines.
  const before = await page.getByText(/on hand, par/).count()
  expect(before).toBeLessThanOrEqual(2)
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText(/on hand, par/).first()).toBeVisible({ timeout: 15_000 })
})

test('a draft cannot be shown inside another application', async ({ page }) => {
  await signIn(page)
  const token = await accessToken()
  const setStatus = (status: string) => patchModule(token, 'variant_card', { status })

  await setStatus('draft')
  try {
    await page.goto('/modules/below_par_cards')
    await expect(page.getByRole('heading', { name: 'Below par' })).toBeVisible({ timeout: 45_000 })
    // Foundry embeds the published version; we do not snapshot content per
    // version, so the honest equivalent is refusing to embed a draft at all.
    await expect(page.getByText(/is still a draft/).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/on hand, par/)).toHaveCount(0)
  } finally {
    await setStatus('published')
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

async function patchModule(token: string, apiName: string, patch: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/modules?api_name=eq.${apiName}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`patch failed: ${res.status} ${await res.text()}`)
}

// The authoring half: G1 shipped a runtime that only SQL could configure, which
// is the gap W6 existed to close. This composes a loop through the builder.
test('a loop can be configured in the builder without SQL', async ({ page }) => {
  await signIn(page)
  const token = await accessToken()
  const parent = `loop_probe_${Date.now().toString(36)}`
  created.push(parent)

  // A parent with a set to walk. The component it will show already exists and
  // is published — that is the point of a component.
  await seed(token, parent)

  await page.goto(`/modules/${parent}/edit`)
  await expect(page.getByText(parent).first()).toBeVisible({ timeout: 45_000 })

  await page.getByRole('button', { name: 'Add Layout' }).click()
  await page.getByRole('button', { name: /One per object/ }).click()

  const config = page.getByRole('complementary', { name: 'Configuration' })
  await expect(config.getByText('loop layout')).toBeVisible({ timeout: 15_000 })

  // Three pickers, all resolving by name at runtime — free text here would be a
  // loop that silently shows nothing.
  await config.getByLabel('Walk this set').selectOption('belowPar')
  await config.getByLabel('Show this application for each').selectOption('variant_card')
  await config.getByLabel('The object arrives in').selectOption('item')

  // The canvas renders the component per object, straight away.
  await expect(page.getByText(/on hand, par/).first()).toBeVisible({ timeout: 30_000 })
})

async function seed(token: string, apiName: string) {
  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`)
    return (await res.json()) as Array<{ id: string }>
  }
  const [mod] = await post('modules', { api_name: apiName, title: apiName, status: 'draft' })
  const sets = await fetch(`${SUPABASE_URL}/rest/v1/object_sets?api_name=eq.low_stock&select=id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  }).then((r) => r.json() as Promise<Array<{ id: string }>>)
  await post('module_variables', {
    module_id: mod.id, api_name: 'belowPar', label: 'Below par', var_type: 'object_set',
    definition_kind: 'object_set_definition', definition: { objectSetId: sets[0].id },
  })
}
