// Markings — the mandatory control, from the administration side.
//
// Shape from readings/markings-admin-screen.md, which read
// platform-security-management/manage-markings.md whole plus the thirty
// api/v2/admin-v2-resources pages. Two things that reading settles and that
// this module is built around:
//
//   · the three PERMISSIONS (manage / apply / remove) are not four. `Members`
//     sits beside them on the screen and is a different relation entirely —
//     its own table, no role column — so it gets its own hooks here, never a
//     fourth permission value.
//   · nothing is deletable. "Once created, marking categories cannot be
//     deleted." and "Once created, markings cannot be deleted or moved to a
//     different category." are enforced by guard_marking_immutability, so this
//     module exposes no delete and no category move.
//
// Every rule lives in the database (399-403, 808, 809); these hooks carry rows
// and surface refusals.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { MarkingCategoriesCategoryType, MarkingCategoriesVisibility,
  MarkingPermissionsPermission, MarkingCategoryPermissionsRole } from '@beacon/platform'

export type CategoryType = MarkingCategoriesCategoryType
export type CategoryVisibility = MarkingCategoriesVisibility
export type MarkingPermission = MarkingPermissionsPermission
export type CategoryRole = MarkingCategoryPermissionsRole

export interface MarkingCategory {
  id: string
  name: string
  description: string | null
  categoryType: CategoryType
  visibility: CategoryVisibility
  organizationId: string | null
  createdAt: string
  createdByLabel: string | null
}

export interface Marking {
  id: string
  categoryId: string
  categoryName: string
  name: string
  description: string | null
  createdAt: string
  createdByLabel: string | null
}

/** A row of the Manage permissions panel: one principal, the roles it holds. */
export interface MarkingRoleRow {
  principalId: string
  kind: 'user' | 'group'
  label: string
  permissions: MarkingPermission[]
}

export interface MarkingMemberRow {
  principalId: string
  kind: 'user' | 'group'
  label: string
}

export interface CategoryGrantRow {
  userId: string
  label: string
  role: CategoryRole
}

const keys = {
  categories: ['marking-categories'] as const,
  markings: ['markings'] as const,
  roles: (id: string) => ['marking-roles', id] as const,
  members: (id: string) => ['marking-members', id] as const,
  categoryGrants: (id: string) => ['marking-category-grants', id] as const,
}

/** Email for a user, name for a group, the raw id when neither resolves. */
async function labelsFor(userIds: string[], groupIds: string[]) {
  const [people, groups] = await Promise.all([
    userIds.length
      ? supabase.from('users').select('id, email').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    groupIds.length
      ? supabase.from('groups').select('id, name').in('id', groupIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const map = new Map<string, string>()
  for (const u of (people.data ?? []) as { id: string; email: string }[]) map.set(u.id, u.email)
  for (const g of (groups.data ?? []) as { id: string; name: string }[]) map.set(g.id, g.name)
  return map
}

export function useMarkingCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: async (): Promise<MarkingCategory[]> => {
      const { data, error } = await supabase
        .from('marking_categories')
        .select('id, name, description, category_type, visibility, organization_id, created_at, created_by_user_id')
        .order('name')
      if (error) throw new Error(error.message)
      const rows = data as {
        id: string; name: string; description: string | null
        category_type: CategoryType; visibility: CategoryVisibility
        organization_id: string | null; created_at: string; created_by_user_id: string | null
      }[]
      const labels = await labelsFor(rows.map((r) => r.created_by_user_id).filter((x): x is string => !!x), [])
      return rows.map((r) => ({
        id: r.id, name: r.name, description: r.description,
        categoryType: r.category_type, visibility: r.visibility,
        organizationId: r.organization_id, createdAt: r.created_at,
        createdByLabel: r.created_by_user_id ? labels.get(r.created_by_user_id) ?? r.created_by_user_id : null,
      }))
    },
  })
}

export function useMarkings() {
  return useQuery({
    queryKey: keys.markings,
    queryFn: async (): Promise<Marking[]> => {
      const { data, error } = await supabase
        .from('markings')
        .select('id, category_id, name, description, created_at, created_by_user_id, marking_categories(name)')
        .order('name')
      if (error) throw new Error(error.message)
      const rows = data as {
        id: string; category_id: string; name: string; description: string | null
        created_at: string; created_by_user_id: string | null
        marking_categories: { name: string }[] | { name: string } | null
      }[]
      const labels = await labelsFor(rows.map((r) => r.created_by_user_id).filter((x): x is string => !!x), [])
      return rows.map((r) => ({
        id: r.id, categoryId: r.category_id, categoryName: (Array.isArray(r.marking_categories) ? r.marking_categories[0]?.name : r.marking_categories?.name) ?? '',
        name: r.name, description: r.description, createdAt: r.created_at,
        createdByLabel: r.created_by_user_id ? labels.get(r.created_by_user_id) ?? r.created_by_user_id : null,
      }))
    },
  })
}

