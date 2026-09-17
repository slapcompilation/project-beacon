// Spaces — the container a project lives in, and the organizations that gate it.
//
// Shape from readings/spaces-and-the-resource-path.md, whose Decision 1 is
// that `space-settings.png` shows the surface IN FULL: a Space details card
// (name, an immutable path, an optional description) and an Access
// requirements card (the organizations). Everything the engine has had since
// 397 and nothing has ever reached — `spaces`, `space_organizations`,
// `create_space()`, `set_space_path`, and the portfolios that can only be made
// inside a space.
//
// The path is READ-ONLY here because it is read-only there: the capture greys
// the field, and 397 captures it at insert rather than deriving it on read, so
// that renaming a space does not move every resource in it.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export interface Space {
  id: string
  name: string
  path: string | null
  description: string | null
  createdAt: string
}

export interface Organization {
  id: string
  name: string
}

export interface Portfolio {
  id: string
  spaceId: string
  name: string
  description: string | null
  documentation: string | null
  createdAt: string
}

const keys = {
  spaces: ['spaces'] as const,
  organizations: ['organizations'] as const,
  spaceOrgs: (id: string) => ['space-organizations', id] as const,
  portfolios: (id: string) => ['portfolios', id] as const,
}

export function useSpaces() {
  return useQuery({
    queryKey: keys.spaces,
    queryFn: async (): Promise<Space[]> => {
      const { data, error } = await supabase
        .from('spaces')
        .select('id, name, path, description, created_at')
        .order('name')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; name: string; path: string | null
        description: string | null; created_at: string
      }[]).map((s) => ({
        id: s.id, name: s.name, path: s.path,
        description: s.description, createdAt: s.created_at,
      }))
    },
  })
}

export function useOrganizations() {
  return useQuery({
    queryKey: keys.organizations,
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await supabase.from('organizations').select('id, name').order('name')
      if (error) throw new Error(error.message)
      return data as Organization[]
    },
    staleTime: 60_000,
  })
}

/** The organization ids gating one space. "To access this space, users must be
 *  a member of at least one of the selected organizations below." */
export function useSpaceOrganizations(spaceId: string | null) {
  return useQuery({
    queryKey: keys.spaceOrgs(spaceId ?? ''),
    enabled: !!spaceId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('space_organizations')
        .select('organization_id')
        .eq('space_id', spaceId as string)
      if (error) throw new Error(error.message)
      return (data as { organization_id: string }[]).map((r) => r.organization_id)
    },
  })
}

