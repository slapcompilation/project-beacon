// Projects — Foundry's primary security boundary, as data.
//
// Shape copied from Compass: a landing page that lists them, a create pane
// taking a name, an optional description and a default role, and a details
// panel whose Access tab manages who holds which role
// (mirror/compass/create-a-project.md, use-project-details-panel.md).
//
// The space picker is not here: Foundry's "location (space)" is the tenant a
// project lives in, and ours is the organization — implied by RLS, never chosen.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ProjectRole } from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'
import { projectRole } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'

export interface Project {
  id: string
  apiName: string
  name: string
  description: string
  /** The containing space's path — the first element of every location inside
   *  this project. Empty while the project has no space. */
  spacePath: string
  /** Granted to everyone in the organization: "Everyone from <org> can see the
   *  existence of this project and is granted the <role> role." A floor, not a
   *  ceiling — an explicit grant can only raise it. */
  defaultRole: ProjectRole | null
  createdAt: string
}

export interface ProjectMember {
  userId: string
  role: ProjectRole
  email: string | null
  grantedAt: string
}

export interface ProjectResource {
  resourceKind: 'object_type' | 'module' | 'document' | 'object_set' | 'user_tool'
  resourceId: string
}

const keys = {
  all: ['projects'] as const,
  members: (id: string) => ['project-members', id] as const,
  resources: (id: string) => ['project-resources', id] as const,
  myRole: (id: string) => ['project-role', id] as const,
}

export function useProjects() {
  return useQuery({
    queryKey: keys.all,
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase.from('projects')
        .select('id, api_name, name, description, created_at, default_role, spaces(path)').order('name')
      if (error) throw new Error(error.message)
      return (data as unknown as {
        id: string; api_name: string; name: string; description: string; created_at: string
        default_role: ProjectRole | null; spaces: { path: string } | null
      }[]).map((r) => ({
        id: r.id, apiName: r.api_name, name: r.name, description: r.description,
        spacePath: r.spaces?.path ?? '', defaultRole: r.default_role, createdAt: r.created_at,
      }))
    },
    staleTime: 30_000,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { apiName: string; name: string; description: string; defaultRole: ProjectRole | null }) => {
      // The default role is a standing setting on the project, granted to the
      // whole organization — the create dialog says so in the sentence it builds
      // from your selections: "Everyone from <org> can see the existence of this
      // project and is granted the <role> role." It used to be written here as a
      // one-time grant to the creator, which is neither.
      const { data, error } = await supabase.from('projects')
        .insert({
          api_name: i.apiName, name: i.name, description: i.description,
          default_role: i.defaultRole,
        })
        .select('id').single<{ id: string }>()
      if (error) throw new Error(error.message)
      return data.id
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }); toast.success('Project created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Who holds what. Foundry's Access tab — an Owner edits it, everyone else
 *  reads "an overview of the current groups with Project access". */
export function useProjectMembers(projectId: string | null) {
  return useQuery({
    queryKey: keys.members(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectMember[]> => {
      // NO EMBED. user_id points at auth.users, which PostgREST does not expose,
      // so `users:user_id(email)` 404s the whole request — the same trap that
      // once took out the StockLog page for everyone. Two reads instead.
      const { data, error } = await supabase.from('project_role_grants')
        .select('user_id, role, granted_at').eq('project_id', projectId ?? '')
      if (error) throw new Error(error.message)
      const rows = data as { user_id: string; role: ProjectRole; granted_at: string }[]
      if (rows.length === 0) return []

      const { data: people } = await supabase.from('users')
        .select('id, email').in('id', rows.map((r) => r.user_id))
      const emailById = new Map((people as { id: string; email: string }[] | null ?? [])
        .map((u) => [u.id, u.email]))
      return rows.map((r) => ({
        userId: r.user_id, role: r.role, grantedAt: r.granted_at,
        email: emailById.get(r.user_id) ?? null,
      }))
    },
    staleTime: 15_000,
  })
}

/** The caller's own role on this project, which decides what the Access tab
 *  lets them do. Reads the same SECURITY DEFINER helper the RLS policies use,
 *  so the UI and the database cannot disagree. */
export function useMyProjectRole(projectId: string | null) {
  return useQuery({
    queryKey: keys.myRole(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectRole | null> => {
      const role = await client(projectRole).executeFunction({ p_project: projectId as string })
      return role as ProjectRole | null
    },
    staleTime: 30_000,
  })
}

export function useGrantRole(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { userId: string; role: ProjectRole }) => {
      // The database refuses a grant above the granter's own role
      // (Projects:GrantExceedsRole). The picker only offers what is grantable,
      // so this is the belt to that braces.
      const { error } = await supabase.from('project_role_grants')
        .upsert({ project_id: projectId, user_id: i.userId, role: i.role },
                { onConflict: 'project_id,user_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.members(projectId) }); toast.success('Role granted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The standing organization-wide grant, editable from Manage roles the way
 *  Foundry's `Default role` dropdown is. */
export function useSetDefaultRole(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (role: ProjectRole | null) => {
      const { error } = await supabase.from('projects')
        .update({ default_role: role }).eq('id', projectId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }); toast.success('Default role updated') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRevokeRole(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('project_role_grants').delete()
        .eq('project_id', projectId).eq('user_id', userId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.members(projectId) }); toast.success('Access removed') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** What the project contains. Foundry: work and its output live together. */
export function useProjectResources(projectId: string | null) {
  return useQuery({
    queryKey: keys.resources(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectResource[]> => {
      const { data, error } = await supabase.from('project_resources')
        .select('resource_kind, resource_id').eq('project_id', projectId ?? '')
      if (error) throw new Error(error.message)
      return (data as { resource_kind: ProjectResource['resourceKind']; resource_id: string }[])
        .map((r) => ({ resourceKind: r.resource_kind, resourceId: r.resource_id }))
    },
    staleTime: 30_000,
  })
}

/** Who can be granted a role. A project is ORG-scoped, so the candidates come
 *  from user_org_memberships (readable org-wide) rather than public.users, which
 *  is gated `hotel_id = auth_hotel_id()` and would have offered only the people
 *  at whichever property the operator happens to be looking at.
 *
 *  Emails come from that hotel-scoped table on a best-effort basis, so a
 *  colleague at another property shows as an id until they are resolvable.
 *  Better a grantable id than an unofferable person. */
export function useOrgMembers() {
  return useQuery({
    queryKey: ['org-members-for-grants'],
    queryFn: async (): Promise<{ id: string; email: string }[]> => {
      const { data, error } = await supabase.from('user_org_memberships')
        .select('user_id').limit(500)
      if (error) throw new Error(error.message)
      const ids = [...new Set((data as { user_id: string }[]).map((r) => r.user_id))]
      if (ids.length === 0) return []

      const { data: people } = await supabase.from('users').select('id, email').in('id', ids)
      const emailById = new Map((people as { id: string; email: string }[] | null ?? [])
        .map((u) => [u.id, u.email]))
      return ids
        .map((id) => ({ id, email: emailById.get(id) ?? id }))
        .sort((a, b) => a.email.localeCompare(b.email))
    },
    staleTime: 60_000,
  })
}
