// Shared plumbing for the builder spec.
//
// Written after an audit found 87 of 92 modules in the demo org were e2e
// leftovers — one more every run, filling the application list with probes.
// A spec that creates a module owns removing it.

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

function restHeaders(token: string): Record<string, string> {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
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