/** One row per principal, its permissions gathered — the screen's dropdown
 *  shows "<first> +N", so the grouping is the shape the panel needs. */
export function useMarkingRoles(markingId: string | null) {
  return useQuery({
    queryKey: keys.roles(markingId ?? ''),
    enabled: !!markingId,
    queryFn: async (): Promise<MarkingRoleRow[]> => {
      const { data, error } = await supabase
        .from('marking_permissions')
        .select('user_id, group_id, permission')
        .eq('marking_id', markingId as string)
      if (error) throw new Error(error.message)
      const rows = data as { user_id: string | null; group_id: string | null; permission: MarkingPermission }[]
      const labels = await labelsFor(
        rows.map((r) => r.user_id).filter((x): x is string => !!x),
        rows.map((r) => r.group_id).filter((x): x is string => !!x),
      )
      const by = new Map<string, MarkingRoleRow>()
      for (const r of rows) {
        const id = r.user_id ?? r.group_id
        if (!id) continue
        const existing = by.get(id)
        if (existing) { existing.permissions.push(r.permission); continue }
        by.set(id, {
          principalId: id,
          kind: r.user_id ? 'user' : 'group',
          label: labels.get(id) ?? id,
          permissions: [r.permission],
        })
      }
      return [...by.values()].sort((a, b) => a.label.localeCompare(b.label))
    },
  })
}

export function useMarkingMembers(markingId: string | null) {
  return useQuery({
    queryKey: keys.members(markingId ?? ''),
    enabled: !!markingId,
    queryFn: async (): Promise<MarkingMemberRow[]> => {
      const { data, error } = await supabase
        .from('marking_members')
        .select('user_id, group_id')
        .eq('marking_id', markingId as string)
      if (error) throw new Error(error.message)
      const rows = data as { user_id: string | null; group_id: string | null }[]
      const labels = await labelsFor(
        rows.map((r) => r.user_id).filter((x): x is string => !!x),
        rows.map((r) => r.group_id).filter((x): x is string => !!x),
      )
      return rows
        .map((r) => {
          const id = r.user_id ?? r.group_id
          return id ? { principalId: id, kind: r.user_id ? 'user' as const : 'group' as const, label: labels.get(id) ?? id } : null
        })
        .filter((x): x is MarkingMemberRow => !!x)
        .sort((a, b) => a.label.localeCompare(b.label))
    },
  })
}

export function useCategoryGrants(categoryId: string | null) {
  return useQuery({
    queryKey: keys.categoryGrants(categoryId ?? ''),
    enabled: !!categoryId,
    queryFn: async (): Promise<CategoryGrantRow[]> => {
      const { data, error } = await supabase
        .from('marking_category_permissions')
        .select('user_id, role')
        .eq('category_id', categoryId)
      if (error) throw new Error(error.message)
      const rows = data as { user_id: string; role: CategoryRole }[]
      const labels = await labelsFor(rows.map((r) => r.user_id), [])
      return rows
        .map((r) => ({ userId: r.user_id, role: r.role, label: labels.get(r.user_id) ?? r.user_id }))
        .sort((a, b) => a.label.localeCompare(b.label))
    },
  })
}

