import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchUserAgents, createUserAgent, deleteUserAgent, type CreateUserAgentInput } from './api'

const keys = { agents: ['user-agents'] as const }

export function useUserAgents() {
  return useQuery({ queryKey: keys.agents, queryFn: fetchUserAgents, staleTime: 30_000 })
}

export function useCreateUserAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserAgentInput) => createUserAgent(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.agents }); toast.success('Agent created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteUserAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteUserAgent(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.agents }); toast.success('Agent deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
