import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchUserTools, createUserTool, deleteUserTool, type CreateUserToolInput } from './api'
import { fetchAuthoredLogicTools } from './authoredToolReader'

const keys = { tools: ['user-tools'] as const, asLogicTools: ['user-tools', 'as-logic-tools'] as const }

export function useUserTools() {
  return useQuery({ queryKey: keys.tools, queryFn: fetchUserTools, staleTime: 30_000 })
}

/** Authored tools as callable Logic Tools — what the agent composer offers and
 *  the runner resolves. */
export function useAuthoredLogicTools() {
  return useQuery({ queryKey: keys.asLogicTools, queryFn: fetchAuthoredLogicTools, staleTime: 30_000 })
}

export function useCreateUserTool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserToolInput) => createUserTool(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.tools }); toast.success('Logic Tool created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteUserTool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteUserTool(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.tools }); toast.success('Logic Tool deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
