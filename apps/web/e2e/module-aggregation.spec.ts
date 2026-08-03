// One object set, four numbers.
//
// Foundry's Metric Card "must be backed by a Workshop variable of the
// corresponding type" — it displays, it does not aggregate. The aggregating is a
// variable definition kind that reads another object-set VARIABLE, which is what
// stops you keeping a second saved set of the same object type per number.

import { test, expect } from '@playwright/test'
import { accessToken, deleteModule } from './helpers/modules'

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

test('one set backs four different numbers', async ({ page }) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  const session = JSON.stringify(await res.json())
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v) }, [`sb-${ref}-auth-token`, session])

  await page.goto('/modules/low_stock_triage')
  await expect(page.getByRole('heading', { name: 'Low stock triage' })).toBeVisible({ timeout: 45_000 })

  // Every one of these reads the SAME lowStock variable.
  for (const label of ['Below threshold', 'Units on hand', 'Lowest count', 'Units of measure']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 30_000 })
  }

  // Each carries where it came from — a number an operator cannot trace is a
  // number they cannot act on.
  await expect(page.getByText('count over lowStock').first()).toBeVisible()
  await expect(page.getByText('sum of current_stock over lowStock')).toBeVisible()
  await expect(page.getByText('min of current_stock over lowStock')).toBeVisible()
  await expect(page.getByText('cardinality of unit_of_measure over lowStock')).toBeVisible()

  // The count agrees with the table, because they are the same set. Wait for the
  // set to resolve first — counting mid-flight compares a number against zero.
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 30_000 })
  const rows = await page.locator('table tbody tr').count()
  const countCard = page.locator('div').filter({ hasText: /^Below threshold$/ }).locator('..')
  await expect(countCard).toContainText(String(rows))
})

test('a metric card bound to a set says so instead of guessing', async ({ page }) => {
  const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const token = ((await auth.json()) as { access_token: string }).access_token
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]

  const headers = {
    apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json', Prefer: 'return=representation',
  }
  const post = async (path: string, body: unknown) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`)
    return ((await r.json()) as Array<{ id: string }>)[0]
  }

  const apiName = `agg_probe_${Date.now().toString(36)}`
  created.push(apiName)
  const mod = await post('modules', { api_name: apiName, title: 'Aggregation probe', status: 'draft' })
  const set = await post('module_variables', {
    module_id: mod.id, api_name: 'items', label: 'Items', var_type: 'object_set',
    definition_kind: 'object_set_definition', definition: {},
  })
  // Deliberately the shape Foundry's card refuses: a set where a value belongs.
  await post('module_widgets', {
    module_id: mod.id, api_name: 'wrong', widget_type: 'metric_card', title: 'Straight off a set',
    variable_id: set.id, config: {}, position: 0,
  })

  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v) },
    [`sb-${ref}-auth-token`, JSON.stringify(await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })).json())])

  await page.goto(`/modules/${apiName}`)
  await expect(page.getByText(/bound to a set rather than a value/)).toBeVisible({ timeout: 45_000 })
})
