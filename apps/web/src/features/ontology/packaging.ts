// Ontology packaging (Tier 4.3) — export an org's authored artifacts as a
// portable document, install it into another.
//
// Every reference travels by api_name, never by uuid: an id means nothing in
// the organization installing it, so an export carrying one installs as a
// dangling reference. ontology_drift asserts the export contains no uuids.
//
// The reason this exists: without it every new customer starts from an empty
// Studio, and all of P1–P5 is per-tenant and non-transferable.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export interface InstallResult {
  artifact:  string
  installed: number
  skipped:   number
}

export async function exportOntologyPackage(name: string): Promise<unknown> {
  const result = await supabase.rpc('export_ontology_package', { p_name: name }) as unknown as {
    data: unknown
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function installOntologyPackage(pkg: unknown): Promise<InstallResult[]> {
  const result = await supabase.rpc('install_ontology_package', { p_package: pkg }) as unknown as {
    data: InstallResult[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export function useExportOntologyPackage() {
  return useMutation({
    mutationFn: (name: string) => exportOntologyPackage(name),
    onSuccess: (pkg, name) => {
      // Download rather than display: a package is a file you hand to another
      // organization, not something to read on screen.
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `${name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.ontology.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Package exported')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useInstallOntologyPackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pkg: unknown) => installOntologyPackage(pkg),
    onSuccess: (rows) => {
      const installed = rows.reduce((n, r) => n + r.installed, 0)
      const skipped   = rows.reduce((n, r) => n + r.skipped, 0)
      toast.success(`Installed ${String(installed)} artifact${installed === 1 ? '' : 's'}${skipped > 0 ? ` · ${String(skipped)} already present` : ''}`)
      void qc.invalidateQueries()
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
