// The active access purpose, carried on every Supabase request as the
// x-beacon-purpose header (read server-side by active_purpose() in RLS). Kept in
// a module ref so the singleton client's fetch wrapper can pick it up without
// re-creating the client on every purpose change. The purpose store owns writes.

let activePurpose: string | null = null

export function setActivePurposeHeader(purpose: string | null): void {
  activePurpose = purpose
}

export function getActivePurposeHeader(): string | null {
  return activePurpose
}
