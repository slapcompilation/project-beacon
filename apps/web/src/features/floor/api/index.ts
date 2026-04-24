// Layer: Floor — API functions for pending scans (ghost entry resolution)

import { supabase } from '@/lib/supabase/client'
import type { PendingScan } from '@beacon/types'

export async function recordPendingScan(
  scannedCode: string,
  locationId?: string | null,
  approxQuantity?: number | null,
  notes?: string | null,
): Promise<string> {
  const result = await supabase.rpc('record_pending_scan', {
    p_scanned_code:    scannedCode,
    p_location_id:     locationId ?? null,
    p_approx_quantity: approxQuantity ?? null,
    p_notes:           notes ?? null,
  }) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  if (!result.data) throw new Error('No data returned from record_pending_scan')
  return result.data
}

export async function fetchPendingScans(): Promise<PendingScan[]> {
  const result = await supabase.rpc('get_pending_scans') as unknown as {
    data: PendingScan[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function resolvePendingScan(
  scanId: string,
  variantId: string,
  updateBarcode = false,
): Promise<void> {
  const result = await supabase.rpc('resolve_pending_scan', {
    p_scan_id:        scanId,
    p_variant_id:     variantId,
    p_update_barcode: updateBarcode,
  }) as unknown as { error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

export async function skipPendingScan(scanId: string): Promise<void> {
  const result = await supabase.rpc('skip_pending_scan', {
    p_scan_id: scanId,
  }) as unknown as { error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}
