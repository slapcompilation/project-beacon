// Functions: the resource, its versions, and running one.
//
// 501 built versioned TypeScript in a QuickJS isolate, 538 made `auto_upgrade` a
// caret range, 597 recorded breaking changes — and none of it was reachable from
// the product. There was no `features/functions/` at all, so nothing could
// create a function, publish a version, or run one.
//
// The shape follows the Functions helper, parsed from
// `functions/images/tsv2-functions-helper-run.png`: a list carrying each
// function's version, inputs built from the signature, and an output panel.
//
// **The database owns every rule about a version.** `guard_function_version`
// enforces immutability, that a version goes forward, and the breaking-change
// rule with its initial-development exemption. This module sends the insert and
// shows the refusal; it re-implements none of it.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export interface FunctionRow {
  id: string
  ontology_id: string
  api_name: string
  display_name: string
  description: string
}

export interface Signature {
  parameters: { name: string; type: string; required: boolean }[]
  returns: string
}

export interface FunctionVersion {
  id: string
  major: number
  minor: number
  patch: number
  prerelease: string | null
  source: string
  signature: Signature
  /** `{object_types: uuid[], link_types: uuid[]}` — what the isolate may read. */
  imports: { object_types: string[]; link_types: string[] }
  edits?: { object_types: string[] }
  published_at: string
  /** What `signature_breaks()` found against the previous version (597). */
  breaking_changes: string[]
}

/** `0.1.0`, or `0.1.0-rc.1`. */
export const versionString = (v: FunctionVersion) =>
  `${v.major}.${v.minor}.${v.patch}${v.prerelease ? `-${v.prerelease}` : ''}`

export function useFunctions(ontologyId: string | null) {
  return useQuery({
    queryKey: ['functions', ontologyId],
    enabled: Boolean(ontologyId),
    queryFn: async (): Promise<FunctionRow[]> => {
      const { data, error } = await supabase.from('functions')
        .select('id, ontology_id, api_name, display_name, description')
        .eq('ontology_id', ontologyId ?? '').order('api_name')
      if (error) throw new Error(error.message)
      return data as FunctionRow[]
    },
  })
}

/** Newest first, which is how the Tags and releases panel sorts: Version (desc). */
export function useFunctionVersions(functionId: string | null) {
  return useQuery({
    queryKey: ['function-versions', functionId],
    enabled: Boolean(functionId),
    queryFn: async (): Promise<FunctionVersion[]> => {
      const { data, error } = await supabase.from('function_versions')
        .select('id, major, minor, patch, prerelease, source, signature, imports, edits, published_at, breaking_changes')
        .eq('function_id', functionId ?? '')
        .order('major', { ascending: false })
        .order('minor', { ascending: false })
        .order('patch', { ascending: false })
      if (error) throw new Error(error.message)
      return data as unknown as FunctionVersion[]
    },
  })
}

export function useCreateFunction(ontologyId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { apiName: string; displayName: string; description: string }) => {
      const { data: me } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('functions').insert({
        ontology_id: ontologyId, api_name: i.apiName, display_name: i.displayName,
        description: i.description, created_by: me.user?.id ?? null,
      }).select('id').single()
      if (error) throw new Error(error.message)
      return (data as { id: string }).id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['functions', ontologyId] })
      toast.success('Function created — publish a version to make it runnable')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The insert the guard judges. Its refusals are namespaced, so they are shown
 *  verbatim rather than translated: `Functions:VersionGoesForward`,
 *  `Functions:BreakingChangeNeedsMajor`, `Functions:VersionsAreImmutable`. */
export function usePublishVersion(functionId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: {
      major: number; minor: number; patch: number
      source: string; signature: Signature; objectTypes: string[]
      /** api names — the audience is the provenance check, which speaks them. */
      edits?: string[]
    }) => {
      const { data: me } = await supabase.auth.getUser()
      const { error } = await supabase.from('function_versions').insert({
        function_id: functionId, major: i.major, minor: i.minor, patch: i.patch,
        source: i.source, signature: i.signature,
        imports: { object_types: i.objectTypes, link_types: [] },
        edits: { object_types: i.edits ?? [] },
        published_by: me.user?.id ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['function-versions', functionId] })
      void qc.invalidateQueries({ queryKey: ['ontology-warnings'] })
      toast.success('Version published')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export interface RunResult {
  value?: unknown
  version?: string
  error?: string
  detail?: string
  ms: number
}

/** The isolate runs behind an edge function, and every ontology read it makes is
 *  performed by the host with the CALLER's JWT — so what the code can see is
 *  what the signed-in user can see. Only a PUBLISHED version runs: there is no
 *  Live Preview here, because `function_to_run` resolves a published one. */
export function useRunFunction(ontologyId: string | null) {
  return useMutation({
    mutationFn: async (i: { apiName: string; inputs: Record<string, unknown>; version?: string }): Promise<RunResult> => {
      const started = performance.now()
      const res = await supabase.functions
        .invoke<{ value: unknown; version: string }>('function-run', {
          body: { ontologyId, apiName: i.apiName, inputs: i.inputs, version: i.version },
        })
      const data = res.data
      const error = res.error as Error | null
      const ms = Math.round(performance.now() - started)
      // A non-2xx carries the namespaced error in its BODY, which is the useful
      // half — `Functions:TimeLimitExceeded` rather than "non-2xx status". The
      // client surfaces the response on `context`, so the body is read there.
      if (error) {
        const res = (error as { context?: Response }).context
        const body = res
          ? await res.json().then((b: unknown) => b as { error?: string; detail?: string })
              .catch(() => null)
          : null
        return { error: body?.error ?? error.message, detail: body?.detail, ms }
      }
      return { value: data?.value, version: data?.version, ms }
    },
  })
}