export function useCreateSpace() {
  const qc = useQueryClient()
  return useMutation({
    // create_space does three things in one transaction — the space, the
    // caller's organization on it, and the ontology that shares its name — so
    // the client calls it rather than inserting the row itself.
    mutationFn: async (i: { name: string; description: string }) => {
      const { error } = await supabase.rpc('create_space', {
        p_name: i.name, p_description: i.description,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.spaces })
      toast.success('Space created')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Name and description only. The path is generated once and refused on update
 *  by 397's trigger, which is what the greyed field in the capture means. */
export function useUpdateSpace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { id: string; name: string; description: string }) => {
      const { error } = await supabase.from('spaces')
        .update({ name: i.name, description: i.description })
        .eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.spaces })
      toast.success('Space saved')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSetSpaceOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { spaceId: string; organizationId: string; on: boolean }) => {
      if (i.on) {
        const { error } = await supabase.from('space_organizations')
          .delete().eq('space_id', i.spaceId).eq('organization_id', i.organizationId)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('space_organizations')
          .insert({ space_id: i.spaceId, organization_id: i.organizationId })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: (_d, i) => { void qc.invalidateQueries({ queryKey: keys.spaceOrgs(i.spaceId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Portfolios exist only inside a space, which is why nothing could reach one
 *  until this screen: `portfolios` has had a full engine and zero rows. */
export function usePortfolios(spaceId: string | null) {
  return useQuery({
    queryKey: keys.portfolios(spaceId ?? ''),
    enabled: !!spaceId,
    queryFn: async (): Promise<Portfolio[]> => {
      const { data, error } = await supabase
        .from('portfolios')
        .select('id, space_id, name, description, documentation, created_at')
        .eq('space_id', spaceId as string)
        .order('name')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; space_id: string; name: string
        description: string | null; documentation: string | null; created_at: string
      }[]).map((p) => ({
        id: p.id, spaceId: p.space_id, name: p.name,
        description: p.description, documentation: p.documentation, createdAt: p.created_at,
      }))
    },
  })
}

export function useCreatePortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { spaceId: string; name: string; description: string }) => {
      const { error } = await supabase.from('portfolios').insert({
        space_id: i.spaceId, name: i.name, description: i.description || null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, i) => {
      void qc.invalidateQueries({ queryKey: keys.portfolios(i.spaceId) })
      toast.success('Portfolio created')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

// ── Space permissions ────────────────────────────────────────────────────
//
// `space-permissions.png`: "Grant roles to people and manage aspects of a
// space." One card per role carrying its description, a `Default role` tag, the
// people holding it, and a `Grants N workflows` footer that expands to the list.
//
// Our three seeded roles and Contributor's five workflows are exactly the
// capture's, which readings/portfolios-and-space-roles.md Decision 2 required:
// the other two roles' workflow lists are NOT published (the capture collapses
// them behind "Grants 1 workflow" and "Grants 61 workflows"), so they have no
// rows rather than invented ones.

export interface SpaceRole {
  id: string
  apiName: string
  displayName: string
  description: string | null
  /** Null means the role is not owned by one space — ours are all platform-wide. */
  spaceId: string | null
  workflows: string[]
}

export interface SpaceRoleGrant {
  id: string
  roleId: string
  principalId: string
  kind: 'user' | 'group'
  label: string
}

export function useSpaceRoles() {
  return useQuery({
    queryKey: ['space-roles'] as const,
    queryFn: async (): Promise<SpaceRole[]> => {
      const { data, error } = await supabase
        .from('space_roles')
        .select('id, api_name, display_name, description, space_id, space_role_workflows(workflow)')
        .order('display_name')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; api_name: string; display_name: string
        description: string | null; space_id: string | null
        space_role_workflows: { workflow: string }[]
      }[]).map((r) => ({
        id: r.id, apiName: r.api_name, displayName: r.display_name,
        description: r.description, spaceId: r.space_id,
        workflows: r.space_role_workflows.map((w) => w.workflow).sort(),
      }))
    },
  })
}

export function useSpaceRoleGrants(spaceId: string | null) {
  return useQuery({
    queryKey: ['space-role-grants', spaceId ?? ''] as const,
    enabled: !!spaceId,
    queryFn: async (): Promise<SpaceRoleGrant[]> => {
      const { data, error } = await supabase
        .from('space_role_grants')
        .select('id, role_id, user_id, group_id')
        .eq('space_id', spaceId as string)
      if (error) throw new Error(error.message)
      const rows = data as {
        id: string; role_id: string; user_id: string | null; group_id: string | null
      }[]
      const users = rows.map((r) => r.user_id).filter((x): x is string => !!x)
      const groups = rows.map((r) => r.group_id).filter((x): x is string => !!x)
      const [people, grps] = await Promise.all([
        users.length ? supabase.from('users').select('id, email').in('id', users)
          : Promise.resolve({ data: [] }),
        groups.length ? supabase.from('groups').select('id, name').in('id', groups)
          : Promise.resolve({ data: [] }),
      ])
      const label = new Map<string, string>()
      for (const u of (people.data ?? []) as { id: string; email: string }[]) label.set(u.id, u.email)
      for (const g of (grps.data ?? []) as { id: string; name: string }[]) label.set(g.id, g.name)
      return rows
        .map((r) => {
          const id = r.user_id ?? r.group_id
          return id ? {
            id: r.id, roleId: r.role_id, principalId: id,
            kind: r.user_id ? 'user' as const : 'group' as const,
            label: label.get(id) ?? id,
          } : null
        })
        .filter((x): x is SpaceRoleGrant => !!x)
        .sort((a, b) => a.label.localeCompare(b.label))
    },
  })
}

export function useGrantSpaceRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: {
      spaceId: string; roleId: string; principalId: string; kind: 'user' | 'group'
    }) => {
      const { error } = await supabase.from('space_role_grants').insert({
        space_id: i.spaceId, role_id: i.roleId,
        user_id: i.kind === 'user' ? i.principalId : null,
        group_id: i.kind === 'group' ? i.principalId : null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, i) => {
      void qc.invalidateQueries({ queryKey: ['space-role-grants', i.spaceId] })
      toast.success('Role granted')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRevokeSpaceRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { spaceId: string; grantId: string }) => {
      const { error } = await supabase.from('space_role_grants').delete().eq('id', i.grantId)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, i) => {
      void qc.invalidateQueries({ queryKey: ['space-role-grants', i.spaceId] })
      toast.success('Role revoked')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
