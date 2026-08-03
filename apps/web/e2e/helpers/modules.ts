// Shared plumbing for the module specs.
//
// Written after an audit found 87 of 92 modules in the demo org were e2e
// leftovers — one more every run, filling the application list with probes.
// A spec that creates a module owns removing it.

import type { Page } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SMOKE_USER_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? ''

export async function accessToken(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`smoke login failed: ${res.status}`)
  return ((await res.json()) as { access_token: string }).access_token
}

/** Put a real session in the page, the way every module spec starts. */
export async function signIn(page: Page): Promise<void> {
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

export function restHeaders(token: string): Record<string, string> {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

export async function post<T = { id: string }>(
  token: string, path: string, body: unknown,
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST', headers: restHeaders(token), body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as T[]
  return rows[0]
}

/** Remove a module the spec made. Children go with it (ON DELETE CASCADE), so
 *  this is the only cleanup a spec needs. Never throws: a failed teardown must
 *  not turn a passing test red, and check:modules catches anything missed. */
export async function deleteModule(token: string, apiName: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/modules?api_name=eq.${apiName}`, {
      method: 'DELETE', headers: { ...restHeaders(token), Prefer: 'return=minimal' },
    })
  } catch {
    // Nothing to do — the guard will report it if it really is left behind.
  }
}
