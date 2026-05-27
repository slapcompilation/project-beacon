// Layer: Flow — TanStack Query hooks for Pick Lists

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import {
  fetchPickLists,
  fetchPickListItems,
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
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (input: { name: string; notes?: string; due_date?: string | null; assigned_to?: string | null }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        {
          type:       'CREATE_PICK_LIST',
          hotelId,
          name:       input.name,
          notes:      input.notes ?? null,
          dueDate:    input.due_date ?? null,
          assignedTo: input.assigned_to ?? null,
        },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: K.all() }) },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdatePickList() {
  const qc = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<Pick<PickList, 'name' | 'notes' | 'status' | 'due_date' | 'assigned_to'>> }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        {
          type:       'UPDATE_PICK_LIST',
          pickListId: id,
          hotelId,
          name:       input.name,
          notes:      input.notes,
          status:     input.status,
          dueDate:    input.due_date,
          assignedTo: input.assigned_to,
        },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: K.all() }) },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeletePickList() {
  const qc = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (id: string) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'DELETE_PICK_LIST', pickListId: id, hotelId },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: K.all() }) },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useAddPickListItem() {
  const qc = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (input: { pick_list_id: string; variant_id: string; quantity_planned: number; notes?: string }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        {
          type:            'ADD_PICK_LIST_ITEM',
          pickListId:      input.pick_list_id,
          hotelId,
          variantId:       input.variant_id,
          quantityPlanned: input.quantity_planned,
          notes:           input.notes ?? null,
        },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: K.items(vars.pick_list_id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdatePickListItem(pickListId: string) {
  const qc = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: { quantity_picked?: number; quantity_planned?: number; notes?: string | null } }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        {
          type:            'UPDATE_PICK_LIST_ITEM',
          itemId:          id,
          hotelId,
          quantityPicked:  input.quantity_picked,
          quantityPlanned: input.quantity_planned,
          notes:           input.notes,
        },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: K.items(pickListId) }) },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRemovePickListItem(pickListId: string) {
  const qc = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (id: string) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'REMOVE_PICK_LIST_ITEM', itemId: id, hotelId },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: K.items(pickListId) }) },
    onError: (err: Error) => toast.error(err.message),
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