export function useCreateMarkingCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string; description: string
      categoryType: CategoryType; visibility: CategoryVisibility
      organizationId: string | null
    }) => {
      const { error } = await supabase.from('marking_categories').insert({
        name: input.name,
        description: input.description || null,
        category_type: input.categoryType,
        visibility: input.visibility,
        organization_id: input.organizationId,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.categories })
      toast.success('Marking category created')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useCreateMarking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { categoryId: string; name: string; description: string }) => {
      const { error } = await supabase.from('markings').insert({
        category_id: input.categoryId,
        name: input.name,
        description: input.description || null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.markings })
      toast.success('Marking created')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Description is the one field the details pane edits inline. A category's
 *  type, visibility and organization are fixed at creation — `Replace` on the
 *  API carries only name and description, so nothing here offers them. */
export function useUpdateCategoryDescription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; description: string }) => {
      const { error } = await supabase
        .from('marking_categories')
        .update({ description: input.description || null })
        .eq('id', input.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.categories }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useUpdateMarkingDescription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; description: string }) => {
      const { error } = await supabase
        .from('markings')
        .update({ description: input.description || null })
        .eq('id', input.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.markings }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The role popover's checkboxes. `remove` needs `apply` alongside it, which
 *  guard_remove_implies_apply enforces — the toast carries that refusal rather
 *  than this module second-guessing it. */
export function useSetMarkingPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      markingId: string; principalId: string; kind: 'user' | 'group'
      permission: MarkingPermission; held: boolean
    }) => {
      const principal = input.kind === 'user'
        ? { user_id: input.principalId, group_id: null }
        : { user_id: null, group_id: input.principalId }
      if (input.held) {
        const q = supabase.from('marking_permissions').delete()
          .eq('marking_id', input.markingId).eq('permission', input.permission)
        const { error } = input.kind === 'user'
          ? await q.eq('user_id', input.principalId)
          : await q.eq('group_id', input.principalId)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('marking_permissions')
          .insert({ marking_id: input.markingId, permission: input.permission, ...principal })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: (_d, v) => { void qc.invalidateQueries({ queryKey: keys.roles(v.markingId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** `Remove all` in the popover — every permission this principal holds. */
export function useRemoveAllMarkingPermissions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { markingId: string; principalId: string; kind: 'user' | 'group' }) => {
      const q = supabase.from('marking_permissions').delete().eq('marking_id', input.markingId)
      const { error } = input.kind === 'user'
        ? await q.eq('user_id', input.principalId)
        : await q.eq('group_id', input.principalId)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, v) => { void qc.invalidateQueries({ queryKey: keys.roles(v.markingId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSetMarkingMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      markingId: string; principalId: string; kind: 'user' | 'group'; member: boolean
    }) => {
      if (input.member) {
        const q = supabase.from('marking_members').delete().eq('marking_id', input.markingId)
        const { error } = input.kind === 'user'
          ? await q.eq('user_id', input.principalId)
          : await q.eq('group_id', input.principalId)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('marking_members').insert({
          marking_id: input.markingId,
          user_id: input.kind === 'user' ? input.principalId : null,
          group_id: input.kind === 'group' ? input.principalId : null,
        })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: (_d, v) => { void qc.invalidateQueries({ queryKey: keys.members(v.markingId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSetCategoryGrant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { categoryId: string; userId: string; role: CategoryRole; held: boolean }) => {
      if (input.held) {
        const { error } = await supabase.from('marking_category_permissions').delete()
          .eq('category_id', input.categoryId).eq('user_id', input.userId).eq('role', input.role)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('marking_category_permissions')
          .insert({ category_id: input.categoryId, user_id: input.userId, role: input.role })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: (_d, v) => { void qc.invalidateQueries({ queryKey: keys.categoryGrants(v.categoryId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

// ── Markings on a resource ───────────────────────────────────────────────
//
// "Hide sensitive ontology resources by applying a marking or by placing them
// in a project where the user lacks a role grant."
// (object-permissioning/ontology-permissions)
//
// 819 admitted `object_type` to resource_markings and taught the object_types
// read policy to honour it, so applying one here actually hides the type.
// Keyed by kind so the same pair serves the other resource kinds when their
// screens want them.

export interface AppliedMarking {
  markingId: string
  name: string
  categoryName: string
}

export function useResourceMarkings(kind: string, resourceId: string | null) {
  return useQuery({
    queryKey: ['resource-markings', kind, resourceId ?? ''] as const,
    enabled: !!resourceId,
    queryFn: async (): Promise<AppliedMarking[]> => {
      const { data, error } = await supabase
        .from('resource_markings')
        .select('marking_id, markings(name, marking_categories(name))')
        .eq('resource_kind', kind)
        .eq('resource_id', resourceId as string)
      if (error) throw new Error(error.message)
      const rows = data as unknown as {
        marking_id: string
        markings: { name: string; marking_categories: { name: string } | null } | null
      }[]
      return rows.map((r) => ({
        markingId: r.marking_id,
        name: r.markings?.name ?? r.marking_id,
        categoryName: r.markings?.marking_categories?.name ?? '',
      }))
    },
  })
}

/** Apply or remove one. The database decides whether the caller may: applying
 *  needs the marking's `apply` permission AND Owner on the resource, removing
 *  needs `remove` as well — guard_marking_application raises
 *  Markings:CannotApply / Markings:CannotRemove, and the toast carries it. */
export function useSetResourceMarking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: {
      kind: string; resourceId: string; markingId: string; applied: boolean
    }) => {
      if (i.applied) {
        const { error } = await supabase.from('resource_markings').delete()
          .eq('resource_kind', i.kind).eq('resource_id', i.resourceId)
          .eq('marking_id', i.markingId)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('resource_markings')
          .insert({ resource_kind: i.kind, resource_id: i.resourceId, marking_id: i.markingId })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: (_d, i) => {
      void qc.invalidateQueries({ queryKey: ['resource-markings', i.kind, i.resourceId] })
      void qc.invalidateQueries({ queryKey: ['type-security', i.resourceId] })
      toast.success(i.applied ? 'Marking removed' : 'Marking applied')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
