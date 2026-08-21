// Scoped sessions: built by 404, enforced by resource_file_access, and until
// now drawn by nothing at all.
//
// "Limit a person's access to markings to a pre-defined set based on a defined
// focus of work" — administration/configure-scoped-sessions.
//
// The filter is DISJUNCTIVE and stacks on the conjunctive membership check, so
// choosing a session hides less than it looks like: unmarked resources stay
// visible and one matching marking is enough. That logic is in
// passes_scoped_session; nothing here re-derives it.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { activeScopedSession, selectableScopedSessions } from '@beacon/platform'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'

/** The three toggles the Settings tab shows, "all off by default". */
export interface SessionSettings {
  enabled: boolean
  allowNoSession: boolean
  alwaysShowSelector: boolean
}

export interface ScopedSession {
  id: string
  name: string
  description: string
  markingIds: string[]
}

const KEY = {
  settings: ['scoped-session-settings'] as const,
  presets: ['scoped-sessions'] as const,
  selectable: ['scoped-sessions', 'selectable'] as const,
  active: ['scoped-sessions', 'active'] as const,
}

/** No row means the defaults, which are all off. */
export function useSessionSettings(orgId: string | null) {
  return useQuery({
    queryKey: [...KEY.settings, orgId],
    enabled: orgId !== null,
    queryFn: async (): Promise<SessionSettings> => {
      const { data, error } = await supabase.from('organization_scoped_session_settings')
        .select('enabled, allow_no_session, always_show_selector')
        .eq('organization_id', orgId ?? '').maybeSingle()
      if (error) throw new Error(error.message)
      const r = data as { enabled: boolean; allow_no_session: boolean; always_show_selector: boolean } | null
      return {
        enabled: r?.enabled ?? false,
        allowNoSession: r?.allow_no_session ?? false,
        alwaysShowSelector: r?.always_show_selector ?? false,
      }
    },
  })
}

export function useSetSessionSettings(orgId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Record<'enabled' | 'allow_no_session' | 'always_show_selector', boolean>>) => {
      const { error } = await supabase.from('organization_scoped_session_settings')
        .upsert({ organization_id: orgId, ...patch }, { onConflict: 'organization_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY.settings }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Every preset in the org — the admin's list. What a USER may pick is
 *  selectable_scoped_sessions(), which is membership-gated. */
export function useScopedSessions() {
  return useQuery({
    queryKey: KEY.presets,
    queryFn: async (): Promise<ScopedSession[]> => {
      const { data, error } = await supabase.from('scoped_sessions')
        .select('id, name, description, scoped_session_markings(marking_id)').order('name')
      if (error) throw new Error(error.message)
      return (data as unknown as {
        id: string; name: string; description: string
        scoped_session_markings: { marking_id: string }[]
      }[]).map((s) => ({
        id: s.id, name: s.name, description: s.description,
        markingIds: s.scoped_session_markings.map((m) => m.marking_id),
      }))
    },
  })
}

export function useCreateScopedSession(orgId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: { name: string; description: string; markingIds: string[] }) => {
      const { data, error } = await supabase.from('scoped_sessions')
        .insert({ organization_id: orgId, name: d.name, description: d.description })
        .select('id').single()
      if (error) throw new Error(error.message)
      const id = (data as { id: string }).id
      if (d.markingIds.length > 0) {
        const { error: me } = await supabase.from('scoped_session_markings')
          .insert(d.markingIds.map((marking_id) => ({ scoped_session_id: id, marking_id })))
        if (me) throw new Error(me.message)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.presets })
      void qc.invalidateQueries({ queryKey: KEY.selectable })
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteScopedSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scoped_sessions').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.presets })
      void qc.invalidateQueries({ queryKey: KEY.selectable })
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** "Only users who are members of all the Markings selected in the scoped
 *  session will be able to choose this scoped session" — the gate is in the
 *  function, so the picker shows what it returns and nothing else. */
export function useSelectableSessions() {
  return useQuery({
    queryKey: KEY.selectable,
    queryFn: () => client(selectableScopedSessions).executeFunction({}),
    staleTime: 30_000,
  })
}

export function useActiveSession() {
  return useQuery({
    queryKey: KEY.active,
    queryFn: () => client(activeScopedSession).executeFunction({}),
  })
}

/** Null leaves the session — allowed only when the org allows no session, and
 *  the policy's WITH CHECK is what actually decides. */
export function useChooseSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string | null) => {
      const { data: me } = await supabase.auth.getUser()
      const uid = me.user?.id
      if (!uid) throw new Error('Not signed in')
      const { error } = await supabase.from('user_scoped_session')
        .upsert({ user_id: uid, scoped_session_id: sessionId, selected_at: new Date().toISOString() },
          { onConflict: 'user_id' })
      if (error) throw new Error(error.message)
    },
    // Everything the session filters is now a different answer.
    onSuccess: () => { void qc.invalidateQueries() },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
