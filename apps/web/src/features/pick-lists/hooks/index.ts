// Layer: Flow — TanStack Query hooks for Pick Lists

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchPickLists,
  createPickList,
  updatePickList,
  deletePickList,
  fetchPickListItems,
  addPickListItem,
  updatePickListItem,
  removePickListItem,
  commitPickList,
} from '../api'
import type { PickList } from '@beacon/types'

const K = {
  all:   () => ['pick-lists'] as const,
  items: (id: string) => ['pick-list-items', id] as const,
}

export function usePickLists() {
  return useQuery({ queryKey: K.all(), queryFn: fetchPickLists, staleTime: 30_000 })
}

export function usePickListItems(pickListId: string | null | undefined) {
  return useQuery({
    queryKey: K.items(pickListId ?? ''),
    queryFn: () => fetchPickListItems(pickListId ?? ''),
    enabled: !!pickListId,
    staleTime: 10_000,
  })
}

export function useCreatePickList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPickList,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: K.all() }) },
  })
}

export function useUpdatePickList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Pick<PickList, 'name' | 'notes' | 'status' | 'due_date' | 'assigned_to'>> }) =>
      updatePickList(id, input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: K.all() }) },
  })
}

export function useDeletePickList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePickList,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: K.all() }) },
  })
}

export function useAddPickListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addPickListItem,
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: K.items(vars.pick_list_id) })
    },
  })
}

export function useUpdatePickListItem(pickListId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { quantity_picked?: number; quantity_planned?: number; notes?: string | null } }) =>
      updatePickListItem(id, input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: K.items(pickListId) }) },
  })
}

export function useRemovePickListItem(pickListId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removePickListItem,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: K.items(pickListId) }) },
  })
}

export function useCommitPickList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: commitPickList,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: K.all() })
      // Inventory stock levels change after commit — invalidate products
      void qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
