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
import { runWithCheckpoint } from '@/features/checkpoints/gate'
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
  /** The approval policy. "Approval policies have three customizable
   *  parameters: Eligible reviewers… Number of approvals required…
   *  Contributor approval" — 462 stored all three and the trigger enforces
   *  them; nothing has ever shown them. NULL approvals means the DEFAULT
   *  policy, which the page prints verbatim. */
  autoProtectNew: boolean
  policyApprovalsRequired: number | null
  policyReviewerIds: string[]
  policyContributorApproval: boolean
  /** "a Markdown-based rich-text editor for writing comprehensive
   *  documentation about the Project" (security/cover-pages). NULL = none. */
  coverPage: string | null
  /** The capture's two radio labels; NULL = the cover page follows project
   *  access (migration 676). */
  coverPageDiscoverability: 'all_can_discover' | 'require_marking_access' | null
  createdAt: string
}

/** The discovery tuple — everything discoverable_cover_pages() returns, which
 *  is deliberately all a non-member may see of a marked project. */
export interface DiscoverableProject {
  projectId: string
  rid: string
  name: string
  description: string
  coverPage: string
}

/** One grant row: a user or a group, never both (migration 481). */
export interface ProjectMember {
  userId: string | null
  groupId: string | null
  role: ProjectRole
  /** Email for a user, name for a group; null until resolvable. */
  label: string | null
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
        .select(`id, api_name, name, description, created_at, default_role,
                 auto_protect_new, policy_approvals_required, policy_reviewer_ids,
                 policy_contributor_approval, cover_page, cover_page_discoverability,
                 spaces(path)`).order('name')
      if (error) throw new Error(error.message)
      return (data as unknown as {
        id: string; api_name: string; name: string; description: string; created_at: string
        default_role: ProjectRole | null; spaces: { path: string } | null
        auto_protect_new: boolean; policy_approvals_required: number | null
        policy_reviewer_ids: string[]; policy_contributor_approval: boolean
        cover_page: string | null
        cover_page_discoverability: 'all_can_discover' | 'require_marking_access' | null
      }[]).map((r) => ({
        id: r.id, apiName: r.api_name, name: r.name, description: r.description,
        spacePath: r.spaces?.path ?? '', defaultRole: r.default_role,
        autoProtectNew: r.auto_protect_new,
        policyApprovalsRequired: r.policy_approvals_required,
        policyReviewerIds: r.policy_reviewer_ids,
        policyContributorApproval: r.policy_contributor_approval,
        coverPage: r.cover_page,
        coverPageDiscoverability: r.cover_page_discoverability,
        createdAt: r.created_at,
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

/** The cover page and its discoverability, in one save (migration 676). */
export function useSetCoverPage(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: {
      coverPage: string | null
      discoverability: 'all_can_discover' | 'require_marking_access' | null
    }) => {
      const { error } = await supabase.from('projects')
        .update({ cover_page: i.coverPage, cover_page_discoverability: i.discoverability })
        .eq('id', projectId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }); toast.success('Cover page saved') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** "Users without access to the Project or its files can still discover and
 *  view the Project's cover page" — the 676 carve-out, tuple only. */
export function useDiscoverableCoverPages() {
  return useQuery({
    queryKey: ['discoverable-cover-pages'],
    staleTime: 60_000,
    queryFn: async (): Promise<DiscoverableProject[]> => {
      const res = (await supabase.rpc('discoverable_cover_pages')) as {
        data: { project_id: string; rid: string; name: string; description: string; cover_page: string }[] | null
        error: { message: string } | null
      }
      if (res.error) throw new Error(res.error.message)
      return (res.data ?? []).map((r) => ({
        projectId: r.project_id, rid: r.rid, name: r.name,
        description: r.description, coverPage: r.cover_page,
      }))
    },
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
      // once took out the StockLog page for everyone. Follow-up reads instead.
      const { data, error } = await supabase.from('project_role_grants')
        .select('user_id, group_id, role, granted_at').eq('project_id', projectId ?? '')
      if (error) throw new Error(error.message)
      const rows = data as {
        user_id: string | null; group_id: string | null; role: ProjectRole; granted_at: string
      }[]
      if (rows.length === 0) return []

      const userIds = rows.flatMap((r) => r.user_id ? [r.user_id] : [])
      const groupIds = rows.flatMap((r) => r.group_id ? [r.group_id] : [])
      const labelById = new Map<string, string>()
      if (userIds.length > 0) {
        const { data: people } = await supabase.from('users').select('id, email').in('id', userIds)
        for (const u of (people as { id: string; email: string }[] | null ?? [])) labelById.set(u.id, u.email)
      }
      if (groupIds.length > 0) {
        const { data: gs } = await supabase.from('groups').select('id, name').in('id', groupIds)
        for (const g of (gs as { id: string; name: string }[] | null ?? [])) labelById.set(g.id, g.name)
      }
      return rows.map((r) => ({
        userId: r.user_id, groupId: r.group_id, role: r.role, grantedAt: r.granted_at,
        label: labelById.get(r.user_id ?? r.group_id ?? '') ?? null,
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
    mutationFn: async (i: { userId?: string; groupId?: string; role: ProjectRole }) => {
      // The database refuses a grant above the granter's own role
      // (Projects:GrantExceedsRole). The picker only offers what is grantable,
      // so this is the belt to that braces.
      await runWithCheckpoint(async () => {
        const { error } = i.groupId
          ? await supabase.from('project_role_grants')
              .upsert({ project_id: projectId, group_id: i.groupId, role: i.role },
                      { onConflict: 'project_id,group_id' })
          : await supabase.from('project_role_grants')
              .upsert({ project_id: projectId, user_id: i.userId, role: i.role },
                      { onConflict: 'project_id,user_id' })
        if (error) throw new Error(error.message)
      }, [{ kind: 'project', ref_id: projectId, name: '' }])
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

/** "Only users that are owners on the project can update its custom policy" —
 *  guard_project_policy (462) refuses otherwise, so a failure here is the
 *  database saying so rather than the surface guessing. */
export function useSetProjectPolicy(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      autoProtectNew?: boolean
      policyApprovalsRequired?: number | null
      policyReviewerIds?: string[]
      policyContributorApproval?: boolean
    }) => {
      const patch: Record<string, unknown> = {}
      if (p.autoProtectNew !== undefined) patch.auto_protect_new = p.autoProtectNew
      if (p.policyApprovalsRequired !== undefined) patch.policy_approvals_required = p.policyApprovalsRequired
      if (p.policyReviewerIds !== undefined) patch.policy_reviewer_ids = p.policyReviewerIds
      if (p.policyContributorApproval !== undefined) patch.policy_contributor_approval = p.policyContributorApproval
      const { error } = await supabase.from('projects').update(patch).eq('id', projectId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }); toast.success('Policy updated') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRevokeRole(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (principal: { userId?: string; groupId?: string }) => {
      await runWithCheckpoint(async () => {
        let q = supabase.from('project_role_grants').delete().eq('project_id', projectId)
        q = principal.groupId ? q.eq('group_id', principal.groupId) : q.eq('user_id', principal.userId ?? '')
        const { error } = await q
        if (error) throw new Error(error.message)
      }, [{ kind: 'project', ref_id: projectId, name: '' }])
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

/** Who can be granted a role: the organization's user registry, which RLS
 *  already scopes to the caller's org. This read `user_org_memberships` until
 *  2026-08-13 — a table the teardown deleted — so every picker built on it
 *  listed nobody. The registry currently holds owner/admin rows only
 *  (users_role_check); widening it into the full Multipass-style user list is
 *  recorded in the security reading. */
export function useOrgMembers() {
  return useQuery({
    queryKey: ['org-members-for-grants'],
    queryFn: async (): Promise<{ id: string; email: string }[]> => {
      const { data, error } = await supabase.from('users')
        .select('id, email').order('email').limit(500)
      if (error) throw new Error(error.message)
      return data as { id: string; email: string }[]
    },
    staleTime: 60_000,
  })
}
