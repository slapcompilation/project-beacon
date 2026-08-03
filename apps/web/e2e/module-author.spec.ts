// W7 — describing an application. The model call is INTERCEPTED and answered
// with a fixed spec, so this test costs nothing and never flakes on a
// generation. What it exercises is everything after the model: parse, validate,
// materialise names into ids, and land in the builder as a draft.
//
// The generator's own quality is a separate question, graded by the 29-case eval
// suite in packages/reality-graph/src/authoring — no model runs there either.

import { test, expect } from '@playwright/test'
import { accessToken, deleteModule } from './helpers/modules'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

test.skip(!SUPABASE_URL || !EMAIL, 'SMOKE_USER_* / VITE_SUPABASE_* env not set')

/** Deliberately snake_case and fenced — what a real answer looked like. */
const ANSWER = '```json\n' + JSON.stringify({
  api_name: 'authored_probe',
  title: 'Authored probe',
  description: 'What is below par, and how many lines that is.',
  icon: 'inbox',
  variables: [
    { api_name: 'lowStock', label: 'Below par', var_type: 'object_set',
      definition_kind: 'object_set_definition', definition: { objectSet: 'low_stock' } },
    // The card displays a VALUE; the aggregating belongs to the variable (#478).
    { api_name: 'lines', label: 'Lines below par', var_type: 'numeric',
      definition_kind: 'object_set_aggregation',
      definition: { objectSet: 'lowStock', metric: 'count' } },
    { api_name: 'picked', label: 'Picked', var_type: 'string',
      definition_kind: 'static', definition: { value: null } },
  ],
  layouts: [{ api_name: 'top', title: 'Top', layout_type: 'row', position: 0 }],
  widgets: [
    { api_name: 'count', widget_type: 'metric_card', title: 'Lines below par',
      layout: 'top', variable: 'lines', config: {}, position: 0 },
    { api_name: 'items', widget_type: 'object_table', title: 'Below par',
      variable: 'lowStock', config: { columns: ['name', 'current_stock'] }, position: 1 },
    { api_name: 'note', widget_type: 'markdown', title: '',
      config: { body: 'Picked: {{picked}}' }, position: 2 },
  ],
  events: [{ widget: 'items', trigger: 'row_select', effect_type: 'set_variable',
    config: { variable: 'picked', fromProperty: 'name' }, position: 0 }],
}) + '\n```'

test('a described application arrives as a reviewable draft', async ({ page }) => {
  const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!auth.ok) throw new Error(`smoke login failed: ${auth.status}`)
  const session = JSON.stringify(await auth.json())
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v) }, [`sb-${ref}-auth-token`, session])

  // The one paid call in the flow, answered locally.
  await page.route('**/functions/v1/module-author', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ text: ANSWER, model: 'stub', tokens: 0 }),
    })
  })

  await page.goto('/applications')
  await page.getByRole('button', { name: 'Describe' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('What is below par this morning, and let me reorder it.')
  // Compose stays disabled until the object-set catalog is in hand — the model
  // must only ever be told about sets this user can already see.
  const compose = dialog.getByRole('button', { name: 'Compose' })
  await expect(compose).toBeEnabled({ timeout: 30_000 })
  await compose.click()

  // The proposal is reviewed before anything is written.
  await expect(dialog.getByText('Authored probe')).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByText('3 widgets')).toBeVisible()
  await expect(dialog.getByText(/does not fit the vocabulary/)).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Open as draft' }).click()

  // It lands in the builder, as a draft, with its references resolved: the table
  // shows real rows, which only happens if the object set name became an id.
  await expect(page).toHaveURL(/\/modules\/authored_probe_.*\/edit/, { timeout: 30_000 })
  await expect(page.getByText('draft').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Authored probe' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 30_000 })

  // The event's variable reference survived the name → id rewrite. Checked on
  // the module's own route: the builder canvas is deliberately not interactive,
  // so selection there means "configure this", not "use it".
  // The generator names it, so the spec only learns the name here.
  const apiName = /\/modules\/([^/]+)\/edit/.exec(page.url())?.[1] ?? ''
  test.info().annotations.push({ type: 'cleanup', description: apiName })
  await page.goto(`/modules/${apiName}`)
  await page.locator('table tbody tr').first().click({ timeout: 30_000 })
  await expect(page.getByText(/^Picked: (?!—)/)).toBeVisible({ timeout: 15_000 })

  await deleteModule(await accessToken(), apiName)
})
